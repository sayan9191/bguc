-- Science-only exhibition with Group A (upto class 5) and Group B (class 6+)
-- Organisation: Basirhat Ganapati Ustab Committee

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_group TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS class_group TEXT;

UPDATE public.projects
SET class_group = CASE
  WHEN class_name ~* '(^|[^0-9])([1-5]|i{1,3}|iv|v)([^0-9]|$)|nursery|kg|kg-|prep|প্রাথমিক|পঞ্চম|চতুর্থ|তৃতীয়|দ্বিতীয়|প্রথম'
    THEN 'A'
  ELSE COALESCE(class_group, 'B')
END
WHERE class_group IS NULL OR class_group NOT IN ('A', 'B');

UPDATE public.students
SET class_group = CASE
  WHEN class_name ~* '(^|[^0-9])([1-5]|i{1,3}|iv|v)([^0-9]|$)|nursery|kg|prep|প্রাথমিক|পঞ্চম|চতুর্থ|তৃতীয়|দ্বিতীয়|প্রথম'
    THEN 'A'
  ELSE COALESCE(class_group, 'B')
END
WHERE class_group IS NULL OR class_group NOT IN ('A', 'B');

UPDATE public.projects SET category = 'Science' WHERE category IS DISTINCT FROM 'Science';

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_category_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_category_check CHECK (category IN ('Science'));

ALTER TABLE public.projects ALTER COLUMN class_group SET DEFAULT 'B';
UPDATE public.projects SET class_group = 'B' WHERE class_group IS NULL;
ALTER TABLE public.projects ALTER COLUMN class_group SET NOT NULL;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_class_group_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_class_group_check CHECK (class_group IN ('A', 'B'));

ALTER TABLE public.students ALTER COLUMN class_group SET DEFAULT 'B';
UPDATE public.students SET class_group = 'B' WHERE class_group IS NULL;
ALTER TABLE public.students ALTER COLUMN class_group SET NOT NULL;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_class_group_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_class_group_check CHECK (class_group IN ('A', 'B'));

CREATE INDEX IF NOT EXISTS idx_projects_class_group ON public.projects (class_group);
CREATE INDEX IF NOT EXISTS idx_students_class_group ON public.students (class_group);

CREATE OR REPLACE FUNCTION public.generate_project_code(p_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  n := nextval('public.project_code_sci_seq');
  RETURN 'SCI-' || lpad(n::TEXT, 3, '0');
END;
$$;

UPDATE public.exhibition_settings
SET
  exhibition_name = 'Basirhat Ganapati Ustab Committee Science Exhibition',
  voting_enabled = true,
  results_visible = true,
  updated_at = now()
WHERE id = 1;

-- Test students / projects (idempotent)
INSERT INTO public.students (
  id, student_names, class_name, school_name, class_group,
  contact_number, whatsapp_number, import_fingerprint
) VALUES
  ('11111111-1111-4111-8111-111111111001', 'অর্জুন দাস, রিতু সরকার', 'Class 4', 'বসিরহাট হাই স্কুল', 'A', '9000000001', '9000000001', 'dummy|water-filter|basirhat'),
  ('11111111-1111-4111-8111-111111111002', 'মেঘা বসু', 'Class 5', 'বসিরহাট বালিকা বিদ্যালয়', 'A', '9000000002', '9000000002', 'dummy|plant-growth|balika'),
  ('11111111-1111-4111-8111-111111111003', 'সৌরভ মণ্ডল, তানিয়া ঘোষ', 'Class 7', 'বসিরহাট টাউন স্কুল', 'B', '9000000003', '9000000003', 'dummy|solar-lamp|town'),
  ('11111111-1111-4111-8111-111111111004', 'অনিকেত রায়', 'Class 9', 'বাসুদেবপুর এম এন হাই স্কুল', 'B', '9000000004', '9000000004', 'dummy|flood-alarm|mn'),
  ('11111111-1111-4111-8111-111111111005', 'প্রিয়াঞ্কা দত্ত, ইমন সেন', 'Class 8', 'বসিরহাট হাই স্কুল', 'B', '9000000005', '9000000005', 'dummy|bio-gas|bhs'),
  ('11111111-1111-4111-8111-111111111006', 'ঋত্বিক পাল', 'Class 3', 'দেবীগঞ্জ প্রাথমিক বিদ্যালয়', 'A', '9000000006', '9000000006', 'dummy|magnet-game|primary')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (
  id, project_code, model_name, description, category, class_group,
  student_id, approval_status, school_name, class_name, team_display_names, cover_image_url
) VALUES
  (
    '22222222-2222-4222-8222-222222222001',
    'SCI-101',
    'মাটির পানি ছাঁকনি',
    'বালি, নুড়ি ও কাপড় ব্যবহার করে নদীর পানি পরিষ্কার করার একটি সহজ মডেল।',
    'Science', 'A', '11111111-1111-4111-8111-111111111001', 'APPROVED',
    'বসিরহাট হাই স্কুল', 'Class 4', 'অর্জুন দাস, রিতু সরকার',
    'https://picsum.photos/seed/bguc-water/1200/800'
  ),
  (
    '22222222-2222-4222-8222-222222222002',
    'SCI-102',
    'সূর্যালোকে গাছের বৃদ্ধি',
    'ভিন্ন আলোর পরিমাণে চারা গাছ কীভাবে বাড়ে, তা দেখানো পরীক্ষা।',
    'Science', 'A', '11111111-1111-4111-8111-111111111002', 'APPROVED',
    'বসিরহাট বালিকা বিদ্যালয়', 'Class 5', 'মেঘা বসু',
    'https://picsum.photos/seed/bguc-plant/1200/800'
  ),
  (
    '22222222-2222-4222-8222-222222222003',
    'SCI-103',
    'সৌর বাতি',
    'সৌর প্যানেল দিয়ে রিচার্জযোগ্য বাতি, ঘর ও প্রদর্শনী স্টলের জন্য।',
    'Science', 'B', '11111111-1111-4111-8111-111111111003', 'APPROVED',
    'বসিরহাট টাউন স্কুল', 'Class 7', 'সৌরভ মণ্ডল, তানিয়া ঘোষ',
    'https://picsum.photos/seed/bguc-solar/1200/800'
  ),
  (
    '22222222-2222-4222-8222-222222222004',
    'SCI-104',
    'বন্যা সতর্ক অ্যালার্ম',
    'জলের স্তর বাড়লে বাজার দেয় এমন সেন্সর-ভিত্তিক মডেল।',
    'Science', 'B', '11111111-1111-4111-8111-111111111004', 'APPROVED',
    'বাসুদেবপুর এম এন হাই স্কুল', 'Class 9', 'অনিকেত রায়',
    'https://picsum.photos/seed/bguc-flood/1200/800'
  ),
  (
    '22222222-2222-4222-8222-222222222005',
    'SCI-105',
    'গোবর থেকে গ্যাস',
    'বায়োগ্যাস উৎপাদনের ছোট প্রদর্শনী মডেল।',
    'Science', 'B', '11111111-1111-4111-8111-111111111005', 'APPROVED',
    'বসিরহাট হাই স্কুল', 'Class 8', 'প্রিয়াঞ্কা দত্ত, ইমন সেন',
    'https://picsum.photos/seed/bguc-biogas/1200/800'
  ),
  (
    '22222222-2222-4222-8222-222222222006',
    'SCI-106',
    'চুম্বকের খেলা',
    'চুম্বক কীভাবে ধাতুকে আকর্ষণ করে, খেলার মাধ্যমে বিজ্ঞান।',
    'Science', 'A', '11111111-1111-4111-8111-111111111006', 'APPROVED',
    'দেবীগঞ্জ প্রাথমিক বিদ্যালয়', 'Class 3', 'ঋত্বিক পাল',
    'https://picsum.photos/seed/bguc-magnet/1200/800'
  )
ON CONFLICT (project_code) DO NOTHING;

INSERT INTO public.project_members (project_id, student_name, class_name, school_name)
SELECT p.id, m.student_name, p.class_name, p.school_name
FROM public.projects p
JOIN (VALUES
  ('SCI-101', 'অর্জুন দাস'),
  ('SCI-101', 'রিতু সরকার'),
  ('SCI-102', 'মেঘা বসু'),
  ('SCI-103', 'সৌরভ মণ্ডল'),
  ('SCI-103', 'তানিয়া ঘোষ'),
  ('SCI-104', 'অনিকেত রায়'),
  ('SCI-105', 'প্রিয়াঞ্কা দত্ত'),
  ('SCI-105', 'ইমন সেন'),
  ('SCI-106', 'ঋত্বিক পাল')
) AS m(project_code, student_name) ON m.project_code = p.project_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_members pm
  WHERE pm.project_id = p.id AND pm.student_name = m.student_name
);

SELECT public.sync_project_code_sequences();
