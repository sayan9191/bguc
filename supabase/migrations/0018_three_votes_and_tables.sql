-- 3 votes per group, a table number on each project, and admin add/edit
-- for the voting list (title, student names, group, table 1-25).
--
-- Run after 0015, 0016 and 0017.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'class_group'
  ) THEN
    RAISE EXCEPTION 'Run 0015_vote_per_group.sql, then 0016, then 0017, then this file.';
  END IF;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS table_number INT;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_table_number_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_table_number_check
  CHECK (table_number IS NULL OR (table_number >= 1 AND table_number <= 25));

-- One person may now vote for up to 3 different projects in each group.
-- They still cannot vote for the same project twice.
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_one_per_voter;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_one_per_voter_group;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_one_per_project;
ALTER TABLE public.votes ADD CONSTRAINT votes_one_per_project UNIQUE (voter_id, project_id);

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
  already UUID;
  used INT;
  group_label TEXT;
  vote_limit INT := 3;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'You must sign in with Google to vote.');
  END IF;

  IF (
    SELECT count(*) FROM public.vote_attempts
    WHERE auth_user_id = auth.uid()
      AND created_at > now() - interval '60 seconds'
  ) >= 16 THEN
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
  PERFORM 1 FROM public.voters WHERE id = v_id FOR UPDATE;

  SELECT id INTO already
  FROM public.votes
  WHERE voter_id = v_id AND project_id = p_project_id;

  IF already IS NOT NULL THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'already_voted',
      'message', 'You have already voted for this project.'
    );
  END IF;

  SELECT count(*) INTO used
  FROM public.votes
  WHERE voter_id = v_id AND class_group = proj.class_group;

  IF used >= vote_limit THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'limit_reached');
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'limit_reached',
      'message', 'You have already used all 3 of your ' || group_label || ' votes.'
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
        'message', 'You have already voted for this project.'
      );
  END;

  INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'success');

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'success',
    'project_id', p_project_id,
    'class_group', proj.class_group,
    'used', used + 1,
    'limit', vote_limit
  );
END;
$$;

-- Shape: { "A": { used, limit, project_ids }, "B": { ... } }
CREATE OR REPLACE FUNCTION public.my_group_votes()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"A":{"used":0,"limit":3,"project_ids":[]},"B":{"used":0,"limit":3,"project_ids":[]}}'::JSONB;
  rec RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN result;
  END IF;

  FOR rec IN
    SELECT v.class_group, coalesce(jsonb_agg(v.project_id), '[]'::JSONB) AS ids
    FROM public.votes v
    JOIN public.voters vr ON vr.id = v.voter_id
    WHERE vr.auth_user_id = auth.uid()
      AND v.class_group IN ('A', 'B')
    GROUP BY v.class_group
  LOOP
    result := jsonb_set(
      result,
      ARRAY[rec.class_group],
      jsonb_build_object(
        'used', jsonb_array_length(rec.ids),
        'limit', 3,
        'project_ids', rec.ids
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.my_group_votes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_group_votes() TO authenticated;

CREATE OR REPLACE FUNCTION public.organiser_save_listing(
  p_model_name TEXT,
  p_student_names TEXT,
  p_class_group TEXT,
  p_table_number INT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  title TEXT := btrim(coalesce(p_model_name, ''));
  names TEXT := btrim(coalesce(p_student_names, ''));
  saved UUID;
BEGIN
  IF title = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Project title is required.');
  END IF;
  IF names = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Student name is required.');
  END IF;
  IF p_class_group NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Group must be A or B.');
  END IF;
  IF p_table_number IS NOT NULL AND (p_table_number < 1 OR p_table_number > 25) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Table number must be between 1 and 25.');
  END IF;

  IF p_project_id IS NULL THEN
    INSERT INTO public.projects (
      project_code, model_name, description, category, approval_status,
      class_group, class_name, school_name, team_display_names, table_number
    ) VALUES (
      public.generate_project_code('Science'),
      title,
      '',
      'Science',
      'APPROVED',
      p_class_group,
      '',
      '',
      names,
      p_table_number
    )
    RETURNING id INTO saved;
  ELSE
    UPDATE public.projects
    SET model_name = title,
        team_display_names = names,
        class_group = p_class_group,
        table_number = p_table_number,
        updated_at = now()
    WHERE id = p_project_id
    RETURNING id INTO saved;

    IF saved IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Project not found.');
    END IF;

    UPDATE public.students
    SET student_names = names, updated_at = now()
    WHERE id = (SELECT student_id FROM public.projects WHERE id = saved);
  END IF;

  RETURN jsonb_build_object('ok', true, 'project_id', saved);
END;
$$;

GRANT EXECUTE ON FUNCTION public.organiser_save_listing(TEXT, TEXT, TEXT, INT, UUID) TO anon, authenticated;
