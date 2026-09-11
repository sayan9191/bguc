-- Ganesh Puja Science & Art Exhibition
-- Schema, constraints, sequences, and triggers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations via CHECK constraints (portable, explicit)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'voter' CHECK (role IN ('student', 'admin', 'voter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles (id) ON DELETE SET NULL,
  student_names TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  contact_number TEXT,
  whatsapp_number TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  import_fingerprint TEXT UNIQUE,
  original_registration_at TIMESTAMPTZ,
  raw_import JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  model_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Science', 'Art')),
  student_id UUID REFERENCES public.students (id) ON DELETE SET NULL,
  approval_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  cover_image_url TEXT,
  video_url TEXT,
  school_name TEXT,
  class_name TEXT,
  team_display_names TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  class_name TEXT,
  school_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES public.voters (id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT votes_one_per_voter UNIQUE (voter_id)
);

CREATE TABLE public.exhibition_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  exhibition_name TEXT NOT NULL DEFAULT 'Ganesh Puja Science & Art Exhibition',
  voting_enabled BOOLEAN NOT NULL DEFAULT false,
  voting_start TIMESTAMPTZ,
  voting_end TIMESTAMPTZ,
  results_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vote_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id UUID,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.project_code_sci_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE public.project_code_art_seq START WITH 1 INCREMENT BY 1;

INSERT INTO public.exhibition_settings (id, exhibition_name, voting_enabled, results_visible)
VALUES (1, 'Ganesh Puja Science & Art Exhibition', false, false)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_students_profile ON public.students (profile_id);
CREATE INDEX idx_students_school ON public.students (school_name);
CREATE INDEX idx_students_class ON public.students (class_name);
CREATE INDEX idx_projects_student ON public.projects (student_id);
CREATE INDEX idx_projects_status ON public.projects (approval_status);
CREATE INDEX idx_projects_category ON public.projects (category);
CREATE INDEX idx_projects_code ON public.projects (project_code);
CREATE INDEX idx_project_members_project ON public.project_members (project_id);
CREATE INDEX idx_project_media_project ON public.project_media (project_id);
CREATE INDEX idx_votes_project ON public.votes (project_id);
CREATE INDEX idx_votes_created ON public.votes (created_at);
CREATE INDEX idx_audit_created ON public.audit_logs (created_at DESC);
CREATE INDEX idx_vote_attempts_user_time ON public.vote_attempts (auth_user_id, created_at DESC);
CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_role ON public.profiles (role);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_students_updated
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_settings_updated
BEFORE UPDATE ON public.exhibition_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_project_code(p_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  IF p_category = 'Science' THEN
    n := nextval('public.project_code_sci_seq');
    RETURN 'SCI-' || lpad(n::TEXT, 3, '0');
  ELSIF p_category = 'Art' THEN
    n := nextval('public.project_code_art_seq');
    RETURN 'ART-' || lpad(n::TEXT, 3, '0');
  ELSE
    RAISE EXCEPTION 'Invalid category %', p_category;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_code IS NULL OR btrim(NEW.project_code) = '' THEN
    NEW.project_code := public.generate_project_code(NEW.category);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_code
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.assign_project_code();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    'voter'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE
          WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
          THEN EXCLUDED.full_name
          ELSE public.profiles.full_name
        END;

  INSERT INTO public.voters (auth_user_id)
  VALUES (NEW.id)
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_project_code_sequences()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  sci_max INT;
  art_max INT;
BEGIN
  SELECT COALESCE(max(substring(project_code FROM 5)::INT), 0)
    INTO sci_max
  FROM public.projects
  WHERE project_code ~ '^SCI-[0-9]+$';

  SELECT COALESCE(max(substring(project_code FROM 5)::INT), 0)
    INTO art_max
  FROM public.projects
  WHERE project_code ~ '^ART-[0-9]+$';

  PERFORM setval('public.project_code_sci_seq', GREATEST(sci_max, 1), sci_max > 0);
  PERFORM setval('public.project_code_art_seq', GREATEST(art_max, 1), art_max > 0);
END;
$$;
