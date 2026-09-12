-- One vote per group instead of one vote overall.
-- A voter may now vote once in Group A and once in Group B.

ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS class_group TEXT;

-- Existing votes inherit the group of the project they were cast for.
UPDATE public.votes v
SET class_group = p.class_group
FROM public.projects p
WHERE p.id = v.project_id
  AND v.class_group IS NULL;

UPDATE public.votes SET class_group = 'B' WHERE class_group IS NULL;

ALTER TABLE public.votes ALTER COLUMN class_group SET NOT NULL;

ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_class_group_check;
ALTER TABLE public.votes ADD CONSTRAINT votes_class_group_check CHECK (class_group IN ('A', 'B'));

-- Replace the single-vote guarantee with one per voter per group. The unique
-- constraint stays the source of truth for concurrent duplicate requests.
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_one_per_voter;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_one_per_voter_group;
ALTER TABLE public.votes ADD CONSTRAINT votes_one_per_voter_group UNIQUE (voter_id, class_group);

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

  window_status := public.voting_window_status();
  IF window_status = 'disabled' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'disabled');
    RETURN jsonb_build_object('ok', false, 'code', 'disabled', 'message', 'Voting is currently closed.');
  ELSIF window_status = 'not_started' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'not_started');
    RETURN jsonb_build_object('ok', false, 'code', 'not_started', 'message', 'Voting has not started yet.');
  ELSIF window_status = 'ended' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'ended');
    RETURN jsonb_build_object('ok', false, 'code', 'ended', 'message', 'Voting has ended.');
  ELSIF window_status <> 'open' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'closed');
    RETURN jsonb_build_object('ok', false, 'code', 'disabled', 'message', 'Voting is currently closed.');
  END IF;

  SELECT * INTO proj FROM public.projects WHERE id = p_project_id;
  IF proj.id IS NULL OR proj.approval_status <> 'APPROVED' THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'unavailable');
    RETURN jsonb_build_object('ok', false, 'code', 'unavailable', 'message', 'This project is not currently available for voting.');
  END IF;

  group_label := CASE WHEN proj.class_group = 'A' THEN 'Group A' ELSE 'Group B' END;
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
    'message', 'Your vote in ' || group_label || ' has been submitted.',
    'project_id', p_project_id,
    'class_group', proj.class_group
  );
END;
$$;

-- Per-group view of what the signed-in voter has already used.
-- Shape: { "A": { voted, project_id, project_name }, "B": { ... } }
-- A missing key means no vote has been cast in that group yet.
CREATE OR REPLACE FUNCTION public.my_group_votes()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  rec RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN result;
  END IF;

  FOR rec IN
    SELECT v.class_group, v.project_id, v.created_at, p.model_name
    FROM public.votes v
    JOIN public.voters vr ON vr.id = v.voter_id
    LEFT JOIN public.projects p ON p.id = v.project_id
    WHERE vr.auth_user_id = auth.uid()
  LOOP
    result := result || jsonb_build_object(
      rec.class_group,
      jsonb_build_object(
        'voted', true,
        'project_id', rec.project_id,
        'project_name', rec.model_name,
        'created_at', rec.created_at
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.my_group_votes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_group_votes() TO authenticated;
