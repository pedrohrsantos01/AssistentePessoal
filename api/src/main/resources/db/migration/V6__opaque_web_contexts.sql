-- Context metadata and credential hashes remain private to Identity.
CREATE TABLE identity_web_installations (
 installation_id uuid PRIMARY KEY, created_at timestamptz NOT NULL
);
CREATE TABLE identity_web_contexts (
 context_id uuid PRIMARY KEY,
 installation_id uuid NOT NULL REFERENCES identity_web_installations(installation_id),
 attempt_id uuid NOT NULL,
 expected_account_id uuid REFERENCES users(id), user_id uuid REFERENCES users(id),
 state text NOT NULL CHECK(state IN ('reserved','authenticated','closed','expired')),
 close_secret_hash bytea CHECK(octet_length(close_secret_hash)=32),
 auth_secret_hash bytea CHECK(octet_length(auth_secret_hash)=32),
 ticket_issued_at timestamptz NOT NULL, reservation_expires_at timestamptz NOT NULL,
 close_expires_at timestamptz NOT NULL, authenticated_at timestamptz,
 last_seen_at timestamptz, absolute_expires_at timestamptz, closed_at timestamptz,
 owner_epoch bigint NOT NULL DEFAULT 0 CHECK(owner_epoch>=0), owner_tab_id uuid,
 close_reason text CHECK(close_reason IN ('logout','recovery','reset','expiry')),
 UNIQUE(installation_id,attempt_id),
 CHECK(reservation_expires_at=ticket_issued_at+interval '600 seconds'),
 CHECK(close_expires_at=ticket_issued_at+interval '2184 hours'),
 CHECK(state<>'reserved' OR (user_id IS NULL AND auth_secret_hash IS NULL AND authenticated_at IS NULL AND last_seen_at IS NULL AND absolute_expires_at IS NULL)),
 CHECK(state<>'authenticated' OR (user_id IS NOT NULL AND close_secret_hash IS NOT NULL AND auth_secret_hash IS NOT NULL AND authenticated_at IS NOT NULL AND last_seen_at IS NOT NULL AND absolute_expires_at IS NOT NULL AND owner_tab_id IS NOT NULL AND owner_epoch>0)),
 CHECK(authenticated_at IS NULL OR (user_id IS NOT NULL AND absolute_expires_at=authenticated_at+interval '2160 hours' AND absolute_expires_at<close_expires_at AND last_seen_at>=authenticated_at AND last_seen_at<absolute_expires_at))
);
CREATE UNIQUE INDEX identity_web_close_hash ON identity_web_contexts(close_secret_hash) WHERE close_secret_hash IS NOT NULL;
CREATE UNIQUE INDEX identity_web_auth_hash ON identity_web_contexts(auth_secret_hash) WHERE auth_secret_hash IS NOT NULL;
CREATE INDEX identity_web_installation_state ON identity_web_contexts(installation_id,state);
CREATE INDEX identity_web_user_state ON identity_web_contexts(user_id,state);
CREATE INDEX identity_web_reservation_expiry ON identity_web_contexts(reservation_expires_at);
CREATE INDEX identity_web_close_expiry ON identity_web_contexts(close_expires_at);
REVOKE ALL ON identity_web_installations,identity_web_contexts FROM PUBLIC,ritmo_domain;
GRANT SELECT,INSERT,UPDATE,DELETE ON identity_web_installations,identity_web_contexts TO ritmo_identity;

-- Fixed-length comparison with no content-dependent early return.
CREATE FUNCTION identity_web_hash_matches(left_hash bytea,right_hash bytea) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE difference integer:=0;
BEGIN
 IF left_hash IS NULL OR right_hash IS NULL OR octet_length(left_hash)<>32 OR octet_length(right_hash)<>32 THEN RETURN false; END IF;
 FOR i IN 0..31 LOOP difference:=difference | (get_byte(left_hash,i) # get_byte(right_hash,i)); END LOOP;
 RETURN difference=0;
END $$;
REVOKE ALL ON FUNCTION identity_web_hash_matches(bytea,bytea) FROM PUBLIC;

-- FORCE RLS also applies to a non-superuser migration owner. The predicate
-- permits ONLY the current table owner, not runtime roles. No SELECT/UPDATE
-- grants are added. Resolve the owner from catalogs rather than naming its
-- source role: pg_restore --no-owner must work under a different target owner.
CREATE POLICY web_authorizer_owner ON users
 USING (current_user=(SELECT pg_catalog.pg_get_userbyid(c.relowner) FROM pg_catalog.pg_class c WHERE c.oid='public.users'::regclass))
 WITH CHECK (current_user=(SELECT pg_catalog.pg_get_userbyid(c.relowner) FROM pg_catalog.pg_class c WHERE c.oid='public.users'::regclass));

-- Domain calls this on its own transaction/connection. User then context locks are
-- retained until the actual command commits. No identity table SELECT is granted.
-- The first call validates; after account quota succeeds the second call touches idle.
CREATE FUNCTION identity_authorize_web_context(target uuid,credential bytea,expected_user uuid,epoch bigint,tab uuid,touch boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE account uuid; context public.identity_web_contexts%ROWTYPE; at_time timestamptz;
BEGIN
 SELECT c.user_id INTO account FROM public.identity_web_contexts c WHERE c.context_id=target;
 IF account IS NULL THEN RETURN jsonb_build_object('error','session_invalid'); END IF;
 PERFORM u.id FROM public.users u WHERE u.id=account AND u.deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','session_invalid'); END IF;
 SELECT c.* INTO context FROM public.identity_web_contexts c WHERE c.context_id=target AND c.user_id=account FOR UPDATE;
 at_time:=clock_timestamp();
 IF NOT FOUND OR context.state<>'authenticated' OR NOT public.identity_web_hash_matches(context.auth_secret_hash,credential)
    OR at_time>=context.absolute_expires_at OR at_time>=context.last_seen_at+interval '720 hours' THEN
  RETURN jsonb_build_object('error','session_invalid');
 END IF;
 IF expected_user IS DISTINCT FROM account THEN RETURN jsonb_build_object('error','account_mismatch'); END IF;
 IF epoch IS DISTINCT FROM context.owner_epoch OR tab IS DISTINCT FROM context.owner_tab_id THEN RETURN jsonb_build_object('error','owner_lost'); END IF;
 IF touch THEN UPDATE public.identity_web_contexts SET last_seen_at=greatest(last_seen_at,at_time) WHERE context_id=target AND user_id=account; END IF;
 RETURN jsonb_build_object('userId',account);
END $$;
REVOKE ALL ON FUNCTION identity_authorize_web_context(uuid,bytea,uuid,bigint,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity_authorize_web_context(uuid,bytea,uuid,bigint,uuid,boolean) TO ritmo_domain;
