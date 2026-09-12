-- Group-wise voting windows, an attendance register for the exhibition days,
-- and the richer admin reads behind them.
--
-- Run after 0015_vote_per_group.sql and 0016_open_organiser.sql.
-- Like 0016, every organiser_* function here is open to anon because the admin
-- panel has no login. That now includes voter names and email addresses.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'class_group'
  ) THEN
    RAISE EXCEPTION 'Run 0015_vote_per_group.sql first, then 0016, then this file.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Per-group voting window
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.group_voting (
  class_group TEXT PRIMARY KEY CHECK (class_group IN ('A', 'B')),
  voting_enabled BOOLEAN NOT NULL DEFAULT false,
  voting_start TIMESTAMPTZ,
  voting_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.group_voting (class_group) VALUES ('A'), ('B')
ON CONFLICT (class_group) DO NOTHING;

ALTER TABLE public.group_voting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.group_voting FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Exhibition days and attendance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exhibition_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_group TEXT NOT NULL CHECK (class_group IN ('A', 'B')),
  day DATE NOT NULL,
  label TEXT,
  UNIQUE (class_group, day)
);

-- Group A exhibits on the 14th and 15th, Group B on the 17th and 18th.
INSERT INTO public.exhibition_days (class_group, day) VALUES
  ('A', DATE '2026-09-14'),
  ('A', DATE '2026-09-15'),
  ('B', DATE '2026-09-17'),
  ('B', DATE '2026-09-18')
ON CONFLICT (class_group, day) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  day DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'EXPECTED' CHECK (status IN ('EXPECTED', 'PRESENT', 'ABSENT')),
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, day)
);

ALTER TABLE public.exhibition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.exhibition_days FROM anon, authenticated;
REVOKE ALL ON TABLE public.attendance FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Voting window, now decided per group
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.group_voting_status(p_class_group TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  master BOOLEAN;
  g public.group_voting%ROWTYPE;
BEGIN
  -- The global switch stays a master kill switch over both groups.
  SELECT voting_enabled INTO master FROM public.exhibition_settings WHERE id = 1;
  IF COALESCE(master, false) = false THEN
    RETURN 'disabled';
  END IF;

  SELECT * INTO g FROM public.group_voting WHERE class_group = p_class_group;
  IF g.class_group IS NULL OR g.voting_enabled = false THEN
    RETURN 'disabled';
  END IF;
  IF g.voting_start IS NOT NULL AND now() < g.voting_start THEN
    RETURN 'not_started';
  END IF;
  IF g.voting_end IS NOT NULL AND now() > g.voting_end THEN
    RETURN 'ended';
  END IF;
  RETURN 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.group_voting_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_voting_status(TEXT) TO anon, authenticated;

-- The project must be known before the window can be checked, so the order of
-- the guards differs from the original single-window version.
CREATE OR REPLACE FUNCTION public.submit_vote(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  window_status TEXT;
  proj public.projects%ROWTYPE;
  existing UUID;
  group_label TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'You must sign in with Google to vote.');
  END IF;

  IF (
    SELECT count(*) FROM public.vote_attempts
    WHERE auth_user_id = auth.uid()
      AND created_at > now() - interval '60 seconds'
  ) >= 8 THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome)
    VALUES (auth.uid(), p_project_id, 'rate_limited');
    RETURN jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'Too many attempts. Please wait a moment and try again.');
  END IF;

  SELECT * INTO proj FROM public.projects WHERE id = p_project_id;
  IF proj.id IS NULL OR proj.approval_status <> 'APPROVED' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'unavailable');
    RETURN jsonb_build_object('ok', false, 'code', 'unavailable', 'message', 'This project is not currently available for voting.');
  END IF;

  group_label := CASE WHEN proj.class_group = 'A' THEN 'Group A' ELSE 'Group B' END;
  window_status := public.group_voting_status(proj.class_group);

  IF window_status = 'not_started' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'not_started');
    RETURN jsonb_build_object('ok', false, 'code', 'not_started', 'message', 'Voting for ' || group_label || ' has not started yet.');
  ELSIF window_status = 'ended' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'ended');
    RETURN jsonb_build_object('ok', false, 'code', 'ended', 'message', 'Voting for ' || group_label || ' has ended.');
  ELSIF window_status <> 'open' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'disabled');
    RETURN jsonb_build_object('ok', false, 'code', 'disabled', 'message', 'Voting for ' || group_label || ' is currently closed.');
  END IF;

  v_id := public.ensure_voter();

  SELECT id INTO existing
  FROM public.votes
  WHERE voter_id = v_id AND class_group = proj.class_group;

  IF existing IS NOT NULL THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'already_voted',
      'message', 'You have already voted in ' || group_label || '. Each person can vote once in each group.'
    );
  END IF;

  BEGIN
    INSERT INTO public.votes (voter_id, project_id, class_group)
    VALUES (v_id, p_project_id, proj.class_group);
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'already_voted',
        'message', 'You have already voted in ' || group_label || '. Each person can vote once in each group.'
      );
  END;

  INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'success');

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'success',
    'message', 'Your ' || group_label || ' vote has been submitted.',
    'project_id', p_project_id,
    'class_group', proj.class_group
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin reads and writes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organiser_group_voting()
RETURNS SETOF public.group_voting
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.group_voting ORDER BY class_group;
$$;

CREATE OR REPLACE FUNCTION public.organiser_save_group_voting(
  p_class_group TEXT,
  p_voting_enabled BOOLEAN,
  p_voting_start TIMESTAMPTZ DEFAULT NULL,
  p_voting_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_class_group NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Group must be A or B.');
  END IF;
  IF p_voting_start IS NOT NULL AND p_voting_end IS NOT NULL AND p_voting_end <= p_voting_start THEN
    RETURN jsonb_build_object('ok', false, 'message', 'End date must be after the start date.');
  END IF;

  INSERT INTO public.group_voting (class_group, voting_enabled, voting_start, voting_end, updated_at)
  VALUES (p_class_group, p_voting_enabled, p_voting_start, p_voting_end, now())
  ON CONFLICT (class_group) DO UPDATE
  SET voting_enabled = EXCLUDED.voting_enabled,
      voting_start = EXCLUDED.voting_start,
      voting_end = EXCLUDED.voting_end,
      updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Everything the project detail screen shows, in one call.
CREATE OR REPLACE FUNCTION public.organiser_project_detail(p_project_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'project', to_jsonb(p),
    'student', to_jsonb(s),
    'members', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM public.project_members m WHERE m.project_id = p.id),
      '[]'::JSONB
    ),
    'media', COALESCE(
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order) FROM public.project_media d WHERE d.project_id = p.id),
      '[]'::JSONB
    ),
    'vote_count', (SELECT count(*) FROM public.votes v WHERE v.project_id = p.id)
  )
  FROM public.projects p
  LEFT JOIN public.students s ON s.id = p.student_id
  WHERE p.id = p_project_id;
$$;

-- Voter identity lives in auth.users, which only a definer function can read.
DROP FUNCTION IF EXISTS public.organiser_votes();
CREATE FUNCTION public.organiser_votes()
RETURNS TABLE (
  vote_id UUID,
  created_at TIMESTAMPTZ,
  class_group TEXT,
  project_id UUID,
  project_code TEXT,
  project_name TEXT,
  voter_name TEXT,
  voter_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.created_at,
    v.class_group,
    v.project_id,
    p.project_code,
    p.model_name,
    COALESCE(
      NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(u.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    COALESCE(u.email, '')
  FROM public.votes v
  LEFT JOIN public.projects p ON p.id = v.project_id
  LEFT JOIN public.voters vr ON vr.id = v.voter_id
  LEFT JOIN auth.users u ON u.id = vr.auth_user_id
  ORDER BY v.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.organiser_vote_totals()
RETURNS TABLE (
  project_id UUID,
  project_code TEXT,
  project_name TEXT,
  class_group TEXT,
  vote_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.project_code, p.model_name, p.class_group, count(v.id)::INT
  FROM public.projects p
  LEFT JOIN public.votes v ON v.project_id = p.id
  WHERE p.approval_status = 'APPROVED'
  GROUP BY p.id, p.project_code, p.model_name, p.class_group
  ORDER BY count(v.id) DESC, p.model_name;
$$;

-- One row per approved project per exhibition day of its group.
CREATE OR REPLACE FUNCTION public.organiser_attendance(p_class_group TEXT DEFAULT NULL)
RETURNS TABLE (
  project_id UUID,
  project_code TEXT,
  project_name TEXT,
  class_group TEXT,
  class_name TEXT,
  school_name TEXT,
  team_display_names TEXT,
  contact_number TEXT,
  whatsapp_number TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  day DATE,
  status TEXT,
  note TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.project_code,
    p.model_name,
    p.class_group,
    p.class_name,
    p.school_name,
    p.team_display_names,
    s.contact_number,
    s.whatsapp_number,
    s.guardian_name,
    s.guardian_contact,
    d.day,
    COALESCE(a.status, 'EXPECTED'),
    a.note
  FROM public.projects p
  JOIN public.exhibition_days d ON d.class_group = p.class_group
  LEFT JOIN public.students s ON s.id = p.student_id
  LEFT JOIN public.attendance a ON a.project_id = p.id AND a.day = d.day
  WHERE p.approval_status = 'APPROVED'
    AND (p_class_group IS NULL OR p.class_group = p_class_group)
  ORDER BY p.class_group, d.day, p.model_name;
$$;

CREATE OR REPLACE FUNCTION public.organiser_set_attendance(
  p_project_id UUID,
  p_day DATE,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('EXPECTED', 'PRESENT', 'ABSENT') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Status must be EXPECTED, PRESENT or ABSENT.');
  END IF;

  INSERT INTO public.attendance (project_id, day, status, note, updated_at)
  VALUES (p_project_id, p_day, p_status, NULLIF(btrim(COALESCE(p_note, '')), ''), now())
  ON CONFLICT (project_id, day) DO UPDATE
  SET status = EXCLUDED.status,
      note = EXCLUDED.note,
      updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.organiser_exhibition_days()
RETURNS SETOF public.exhibition_days
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.exhibition_days ORDER BY class_group, day;
$$;

GRANT EXECUTE ON FUNCTION public.organiser_group_voting() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_save_group_voting(TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_project_detail(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_votes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_vote_totals() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_attendance(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_set_attendance(UUID, DATE, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.organiser_exhibition_days() TO anon, authenticated;
