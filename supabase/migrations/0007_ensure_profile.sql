CREATE OR REPLACE FUNCTION public.ensure_voter()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  u_email TEXT;
  u_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')
    INTO u_email, u_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (auth.uid(), u_email, COALESCE(u_name, ''), 'voter')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.voters (auth_user_id)
  VALUES (auth.uid())
  ON CONFLICT (auth_user_id) DO NOTHING;

  SELECT id INTO v_id FROM public.voters WHERE auth_user_id = auth.uid();
  RETURN v_id;
END;
$$;
