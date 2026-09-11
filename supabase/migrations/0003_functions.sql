-- Secure RPCs for voting, claiming student records, admin actions

CREATE OR REPLACE FUNCTION public.ensure_voter()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.voters (auth_user_id)
  VALUES (auth.uid())
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_id FROM public.voters WHERE auth_user_id = auth.uid();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.voting_window_status()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.exhibition_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.exhibition_settings WHERE id = 1;
  IF s IS NULL THEN
    RETURN 'closed';
  END IF;
  IF NOT s.voting_enabled THEN
    RETURN 'disabled';
  END IF;
  IF s.voting_start IS NOT NULL AND now() < s.voting_start THEN
    RETURN 'not_started';
  END IF;
  IF s.voting_end IS NOT NULL AND now() > s.voting_end THEN
    RETURN 'ended';
  END IF;
  RETURN 'open';
END;
$$;

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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'You must sign in with Google to vote.');
  END IF;

  -- Rate limit: more than 8 attempts in 60 seconds
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

  v_id := public.ensure_voter();

  SELECT id INTO existing FROM public.votes WHERE voter_id = v_id;
  IF existing IS NOT NULL THEN
    INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
    RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted. Each person can vote only once.');
  END IF;

  BEGIN
    INSERT INTO public.votes (voter_id, project_id)
    VALUES (v_id, p_project_id);
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'already_voted');
      RETURN jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You have already voted. Each person can vote only once.');
  END;

  INSERT INTO public.vote_attempts (auth_user_id, project_id, outcome) VALUES (auth.uid(), p_project_id, 'success');

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'success',
    'message', 'Your vote has been successfully submitted.',
    'project_id', p_project_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.my_vote()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('voted', false);
  END IF;

  SELECT v.project_id, v.created_at, p.model_name
    INTO rec
  FROM public.votes v
  JOIN public.voters vr ON vr.id = v.voter_id
  JOIN public.projects p ON p.id = v.project_id
  WHERE vr.auth_user_id = auth.uid()
  LIMIT 1;

  IF rec.project_id IS NULL THEN
    RETURN jsonb_build_object('voted', false);
  END IF;

  RETURN jsonb_build_object(
    'voted', true,
    'project_id', rec.project_id,
    'project_name', rec.model_name,
    'created_at', rec.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_vote_counts()
RETURNS TABLE (project_id UUID, vote_count INT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  visible BOOLEAN;
BEGIN
  SELECT results_visible INTO visible FROM public.exhibition_settings WHERE id = 1;
  IF COALESCE(visible, false) = false AND NOT public.is_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v.project_id, count(*)::INT
  FROM public.votes v
  GROUP BY v.project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_student_record(
  p_project_code TEXT,
  p_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.students%ROWTYPE;
  digits TEXT;
  stored TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated', 'message', 'Sign in first.');
  END IF;

  digits := regexp_replace(COALESCE(p_contact, ''), '[^0-9]', '', 'g');

  SELECT st.* INTO s
  FROM public.students st
  JOIN public.projects p ON p.student_id = st.id
  WHERE upper(p.project_code) = upper(btrim(p_project_code))
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No registration matched that project code.');
  END IF;

  stored := regexp_replace(COALESCE(s.contact_number, '') || COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g');
  IF digits = '' OR stored NOT LIKE '%' || digits || '%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'mismatch', 'message', 'Contact number does not match this registration.');
  END IF;

  IF s.profile_id IS NOT NULL AND s.profile_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked', 'message', 'This registration is already linked to another account.');
  END IF;

  UPDATE public.students
  SET profile_id = auth.uid()
  WHERE id = s.id;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN s.student_names ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', s.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_new_student(
  p_student_names TEXT,
  p_class_name TEXT,
  p_school_name TEXT,
  p_contact TEXT,
  p_whatsapp TEXT,
  p_guardian_name TEXT,
  p_guardian_contact TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sign in first.');
  END IF;

  SELECT id INTO existing FROM public.students WHERE profile_id = auth.uid();
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'student_id', existing);
  END IF;

  INSERT INTO public.students (
    profile_id, student_names, class_name, school_name,
    contact_number, whatsapp_number, guardian_name, guardian_contact
  ) VALUES (
    auth.uid(), btrim(p_student_names), btrim(p_class_name), btrim(p_school_name),
    btrim(p_contact), btrim(p_whatsapp), nullif(btrim(p_guardian_name), ''), nullif(btrim(p_guardian_contact), '')
  )
  RETURNING id INTO new_id;

  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN btrim(p_student_names) ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.write_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_project_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_admin() THEN
      INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
      VALUES (auth.uid(), 'project_deleted', 'project', OLD.id::text, jsonb_build_object('code', OLD.project_code));
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      CASE NEW.approval_status
        WHEN 'APPROVED' THEN 'project_approved'
        WHEN 'REJECTED' THEN 'project_rejected'
        ELSE 'project_status_changed'
      END,
      'project',
      NEW.id::text,
      jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status)
    );
  ELSIF public.is_admin() AND TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'project_edited', 'project', NEW.id::text, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_projects
AFTER UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.audit_project_changes();

CREATE OR REPLACE FUNCTION public.audit_settings_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.voting_enabled IS DISTINCT FROM OLD.voting_enabled THEN
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN NEW.voting_enabled THEN 'voting_enabled' ELSE 'voting_disabled' END,
      'settings',
      '1',
      jsonb_build_object('voting_enabled', NEW.voting_enabled)
    );
  ELSE
    INSERT INTO public.audit_logs (admin_user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'settings_changed', 'settings', '1', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_settings
AFTER UPDATE ON public.exhibition_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_settings_changes();

REVOKE ALL ON FUNCTION public.submit_vote(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_voter() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_student_record(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_new_student(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_vote() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_vote_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.voting_window_status() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_vote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_voter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_record(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_new_student(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_vote() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_vote_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voting_window_status() TO anon, authenticated;
