-- ========== 0001_schema.sql ==========
-- Ganesh Puja Science & Art Exhibition
-- Schema, constraints, sequences, and triggers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations via CHECK constraints (portable, explicit)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'voter' CHECK (role IN ('student', 'admin', 'voter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles (id) ON DELETE SET NULL,
  student_names TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  contact_number TEXT,
  whatsapp_number TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  import_fingerprint TEXT UNIQUE,
  original_registration_at TIMESTAMPTZ,
  raw_import JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  model_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Science', 'Art')),
  student_id UUID REFERENCES public.students (id) ON DELETE SET NULL,
  approval_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  cover_image_url TEXT,
  video_url TEXT,
  school_name TEXT,
  class_name TEXT,
  team_display_names TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  class_name TEXT,
  school_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES public.voters (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT votes_one_per_voter UNIQUE (voter_id)
);

CREATE TABLE public.exhibition_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  exhibition_name TEXT NOT NULL DEFAULT 'Ganesh Puja Science & Art Exhibition',
  voting_enabled BOOLEAN NOT NULL DEFAULT false,
  voting_start TIMESTAMPTZ,
  voting_end TIMESTAMPTZ,
  results_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vote_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id UUID,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.project_code_sci_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.project_code_art_seq START WITH 1 INCREMENT BY 1;

INSERT INTO public.exhibition_settings (id, exhibition_name, voting_enabled, results_visible)
VALUES (1, 'Ganesh Puja Science & Art Exhibition', false, false)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_students_profile ON public.students (profile_id);
CREATE INDEX idx_students_school ON public.students (school_name);
CREATE INDEX idx_students_class ON public.students (class_name);
CREATE INDEX idx_projects_student ON public.projects (student_id);
CREATE INDEX idx_projects_status ON public.projects (approval_status);
CREATE INDEX idx_projects_category ON public.projects (category);
CREATE INDEX idx_projects_code ON public.projects (project_code);
CREATE INDEX idx_project_members_project ON public.project_members (project_id);
CREATE INDEX idx_project_media_project ON public.project_media (project_id);
CREATE INDEX idx_votes_project ON public.votes (project_id);
CREATE INDEX idx_votes_created ON public.votes (created_at);
CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_vote_attempts_user_time ON public.vote_attempts (auth_user_id, created_at DESC);
CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_role ON public.profiles (role);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_students_updated
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_settings_updated
BEFORE UPDATE ON public.exhibition_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_project_code(p_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  IF p_category = 'Science' THEN
    n := nextval('public.project_code_sci_seq');
    RETURN 'SCI-' || lpad(n::TEXT, 3, '0');
  ELSIF p_category = 'Art' THEN
    n := nextval('public.project_code_art_seq');
    RETURN 'ART-' || lpad(n::TEXT, 3, '0');
  ELSE
    RAISE EXCEPTION 'Invalid category %', p_category;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_code IS NULL OR btrim(NEW.project_code) = '' THEN
    NEW.project_code := public.generate_project_code(NEW.category);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_code
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.assign_project_code();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    'voter'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE
          WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
          THEN EXCLUDED.full_name
          ELSE public.profiles.full_name
        END;

  INSERT INTO public.voters (auth_user_id)
  VALUES (NEW.id)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_project_code_sequences()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  sci_max INT;
  art_max INT;
BEGIN
  SELECT COALESCE(max(substring(project_code FROM 5)::INT), 0)
    INTO sci_max
  FROM public.projects
  WHERE project_code ~ '^SCI-[0-9]+$';

  SELECT COALESCE(max(substring(project_code FROM 5)::INT), 0)
    INTO art_max
  FROM public.projects
  WHERE project_code ~ '^ART-[0-9]+$';

  PERFORM setval('public.project_code_sci_seq', GREATEST(sci_max, 1), sci_max > 0);
  PERFORM setval('public.project_code_art_seq', GREATEST(art_max, 1), art_max > 0);
END;
$$;


-- ========== 0002_rls.sql ==========
-- Helper functions and Row Level Security

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.student_id_for_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.student_owns_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.students s ON s.id = p.student_id
    WHERE p.id = p_project_id
      AND s.profile_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_id_for_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_owns_project(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_id_for_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_owns_project(UUID) TO authenticated, anon;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_attempts ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Students: never expose contact fields to public/anon via table access
CREATE POLICY students_select_own_or_admin ON public.students
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY students_update_own ON public.students
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY students_insert_own ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR public.is_admin());

CREATE POLICY students_admin_all ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Projects: public can read APPROVED only
CREATE POLICY projects_public_read_approved ON public.projects
  FOR SELECT TO anon, authenticated
  USING (
    approval_status = 'APPROVED'
    OR public.is_admin()
    OR public.student_owns_project(id)
  );

CREATE POLICY projects_student_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR student_id = public.student_id_for_user()
  );

CREATE POLICY projects_student_update_pending ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.student_owns_project(id)
      AND approval_status = 'PENDING'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.student_owns_project(id)
      AND approval_status = 'PENDING'
    )
  );

CREATE POLICY projects_admin_delete ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Members / media follow project visibility
CREATE POLICY members_select ON public.project_members
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.approval_status = 'APPROVED'
          OR public.is_admin()
          OR public.student_owns_project(p.id)
        )
    )
  );

CREATE POLICY members_write_owner ON public.project_members
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.student_owns_project(project_id))
  WITH CHECK (public.is_admin() OR public.student_owns_project(project_id));

CREATE POLICY media_select ON public.project_media
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.approval_status = 'APPROVED'
          OR public.is_admin()
          OR public.student_owns_project(p.id)
        )
    )
  );

CREATE POLICY media_write_owner ON public.project_media
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.student_owns_project(project_id))
  WITH CHECK (public.is_admin() OR public.student_owns_project(project_id));

-- Voters
CREATE POLICY voters_select_own ON public.voters
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY voters_insert_own ON public.voters
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Votes: no updates, no deletes, no reading other voters' identities
CREATE POLICY votes_select_admin_or_own ON public.votes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR voter_id IN (SELECT id FROM public.voters WHERE auth_user_id = auth.uid())
  );

CREATE POLICY votes_no_direct_insert ON public.votes
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY votes_no_update ON public.votes
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY votes_no_delete ON public.votes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Settings: public may read (needed to know if voting is open / results visible)
CREATE POLICY settings_read ON public.exhibition_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY settings_admin_update ON public.exhibition_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Audit logs: admin only
CREATE POLICY audit_admin_all ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY vote_attempts_admin_read ON public.vote_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin() OR auth_user_id = auth.uid());

CREATE POLICY vote_attempts_insert_own ON public.vote_attempts
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() OR public.is_admin());


-- ========== 0003_functions.sql ==========
-- Secure RPCs for voting, claiming student records, admin actions

CREATE OR REPLACE FUNCTION public.ensure_voter()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.voters (auth_user_id)
  VALUES (auth.uid())
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_id FROM public.voters WHERE auth_user_id = auth.uid();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.voting_window_status()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.exhibition_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.exhibition_settings WHERE id = 1;
  IF s IS NULL THEN
    RETURN 'closed';
  END IF;
  IF NOT s.voting_enabled THEN
    RETURN 'disabled';
  END IF;
  IF s.voting_start IS NOT NULL AND now() < s.voting_start THEN
    RETURN 'not_started';
  END IF;
  IF s.voting_end IS NOT NULL AND now() > s.voting_end THEN
    RETURN 'ended';
  END IF;
  RETURN 'open';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_vote(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  window_status TEXT;
  proj public.projects%ROWTYPE;
  existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'You must sign in with Google to vote.');
  END IF;

  -- Rate limit: more than 8 attempts in 60 seconds
  IF (
    SELECT count(*) FROM public.vote_attempts
    WHERE auth_user_id = auth.uid()
      AND created_at > now() - interval '60 seconds'
  ) >= 8 THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome)
    VALUES (auth.uid(), p_project_id, 'rate_limited');
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'Too many attempts. Please wait a moment and try again.');
  END IF;

  window_status := public.voting_window_status();
  IF window_status = 'disabled' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'disabled');
    RETURN jsonb_build_object('ok', false, 'code', 'disabled', 'message', 'Voting is currently closed.');
  ELSIF window_status = 'not_started' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'not_started');
    RETURN jsonb_build_object('ok', false, 'code', 'not_started', 'message', 'Voting has not started yet.');
  ELSIF window_status = 'ended' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'ended');
    RETURN jsonb_build_object('ok', false, 'code', 'ended', 'message', 'Voting has ended.');
  ELSIF window_status <> 'open' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'closed');
    RETURN jsonb_build_object('ok', false, 'code', 'disabled', 'message', 'Voting is currently closed.');
  END IF;

  SELECT * INTO proj FROM public.projects WHERE id = p_project_id;
  IF proj.id IS NULL OR proj.approval_status <> 'APPROVED' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'unavailable');
    RETURN jsonb_build_object('ok', false, 'code', 'unavailable', 'message', 'This project is not currently available for voting.');
  END IF;

  v_id := public.ensure_voter();

  SELECT id INTO existing FROM public.votes WHERE voter_id = v_id;
  IF existing IS NOT NULL THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
    RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted. Each person can vote only once.');
  END IF;

  BEGIN
    INSERT INTO public.votes (voter_id, project_id)
    VALUES (v_id, p_project_id);
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
      RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted. Each person can vote only once.');
  END;

  INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'success');

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'success',
    'message', 'Your vote has been successfully submitted.',
    'project_id', p_project_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.my_vote()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('voted', false);
  END IF;

  SELECT v.project_id, v.created_at, p.model_name
    INTO rec
  FROM public.votes v
  JOIN public.voters vr ON vr.id = v.voter_id
  JOIN public.projects p ON p.id = v.project_id
  WHERE vr.auth_user_id = auth.uid()
  LIMIT 1;

  IF rec.project_id IS NULL THEN
    RETURN jsonb_build_object('voted', false);
  END IF;

  RETURN jsonb_build_object(
    'voted', true,
    'project_id', rec.project_id,
    'project_name', rec.model_name,
    'created_at', rec.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_vote_counts()
RETURNS TABLE (project_id UUID, vote_count INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  visible BOOLEAN;
BEGIN
  SELECT results_visible INTO visible FROM public.exhibition_settings WHERE id = 1;
  IF COALESCE(visible, false) = false AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.project_id, count(*)::INT
  FROM public.votes v
  GROUP BY v.project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_student_record(
  p_project_code TEXT,
  p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.students%ROWTYPE;
  digits TEXT;
  stored TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Sign in first.');
  END IF;

  digits := regexp_replace(COALESCE(p_contact, ''), '[^0-9]', '', 'g');

  SELECT st.* INTO s
  FROM public.students st
  JOIN public.projects p ON p.student_id = st.id
  WHERE upper(p.project_code) = upper(btrim(p_project_code))
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No registration matched that project code.');
  END IF;

  stored := regexp_replace(COALESCE(s.contact_number, '') || COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g');
  IF digits = '' OR stored NOT LIKE '%' || digits || '%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'mismatch', 'message', 'Contact number does not match this registration.');
  END IF;

  IF s.profile_id IS NOT NULL AND s.profile_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked', 'message', 'This registration is already linked to another account.');
  END IF;

  UPDATE public.students
  SET profile_id = auth.uid()
  WHERE id = s.id;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN s.student_names ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', s.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_names TEXT,
  p_class_name TEXT,
  p_school_name TEXT,
  p_contact TEXT,
  p_whatsapp TEXT,
  p_guardian_name TEXT,
  p_guardian_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in first.');
  END IF;

  SELECT id INTO existing FROM public.students WHERE profile_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'student_id', existing);
  END IF;

  INSERT INTO public.students (
    profile_id, student_names, class_name, school_name,
    contact_number, whatsapp_number, guardian_name, guardian_contact
  ) VALUES (
    auth.uid(), btrim(p_student_names), btrim(p_class_name), btrim(p_school_name),
    btrim(p_contact), btrim(p_whatsapp), nullif(btrim(p_guardian_name), ''), nullif(btrim(p_guardian_contact), '')
  )
  RETURNING id INTO new_id;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN btrim(p_student_names) ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_project_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_admin() THEN
      INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
      VALUES (auth.uid(), 'project_deleted', 'project', OLD.id::text, jsonb_build_object('code', OLD.project_code));
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      CASE NEW.approval_status
        WHEN 'APPROVED' THEN 'project_approved'
        WHEN 'REJECTED' THEN 'project_rejected'
        ELSE 'project_status_changed'
      END,
      'project',
      NEW.id::text,
      jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status)
    );
  ELSIF public.is_admin() AND TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'project_edited', 'project', NEW.id::text, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_projects
AFTER UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.audit_project_changes();

CREATE OR REPLACE FUNCTION public.audit_settings_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.voting_enabled IS DISTINCT FROM OLD.voting_enabled THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN NEW.voting_enabled THEN 'voting_enabled' ELSE 'voting_disabled' END,
      'settings',
      '1',
      jsonb_build_object('voting_enabled', NEW.voting_enabled)
    );
  ELSE
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'settings_changed', 'settings', '1', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_settings
AFTER UPDATE ON public.exhibition_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_settings_changes();

REVOKE ALL ON FUNCTION public.submit_vote(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_voter() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_student_record(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_new_student(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_vote() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_vote_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.voting_window_status() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_voter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_record(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_new_student(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_vote() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_vote_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voting_window_status() TO anon, authenticated;


-- ========== 0004_storage.sql ==========
-- Storage buckets and policies
-- Object path convention: {project_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'project-images',
    'project-images',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'project-media',
    'project-media',
    false,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
  )
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.storage_project_id(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  folder TEXT;
BEGIN
  folder := split_part(object_name, '/', 1);
  BEGIN
    RETURN folder::UUID;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE POLICY storage_read_approved_or_owner
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id IN ('project-images', 'project-media')
  AND (
    public.is_admin()
    OR public.student_owns_project(public.storage_project_id(name))
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = public.storage_project_id(name)
        AND p.approval_status = 'APPROVED'
    )
  )
);

CREATE POLICY storage_insert_owner
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('project-images', 'project-media')
  AND (
    public.is_admin()
    OR public.student_owns_project(public.storage_project_id(name))
  )
);

CREATE POLICY storage_update_owner
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('project-images', 'project-media')
  AND (public.is_admin() OR public.student_owns_project(public.storage_project_id(name)))
)
WITH CHECK (
  bucket_id IN ('project-images', 'project-media')
  AND (public.is_admin() OR public.student_owns_project(public.storage_project_id(name)))
);

CREATE POLICY storage_delete_owner
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('project-images', 'project-media')
  AND (public.is_admin() OR public.student_owns_project(public.storage_project_id(name)))
);


-- ========== 0005_hardening.sql ==========
-- Prevent client-side role escalation. Privileged RPCs set app.allow_role_change.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('app.allow_role_change', true) = 'on' THEN
      RETURN NEW;
    END IF;
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- Votes are immutable. Admins must use a documented SQL action if a vote must be removed.
DROP POLICY IF EXISTS votes_no_delete ON public.votes;
CREATE POLICY votes_no_delete ON public.votes
  FOR DELETE TO authenticated
  USING (false);

-- Allow role change inside claim/register RPCs
CREATE OR REPLACE FUNCTION public.claim_student_record(
  p_project_code TEXT,
  p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.students%ROWTYPE;
  digits TEXT;
  stored TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Sign in first.');
  END IF;

  digits := regexp_replace(COALESCE(p_contact, ''), '[^0-9]', '', 'g');

  SELECT st.* INTO s
  FROM public.students st
  JOIN public.projects p ON p.student_id = st.id
  WHERE upper(p.project_code) = upper(btrim(p_project_code))
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No registration matched that project code.');
  END IF;

  stored := regexp_replace(COALESCE(s.contact_number, '') || COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g');
  IF digits = '' OR (
    regexp_replace(COALESCE(s.contact_number, ''), '[^0-9]', '', 'g') NOT LIKE '%' || right(digits, 10) || '%'
    AND regexp_replace(COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g') NOT LIKE '%' || right(digits, 10) || '%'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'mismatch', 'message', 'Contact number does not match this registration.');
  END IF;

  IF s.profile_id IS NOT NULL AND s.profile_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked', 'message', 'This registration is already linked to another account.');
  END IF;

  UPDATE public.students
  SET profile_id = auth.uid()
  WHERE id = s.id;

  PERFORM set_config('app.allow_role_change', 'on', true);
  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN s.student_names ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', s.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_names TEXT,
  p_class_name TEXT,
  p_school_name TEXT,
  p_contact TEXT,
  p_whatsapp TEXT,
  p_guardian_name TEXT,
  p_guardian_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in first.');
  END IF;

  SELECT id INTO existing FROM public.students WHERE profile_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'student_id', existing);
  END IF;

  INSERT INTO public.students (
    profile_id, student_names, class_name, school_name,
    contact_number, whatsapp_number, guardian_name, guardian_contact
  ) VALUES (
    auth.uid(), btrim(p_student_names), btrim(p_class_name), btrim(p_school_name),
    btrim(p_contact), btrim(p_whatsapp), nullif(btrim(p_guardian_name), ''), nullif(btrim(p_guardian_contact), '')
  )
  RETURNING id INTO new_id;

  PERFORM set_config('app.allow_role_change', 'on', true);
  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN btrim(p_student_names) ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', new_id);
END;
$$;


-- ========== 0006_student_resubmit.sql ==========
DROP POLICY IF EXISTS projects_student_update_pending ON public.projects;

CREATE POLICY projects_student_update_pending ON public.projects
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.student_owns_project(id)
      AND approval_status IN ('PENDING', 'REJECTED')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.student_owns_project(id)
      AND approval_status = 'PENDING'
    )
  );


-- ========== 0007_ensure_profile.sql ==========
CREATE OR REPLACE FUNCTION public.ensure_voter()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  u_email TEXT;
  u_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
    INTO u_email, u_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (auth.uid(), u_email, COALESCE(u_name, ''), 'voter')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.voters (auth_user_id)
  VALUES (auth.uid())
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_id FROM public.voters WHERE auth_user_id = auth.uid();
  RETURN v_id;
END;
$$;


-- ========== 0008_grants.sql ==========
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.projects, public.project_members, public.project_media, public.exhibition_settings
  TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.generate_project_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_project_code_sequences() TO authenticated;
