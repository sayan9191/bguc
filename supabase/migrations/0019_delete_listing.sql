-- Admin can delete a project from the group-wise list.
-- Run after 0018_three_votes_and_tables.sql.

CREATE OR REPLACE FUNCTION public.organiser_delete_listing(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gone UUID;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Project is required.');
  END IF;

  DELETE FROM public.projects
  WHERE id = p_project_id
  RETURNING id INTO gone;

  IF gone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Project not found.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organiser_delete_listing(UUID) TO anon, authenticated;
