-- Students (and other email/password users) can sign in immediately.
-- Confirmation emails may still send until "Confirm email" is turned off in
-- Authentication → Providers → Email.

CREATE OR REPLACE FUNCTION public.auto_confirm_auth_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_auth_email ON auth.users;
CREATE TRIGGER trg_auto_confirm_auth_email
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_auth_email();
