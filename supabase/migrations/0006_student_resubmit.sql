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
