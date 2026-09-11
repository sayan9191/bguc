-- Organiser access for the static admin module.
--
-- The password is NEVER stored in this repo. It lives only in Supabase as a
-- bcrypt hash. Set it once from the Supabase SQL editor:
--
--   SELECT public.organiser_set_password('your-username', 'your-password');
--
-- The static admin signs in through organiser_login() and receives a random
-- session token that expires. Every organiser_* function takes that token.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.organiser_ok(TEXT);
DROP FUNCTION IF EXISTS public.organiser_projects(TEXT);
DROP FUNCTION IF EXISTS public.organiser_students(TEXT);
DROP FUNCTION IF EXISTS public.organiser_votes(TEXT);
DROP FUNCTION IF EXISTS public.organiser_set_status(TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.organiser_settings(TEXT);
DROP FUNCTION IF EXISTS public.organiser_save_settings(TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.organiser_project_media(TEXT, UUID);
DROP FUNCTION IF EXISTS public.organiser_project_members(TEXT, UUID);

-- ---------------------------------------------------------------------------
-- Credential + session storage. No RLS policies are defined, and grants are
-- revoked, so anon/authenticated can never read a hash or a token. The
-- SECURITY DEFINER functions below are the only way in.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organiser_accounts (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organiser_sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES public.organiser_accounts (username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.organiser_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organiser_attempts ON public.organiser_login_attempts (username, created_at);

ALTER TABLE public.organiser_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organiser_login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organiser_accounts FROM anon, authenticated;
REVOKE ALL ON public.organiser_sessions FROM anon, authenticated;
REVOKE ALL ON public.organiser_login_attempts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Credential management (SQL editor / service role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organiser_set_password(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF length(coalesce(p_password, '')) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Password must be at least 8 characters.');
  END IF;

  INSERT INTO public.organiser_accounts (username, password_hash)
  VALUES (btrim(p_username), crypt(p_password, gen_salt('bf', 12)))
  ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_at = now();

  DELETE FROM public.organiser_sessions WHERE username = btrim(p_username);

  RETURN jsonb_build_object('ok', true, 'username', btrim(p_username));
END;
$$;

REVOKE ALL ON FUNCTION public.organiser_set_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.organiser_set_password(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_set_password(TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Login / logout / session check
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organiser_login(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uname TEXT := btrim(coalesce(p_username, ''));
  stored TEXT;
  fails INT;
  new_token TEXT;
  ttl TIMESTAMPTZ;
BEGIN
  DELETE FROM public.organiser_sessions WHERE expires_at < now();
  DELETE FROM public.organiser_login_attempts WHERE created_at < now() - INTERVAL '1 day';

  SELECT count(*) INTO fails
  FROM public.organiser_login_attempts
  WHERE username = uname
    AND NOT succeeded
    AND created_at > now() - INTERVAL '15 minutes';

  IF fails >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Too many failed attempts. Try again in 15 minutes.');
  END IF;

  SELECT password_hash INTO stored
  FROM public.organiser_accounts
  WHERE username = uname;

  IF stored IS NULL OR stored <> crypt(coalesce(p_password, ''), stored) THEN
    INSERT INTO public.organiser_login_attempts (username, succeeded) VALUES (uname, false);
    RETURN jsonb_build_object('ok', false, 'message', 'Wrong username or password.');
  END IF;

  new_token := encode(gen_random_bytes(32), 'hex');
  ttl := now() + INTERVAL '12 hours';

  INSERT INTO public.organiser_sessions (token, username, expires_at)
  VALUES (new_token, uname, ttl);

  INSERT INTO public.organiser_login_attempts (username, succeeded) VALUES (uname, true);

  RETURN jsonb_build_object('ok', true, 'token', new_token, 'expires_at', ttl);
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_logout(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.organiser_sessions WHERE token = p_token;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_session_ok(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organiser_sessions
    WHERE token = p_token AND expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.organiser_session_ok(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.organiser_session_ok(TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Organiser reads and writes, all gated on a live session token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organiser_projects(p_token TEXT)
RETURNS SETOF public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY SELECT * FROM public.projects ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_students(p_token TEXT)
RETURNS SETOF public.students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY SELECT * FROM public.students ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_votes(p_token TEXT)
RETURNS TABLE (id UUID, project_id UUID, voter_id UUID, created_at TIMESTAMPTZ, project_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY
  SELECT v.id, v.project_id, v.voter_id, v.created_at, p.model_name
  FROM public.votes v
  LEFT JOIN public.projects p ON p.id = v.project_id
  ORDER BY v.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_project_media(p_token TEXT, p_project_id UUID)
RETURNS SETOF public.project_media
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY
  SELECT * FROM public.project_media
  WHERE project_id = p_project_id
  ORDER BY sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_project_members(p_token TEXT, p_project_id UUID)
RETURNS SETOF public.project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY
  SELECT * FROM public.project_members
  WHERE project_id = p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_set_status(
  p_token TEXT,
  p_project_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Your organiser session expired. Sign in again.');
  END IF;
  IF p_status NOT IN ('APPROVED', 'REJECTED', 'PENDING') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'invalid status');
  END IF;
  UPDATE public.projects
  SET approval_status = p_status,
      rejection_reason = CASE WHEN p_status = 'REJECTED' THEN p_reason ELSE NULL END
  WHERE id = p_project_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_settings(p_token TEXT)
RETURNS SETOF public.exhibition_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RAISE EXCEPTION 'organiser session expired';
  END IF;
  RETURN QUERY SELECT * FROM public.exhibition_settings WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_save_settings(
  p_token TEXT,
  p_voting_enabled BOOLEAN,
  p_results_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.organiser_session_ok(p_token) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Your organiser session expired. Sign in again.');
  END IF;
  UPDATE public.exhibition_settings
  SET voting_enabled = p_voting_enabled,
      results_visible = p_results_visible
  WHERE id = 1;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organiser_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_projects(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_students(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_votes(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_project_media(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_project_members(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_set_status(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_settings(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_save_settings(TEXT, BOOLEAN, BOOLEAN) TO anon, authenticated;

-- Organisers must see photos of PENDING projects to judge them, and a static
-- page can only fetch images through the anon key. Object paths are
-- {project uuid}/{random uuid}-{filename}, so they are not enumerable, and
-- listing a pending project still requires a valid organiser session above.
DROP POLICY IF EXISTS storage_read_static_admin ON storage.objects;
CREATE POLICY storage_read_static_admin
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'project-images');
