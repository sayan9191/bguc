-- Requested change: the admin panel no longer has a username/password login.
--
-- WARNING, read before running. Removing the login means these functions can
-- no longer identify an organiser, so they are granted to anon. The anon key
-- is public in bguc/js/config.js, therefore ANYONE on the internet can:
--   * read every student's contact_number, whatsapp_number and guardian_*
--   * approve or reject any project
--   * open or close voting and publish results
--
-- TO PUT THE LOGIN BACK: run 0014_static_organiser.sql again, then run the
-- DROP statements at the bottom of this file to remove the open versions.
--
-- ORDER MATTERS: 0015_vote_per_group.sql must be run before this file,
-- because organiser_votes() below reads votes.class_group.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'class_group'
  ) THEN
    RAISE EXCEPTION 'Run 0015_vote_per_group.sql first, then run this file.';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.organiser_projects(TEXT);
DROP FUNCTION IF EXISTS public.organiser_students(TEXT);
DROP FUNCTION IF EXISTS public.organiser_votes(TEXT);
DROP FUNCTION IF EXISTS public.organiser_project_media(TEXT, UUID);
DROP FUNCTION IF EXISTS public.organiser_project_members(TEXT, UUID);
DROP FUNCTION IF EXISTS public.organiser_set_status(TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.organiser_settings(TEXT);
DROP FUNCTION IF EXISTS public.organiser_save_settings(TEXT, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.organiser_projects()
RETURNS SETOF public.projects
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.projects ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.organiser_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.students ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.organiser_votes()
RETURNS TABLE (id UUID, project_id UUID, voter_id UUID, created_at TIMESTAMPTZ, class_group TEXT, project_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.project_id, v.voter_id, v.created_at, v.class_group, p.model_name
  FROM public.votes v
  LEFT JOIN public.projects p ON p.id = v.project_id
  ORDER BY v.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.organiser_project_media(p_project_id UUID)
RETURNS SETOF public.project_media
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.project_media
  WHERE project_id = p_project_id
  ORDER BY sort_order;
$$;

CREATE OR REPLACE FUNCTION public.organiser_project_members(p_project_id UUID)
RETURNS SETOF public.project_members
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.project_members WHERE project_id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION public.organiser_set_status(
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

CREATE OR REPLACE FUNCTION public.organiser_settings()
RETURNS SETOF public.exhibition_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.exhibition_settings WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.organiser_save_settings(
  p_voting_enabled BOOLEAN,
  p_results_visible BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exhibition_settings
  SET voting_enabled = p_voting_enabled,
      results_visible = p_results_visible
  WHERE id = 1;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organiser_projects() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_students() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_votes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_project_media(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_project_members(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_set_status(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_save_settings(BOOLEAN, BOOLEAN) TO anon, authenticated;

-- Revert block. Run these, then re-run 0014_static_organiser.sql.
-- DROP FUNCTION IF EXISTS public.organiser_projects();
-- DROP FUNCTION IF EXISTS public.organiser_students();
-- DROP FUNCTION IF EXISTS public.organiser_votes();
-- DROP FUNCTION IF EXISTS public.organiser_project_media(UUID);
-- DROP FUNCTION IF EXISTS public.organiser_project_members(UUID);
-- DROP FUNCTION IF EXISTS public.organiser_set_status(UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.organiser_settings();
-- DROP FUNCTION IF EXISTS public.organiser_save_settings(BOOLEAN, BOOLEAN);
