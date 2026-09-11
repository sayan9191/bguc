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
