-- Apply after creating the first admin auth user:
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'ADMIN_EMAIL';
-- This file is documentation-only and is not applied automatically.

SELECT 'Use the SQL in README.md to promote an admin. Never hardcode passwords.' AS note;
