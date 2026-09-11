ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mentor_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mentor_name TEXT;

CREATE OR REPLACE FUNCTION public.student_project_is_approved()
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
    WHERE s.profile_id = auth.uid()
      AND p.approval_status = 'APPROVED'
  );
$$;

REVOKE ALL ON FUNCTION public.student_project_is_approved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_project_is_approved() TO authenticated;

DROP POLICY IF EXISTS students_update_own ON public.students;
CREATE POLICY students_update_own ON public.students
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND NOT public.student_project_is_approved())
  WITH CHECK (profile_id = auth.uid() AND NOT public.student_project_is_approved());

DROP FUNCTION IF EXISTS public.submit_student_project(TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.submit_student_project(
  p_model_name TEXT,
  p_description TEXT,
  p_class_group TEXT,
  p_team_display_names TEXT,
  p_project_id UUID DEFAULT NULL,
  p_mentor_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  pid UUID;
  grp TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in first.');
  END IF;

  sid := public.student_id_for_user();
  IF sid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Save your details first.');
  END IF;

  grp := CASE WHEN p_class_group = 'A' THEN 'A' ELSE 'B' END;

  IF p_project_id IS NULL THEN
    INSERT INTO public.projects (
      model_name, description, category, class_group,
      class_name, school_name, team_display_names, mentor_name,
      student_id, approval_status
    )
    SELECT
      btrim(p_model_name),
      btrim(p_description),
      'Science',
      grp,
      st.class_name,
      st.school_name,
      nullif(btrim(p_team_display_names), ''),
      nullif(btrim(coalesce(p_mentor_name, '')), ''),
      sid,
      'PENDING'
    FROM public.students st
    WHERE st.id = sid
    RETURNING id INTO pid;
  ELSE
    UPDATE public.projects p
    SET
      model_name = btrim(p_model_name),
      description = btrim(p_description),
      class_group = grp,
      team_display_names = nullif(btrim(p_team_display_names), ''),
      mentor_name = nullif(btrim(coalesce(p_mentor_name, '')), ''),
      class_name = st.class_name,
      school_name = st.school_name,
      approval_status = 'PENDING'
    FROM public.students st
    WHERE p.id = p_project_id
      AND p.student_id = sid
      AND st.id = sid
      AND p.approval_status IN ('PENDING', 'REJECTED')
    RETURNING p.id INTO pid;

    IF pid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Could not update this project.');
    END IF;
  END IF;

  DELETE FROM public.project_members WHERE project_id = pid;
  INSERT INTO public.project_members (project_id, student_name, class_name, school_name)
  SELECT pid, btrim(n), st.class_name, st.school_name
  FROM unnest(string_to_array(coalesce(p_team_display_names, ''), ',')) AS n
  CROSS JOIN public.students st
  WHERE st.id = sid
    AND btrim(n) <> '';

  RETURN jsonb_build_object('ok', true, 'project_id', pid);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_student_project(TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_student_project(TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
