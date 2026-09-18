CREATE OR REPLACE FUNCTION public.verify_notification_scheduler_secret(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_scheduler_config
    WHERE singleton = true
      AND secret::text = candidate
  );
$fn$;
REVOKE ALL ON FUNCTION public.verify_notification_scheduler_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_notification_scheduler_secret(text) TO anon, authenticated, service_role;