-- 3 votes per group. Run this after 0017. It replaces the old
-- "one vote in each group" rule that 0017 puts back.

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
    RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted for this project.');
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
      RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted for this project.');
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
