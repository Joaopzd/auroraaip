REVOKE EXECUTE ON FUNCTION public.verify_notification_scheduler_secret(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_notification_scheduler_secret(text) TO service_role;