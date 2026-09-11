-- Live rankings for logged-in students (not gated by public results_visible).
-- Attach media without hitting insert RLS on project_media / cover updates.

CREATE OR REPLACE FUNCTION public.student_live_rankings()
RETURNS TABLE (
  project_id UUID,
  model_name TEXT,
  class_group TEXT,
  school_name TEXT,
  vote_count INT,
  rank_in_group INT,
  is_mine BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  grp TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  sid := public.student_id_for_user();
  IF sid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.class_group INTO grp
  FROM public.projects p
  WHERE p.student_id = sid
  LIMIT 1;

  IF grp IS NULL THEN
    SELECT s.class_group INTO grp FROM public.students s WHERE s.id = sid;
  END IF;

  RETURN QUERY
  WITH counts AS (
    SELECT
      p.id,
      p.model_name,
      p.class_group,
      p.school_name,
      p.student_id,
      COALESCE(v.cnt, 0)::INT AS votes
    FROM public.projects p
    LEFT JOIN (
      SELECT vo.project_id, count(*)::INT AS cnt
      FROM public.votes vo
      GROUP BY vo.project_id
    ) v ON v.project_id = p.id
    WHERE p.approval_status = 'APPROVED'
      AND (grp IS NULL OR p.class_group = grp)
  )
  SELECT
    c.id,
    c.model_name,
    c.class_group,
    c.school_name,
    c.votes,
    rank() OVER (ORDER BY c.votes DESC, c.model_name ASC)::INT,
    (c.student_id IS NOT DISTINCT FROM sid)
  FROM counts c
  ORDER BY c.votes DESC, c.model_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.student_live_rankings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_live_rankings() TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_student_media(
  p_project_id UUID,
  p_media_url TEXT,
  p_as_cover BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  st TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in first.');
  END IF;

  sid := public.student_id_for_user();
  SELECT p.approval_status INTO st
  FROM public.projects p
  WHERE p.id = p_project_id AND p.student_id = sid;

  IF st IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Project not found.');
  END IF;
  IF st = 'APPROVED' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Approved projects cannot be changed.');
  END IF;

  INSERT INTO public.project_media (project_id, media_url, media_type)
  VALUES (p_project_id, p_media_url, 'image');

  IF p_as_cover THEN
    UPDATE public.projects SET cover_image_url = p_media_url WHERE id = p_project_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_student_media(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_student_media(UUID, TEXT, BOOLEAN) TO authenticated;
