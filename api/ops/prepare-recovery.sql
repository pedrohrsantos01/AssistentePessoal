-- All accounts, only as migration owner/administrator with clients and writers isolated.
-- Existing credential fields; never change passwords, domain facts or receipts.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT FROM pg_catalog.pg_roles r WHERE r.rolname=current_user AND
   (r.rolsuper OR (SELECT count(*)=4 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relowner=r.oid
     AND c.relname IN ('identity_sessions','identity_refresh_tokens','identity_password_resets','identity_web_contexts')))
 ) THEN
  RAISE EXCEPTION 'recovery_requires_migration_owner';
 END IF;
END $$;
LOCK TABLE public.identity_sessions,public.identity_refresh_tokens,public.identity_password_resets,public.identity_web_contexts IN ACCESS EXCLUSIVE MODE;
UPDATE public.identity_sessions SET revoked_at=now() WHERE revoked_at IS NULL;
UPDATE public.identity_refresh_tokens SET revoked_at=now() WHERE revoked_at IS NULL;
UPDATE public.identity_password_resets SET used_at=now() WHERE used_at IS NULL;

UPDATE public.identity_web_contexts SET state='closed',closed_at=coalesce(closed_at,now()),close_reason='reset'
 WHERE state IN ('reserved','authenticated');
