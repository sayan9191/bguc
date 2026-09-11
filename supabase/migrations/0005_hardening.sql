-- Prevent client-side role escalation. Privileged RPCs set app.allow_role_change.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('app.allow_role_change', true) = 'on' THEN
      RETURN NEW;
    END IF;
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- Votes are immutable. Admins must use a documented SQL action if a vote must be removed.
DROP POLICY IF EXISTS votes_no_delete ON public.votes;
CREATE POLICY votes_no_delete ON public.votes
  FOR DELETE TO authenticated
  USING (false);

-- Allow role change inside claim/register RPCs
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
  IF digits = '' OR (
    regexp_replace(COALESCE(s.contact_number, ''), '[^0-9]', '', 'g') NOT LIKE '%' || right(digits, 10) || '%'
    AND regexp_replace(COALESCE(s.whatsapp_number, ''), '[^0-9]', '', 'g') NOT LIKE '%' || right(digits, 10) || '%'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'mismatch', 'message', 'Contact number does not match this registration.');
  END IF;

  IF s.profile_id IS NOT NULL AND s.profile_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'linked', 'message', 'This registration is already linked to another account.');
  END IF;

  UPDATE public.students
  SET profile_id = auth.uid()
  WHERE id = s.id;

  PERFORM set_config('app.allow_role_change', 'on', true);
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

  PERFORM set_config('app.allow_role_change', 'on', true);
  UPDATE public.profiles
  SET role = CASE WHEN role = 'admin' THEN role ELSE 'student' END,
      full_name = CASE WHEN full_name = '' THEN btrim(p_student_names) ELSE full_name END
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'student_id', new_id);
END;
$$;
