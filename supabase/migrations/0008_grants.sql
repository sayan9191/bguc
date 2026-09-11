GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.projects, public.project_members, public.project_media, public.exhibition_settings
  TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.generate_project_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_project_code_sequences() TO authenticated;
