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
