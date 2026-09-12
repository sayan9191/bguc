-- DEMO DATA. THIS DELETES EVERYTHING FIRST. Do not run on real event data.
--
-- Run in the Supabase SQL editor after 0015, 0016 and 0017. It wipes all
-- students, projects, media, votes and attendance, then builds a full set of
-- demo records so every admin table has something to show.
--
-- Your own Google/email logins are NOT touched. Only the accounts this script
-- creates (ending in @demo.bguc.test) are removed and rebuilt, so you can run
-- it as many times as you like.
--
-- Photos point at picsum.photos, so no file uploads are needed.
--
-- After it finishes you should have:
--   Projects   8 rows (6 approved, 1 pending, 1 rejected)
--   Votes      24 rows from 12 voters with names and emails
--   Totals     A01 5, A02 4, A03 3, B01 6, B02 4, B03 2
--   Attendance 7 marked rows across both groups
--
-- The file must end on the final COMMIT. Do not add trailing comments: the SQL
-- editor splits on semicolons and would send them as an empty statement,
-- which fails with "syntax error at end of input".

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Clear old data
-- ---------------------------------------------------------------------------

DELETE FROM public.vote_attempts;
DELETE FROM public.votes;
DELETE FROM public.attendance;
DELETE FROM public.project_media;
DELETE FROM public.project_members;
DELETE FROM public.projects;
DELETE FROM public.students;
DELETE FROM public.voters;
DELETE FROM auth.users WHERE email LIKE '%@demo.bguc.test';

-- ---------------------------------------------------------------------------
-- 2. Twelve demo voters (these become the names and emails on the Votes page)
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  ('11111111-1111-4111-8111-' || lpad(n::TEXT, 12, '0'))::UUID,
  'authenticated',
  'authenticated',
  'voter' || n || '@demo.bguc.test',
  crypt('demo1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::JSONB,
  jsonb_build_object('full_name', name),
  now() - (n || ' hours')::INTERVAL,
  now()
FROM unnest(ARRAY[
  'Anita Ghosh', 'Bikash Das', 'Chaitali Roy', 'Debjit Sarkar',
  'Esha Mondal', 'Farhan Sheikh', 'Gouri Dutta', 'Hiranmoy Pal',
  'Ipsita Bose', 'Jayanta Haldar', 'Kakoli Bera', 'Lalit Naskar'
]) WITH ORDINALITY AS t(name, n);

INSERT INTO public.voters (id, auth_user_id)
SELECT
  ('22222222-2222-4222-8222-' || substr(u.id::TEXT, 25))::UUID,
  u.id
FROM auth.users u
WHERE u.email LIKE '%@demo.bguc.test';

-- ---------------------------------------------------------------------------
-- 3. Students. Classes 1-5 are Group A, class 6 and above are Group B.
-- ---------------------------------------------------------------------------

INSERT INTO public.students
  (id, student_names, class_name, class_group, school_name, mentor_name,
   contact_number, whatsapp_number, guardian_name, guardian_contact)
VALUES
  ('33333333-3333-4333-8333-000000000001', 'Riya Saha', '3', 'A', 'Basirhat Primary School', 'Mrs. S. Banerjee', '9812345601', '9812345601', 'Amit Saha', '9812345611'),
  ('33333333-3333-4333-8333-000000000002', 'Arnab Ghosh, Tia Ghosh', '4', 'A', 'Sunrise Academy', 'Mr. P. Roy', '9812345602', '9812345602', 'Sujata Ghosh', '9812345612'),
  ('33333333-3333-4333-8333-000000000003', 'Mitali Das', '5', 'A', 'Basirhat Primary School', 'Mrs. R. Khatun', '9812345603', NULL, 'Nirmal Das', '9812345613'),
  ('33333333-3333-4333-8333-000000000004', 'Sohom Pal', '2', 'A', 'Little Scholars School', NULL, '9812345604', '9812345604', 'Rekha Pal', '9812345614'),
  ('33333333-3333-4333-8333-000000000005', 'Priyanka Dutta, Iman Sen', '8', 'B', 'Basirhat High School', 'Mr. K. Mondal', '9812345605', '9812345605', 'Bimal Dutta', '9812345615'),
  ('33333333-3333-4333-8333-000000000006', 'Rahul Biswas', '9', 'B', 'Basirhat High School', 'Mrs. A. Sen', '9812345606', NULL, 'Tapan Biswas', '9812345616'),
  ('33333333-3333-4333-8333-000000000007', 'Sneha Kar, Ujjal Kar', '7', 'B', 'Deviganj High School', 'Mr. D. Ghosh', '9812345607', '9812345607', 'Malati Kar', '9812345617'),
  ('33333333-3333-4333-8333-000000000008', 'Tanmoy Halder', '11', 'B', 'Deviganj High School', 'Mr. S. Kundu', '9812345608', '9812345608', 'Gopal Halder', '9812345618');

-- ---------------------------------------------------------------------------
-- 4. Projects: six approved, one pending, one rejected
-- ---------------------------------------------------------------------------

INSERT INTO public.projects
  (id, project_code, model_name, description, category, student_id, approval_status,
   class_group, class_name, school_name, team_display_names, mentor_name,
   cover_image_url, rejection_reason)
VALUES
  ('44444444-4444-4444-8444-000000000001', 'BGUC-A01', 'Erupting Volcano Model',
   'A clay volcano that erupts using baking soda and vinegar. The model shows the magma chamber, the vent and the layers of lava that build a cone over time, and explains why some volcanoes erupt gently while others explode.',
   'Science', '33333333-3333-4333-8333-000000000001', 'APPROVED', 'A', '3',
   'Basirhat Primary School', 'Riya Saha', 'Mrs. S. Banerjee',
   'https://picsum.photos/seed/volcano/900/700', NULL),

  ('44444444-4444-4444-8444-000000000002', 'BGUC-A02', 'Solar System Mobile',
   'A hanging model of the eight planets to scale by colour and relative size, turned by a small motor so the planets circle the sun. Labels explain the order of the planets and which ones have rings.',
   'Science', '33333333-3333-4333-8333-000000000002', 'APPROVED', 'A', '4',
   'Sunrise Academy', 'Arnab Ghosh, Tia Ghosh', 'Mr. P. Roy',
   'https://picsum.photos/seed/planets/900/700', NULL),

  ('44444444-4444-4444-8444-000000000003', 'BGUC-A03', 'Clay Ganesha Art Panel',
   'A hand moulded clay panel of Ganesha finished with natural colours made from turmeric, beetroot and indigo, showing how festival art can avoid plastic paints.',
   'Art', '33333333-3333-4333-8333-000000000003', 'APPROVED', 'A', '5',
   'Basirhat Primary School', 'Mitali Das', 'Mrs. R. Khatun',
   'https://picsum.photos/seed/clayart/900/700', NULL),

  ('44444444-4444-4444-8444-000000000004', 'BGUC-A04', 'Paper Windmill',
   'A paper windmill on a bamboo stand that lifts a small weight when air is blown at it, used to explain how wind turbines turn moving air into useful work.',
   'Science', '33333333-3333-4333-8333-000000000004', 'PENDING', 'A', '2',
   'Little Scholars School', 'Sohom Pal', NULL,
   'https://picsum.photos/seed/windmill/900/700', NULL),

  ('44444444-4444-4444-8444-000000000005', 'BGUC-B01', 'Biogas From Cow Dung',
   'A sealed drum digester that collects the gas given off by cow dung and burns it on a small stove. The board explains the bacteria involved, how long the process takes, and how the leftover slurry is used as fertiliser.',
   'Science', '33333333-3333-4333-8333-000000000005', 'APPROVED', 'B', '8',
   'Basirhat High School', 'Priyanka Dutta, Iman Sen', 'Mr. K. Mondal',
   'https://picsum.photos/seed/biogas/900/700', NULL),

  ('44444444-4444-4444-8444-000000000006', 'BGUC-B02', 'Smart Dustbin',
   'A dustbin whose lid opens on its own using an ultrasonic sensor and a servo motor, so nobody has to touch it. A buzzer sounds when the bin is nearly full.',
   'Science', '33333333-3333-4333-8333-000000000006', 'APPROVED', 'B', '9',
   'Basirhat High School', 'Rahul Biswas', 'Mrs. A. Sen',
   'https://picsum.photos/seed/dustbin/900/700', NULL),

  ('44444444-4444-4444-8444-000000000007', 'BGUC-B03', 'Low Cost Water Purifier',
   'A layered filter of gravel, sand, charcoal and cloth that clears muddy pond water. The team measured turbidity before and after each layer and recorded the results on a chart.',
   'Science', '33333333-3333-4333-8333-000000000007', 'APPROVED', 'B', '7',
   'Deviganj High School', 'Sneha Kar, Ujjal Kar', 'Mr. D. Ghosh',
   'https://picsum.photos/seed/waterfilter/900/700', NULL),

  ('44444444-4444-4444-8444-000000000008', 'BGUC-B04', 'Magnet Marble Game',
   'A board game steered by magnets under the table.',
   'Science', '33333333-3333-4333-8333-000000000008', 'REJECTED', 'B', '11',
   'Deviganj High School', 'Tanmoy Halder', 'Mr. S. Kundu',
   'https://picsum.photos/seed/magnet/900/700', 'Description is too short and no working model was shown.');

-- ---------------------------------------------------------------------------
-- 5. Team members
-- ---------------------------------------------------------------------------

INSERT INTO public.project_members (project_id, student_name, class_name, school_name)
VALUES
  ('44444444-4444-4444-8444-000000000002', 'Arnab Ghosh', '4', 'Sunrise Academy'),
  ('44444444-4444-4444-8444-000000000002', 'Tia Ghosh', '4', 'Sunrise Academy'),
  ('44444444-4444-4444-8444-000000000005', 'Priyanka Dutta', '8', 'Basirhat High School'),
  ('44444444-4444-4444-8444-000000000005', 'Iman Sen', '8', 'Basirhat High School'),
  ('44444444-4444-4444-8444-000000000007', 'Sneha Kar', '7', 'Deviganj High School'),
  ('44444444-4444-4444-8444-000000000007', 'Ujjal Kar', '7', 'Deviganj High School');

-- ---------------------------------------------------------------------------
-- 6. Extra photos so the card slider has something to rotate through
-- ---------------------------------------------------------------------------

INSERT INTO public.project_media (project_id, media_url, media_type, sort_order)
VALUES
  ('44444444-4444-4444-8444-000000000001', 'https://picsum.photos/seed/volcano2/900/700', 'image', 1),
  ('44444444-4444-4444-8444-000000000001', 'https://picsum.photos/seed/volcano3/900/700', 'image', 2),
  ('44444444-4444-4444-8444-000000000002', 'https://picsum.photos/seed/planets2/900/700', 'image', 1),
  ('44444444-4444-4444-8444-000000000003', 'https://picsum.photos/seed/clayart2/900/700', 'image', 1),
  ('44444444-4444-4444-8444-000000000005', 'https://picsum.photos/seed/biogas2/900/700', 'image', 1),
  ('44444444-4444-4444-8444-000000000005', 'https://picsum.photos/seed/biogas3/900/700', 'image', 2),
  ('44444444-4444-4444-8444-000000000006', 'https://picsum.photos/seed/dustbin2/900/700', 'image', 1),
  ('44444444-4444-4444-8444-000000000007', 'https://picsum.photos/seed/waterfilter2/900/700', 'image', 1);

-- ---------------------------------------------------------------------------
-- 7. Votes. Every demo voter uses one Group A vote and one Group B vote,
--    which is exactly what the live rule allows.
--    Group A: A01 gets 5, A02 gets 4, A03 gets 3.
--    Group B: B01 gets 6, B02 gets 4, B03 gets 2.
-- ---------------------------------------------------------------------------

WITH ranked AS (
  SELECT v.id, row_number() OVER (ORDER BY u.email) AS n
  FROM public.voters v
  JOIN auth.users u ON u.id = v.auth_user_id
  WHERE u.email LIKE '%@demo.bguc.test'
)
INSERT INTO public.votes (voter_id, project_id, class_group, created_at)
SELECT
  r.id,
  CASE
    WHEN r.n <= 5 THEN '44444444-4444-4444-8444-000000000001'::UUID
    WHEN r.n <= 9 THEN '44444444-4444-4444-8444-000000000002'::UUID
    ELSE '44444444-4444-4444-8444-000000000003'::UUID
  END,
  'A',
  now() - (r.n || ' hours')::INTERVAL
FROM ranked r;

WITH ranked AS (
  SELECT v.id, row_number() OVER (ORDER BY u.email) AS n
  FROM public.voters v
  JOIN auth.users u ON u.id = v.auth_user_id
  WHERE u.email LIKE '%@demo.bguc.test'
)
INSERT INTO public.votes (voter_id, project_id, class_group, created_at)
SELECT
  r.id,
  CASE
    WHEN r.n <= 6 THEN '44444444-4444-4444-8444-000000000005'::UUID
    WHEN r.n <= 10 THEN '44444444-4444-4444-8444-000000000006'::UUID
    ELSE '44444444-4444-4444-8444-000000000007'::UUID
  END,
  'B',
  now() - (r.n || ' minutes')::INTERVAL
FROM ranked r;

-- ---------------------------------------------------------------------------
-- 8. Attendance, with a mix so the counters are not all the same
-- ---------------------------------------------------------------------------

INSERT INTO public.attendance (project_id, day, status, note)
VALUES
  ('44444444-4444-4444-8444-000000000001', DATE '2026-09-14', 'PRESENT', NULL),
  ('44444444-4444-4444-8444-000000000002', DATE '2026-09-14', 'PRESENT', NULL),
  ('44444444-4444-4444-8444-000000000003', DATE '2026-09-14', 'ABSENT', 'Phoned guardian, child unwell'),
  ('44444444-4444-4444-8444-000000000001', DATE '2026-09-15', 'PRESENT', NULL),
  ('44444444-4444-4444-8444-000000000005', DATE '2026-09-17', 'PRESENT', NULL),
  ('44444444-4444-4444-8444-000000000006', DATE '2026-09-17', 'ABSENT', 'No answer on either number'),
  ('44444444-4444-4444-8444-000000000007', DATE '2026-09-17', 'PRESENT', NULL);

-- ---------------------------------------------------------------------------
-- 9. Open voting for both groups so the demo can actually vote
-- ---------------------------------------------------------------------------

INSERT INTO public.exhibition_settings (id, voting_enabled, results_visible)
VALUES (1, true, true)
ON CONFLICT (id) DO UPDATE
SET voting_enabled = true, results_visible = true;

INSERT INTO public.group_voting (class_group, voting_enabled, voting_start, voting_end)
VALUES
  ('A', true, now() - INTERVAL '1 hour', now() + INTERVAL '7 days'),
  ('B', true, now() - INTERVAL '1 hour', now() + INTERVAL '7 days')
ON CONFLICT (class_group) DO UPDATE
SET voting_enabled = true,
    voting_start = EXCLUDED.voting_start,
    voting_end = EXCLUDED.voting_end,
    updated_at = now();

COMMIT;
