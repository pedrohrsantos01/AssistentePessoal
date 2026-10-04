ALTER TABLE sync_account_state
 ADD COLUMN feed_compacted_through bigint NOT NULL DEFAULT 0,
 ADD COLUMN retention_next_at timestamptz NOT NULL DEFAULT '-infinity',
 ADD COLUMN retention_completed_at timestamptz,
 ADD CONSTRAINT feed_retention_bounds CHECK(feed_compacted_through>=0 AND feed_compacted_through<=last_revision);

CREATE INDEX snapshots_account_expiry ON sync_snapshots(user_id,expires_at,id);

CREATE FUNCTION ritmo_expire_sync(p_user uuid,p_now timestamptz,p_next timestamptz,p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE
 control public.sync_account_state%ROWTYPE;
 boundary bigint;
 retired bigint;
 candidate record;
 removed integer;
 removed_items integer;
 removed_snapshots integer;
 pending boolean;
BEGIN
 IF p_user IS NULL OR p_user IS DISTINCT FROM nullif(current_setting('app.user_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Invalid account context' USING ERRCODE='42501';
 END IF;
 IF p_now IS NULL OR p_next IS NULL OR NOT isfinite(p_now) OR NOT isfinite(p_next)
    OR p_next<=p_now OR p_limit IS NULL OR p_limit<1 OR p_limit>5000 THEN
  RAISE EXCEPTION 'Invalid retention parameters' USING ERRCODE='22023';
 END IF;
 SELECT * INTO control FROM public.sync_account_state WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','missing','removedEnvelopes',0); END IF;
 IF control.retention_next_at>p_now THEN RETURN jsonb_build_object('status','not_due','removedEnvelopes',0); END IF;
 SELECT coalesce(min(high_water_revision),control.last_revision) INTO boundary
  FROM public.sync_snapshots WHERE user_id=p_user AND expires_at>p_now;
 retired:=control.feed_compacted_through;
 FOR candidate IN SELECT revision,committed_at FROM public.sync_changes
  WHERE user_id=p_user AND revision>retired ORDER BY revision LIMIT p_limit
 LOOP
  EXIT WHEN candidate.revision>boundary OR candidate.committed_at>=p_now-interval '2160 hours';
  IF candidate.revision<>retired+1 THEN RAISE EXCEPTION 'Non-contiguous feed' USING ERRCODE='XX001'; END IF;
  retired:=candidate.revision;
 END LOOP;
 DELETE FROM public.sync_changes WHERE user_id=p_user AND revision>control.feed_compacted_through AND revision<=retired;
 GET DIAGNOSTICS removed=ROW_COUNT;
 IF removed<>retired-control.feed_compacted_through THEN RAISE EXCEPTION 'Non-contiguous removal' USING ERRCODE='XX001'; END IF;
 SELECT coalesce((SELECT revision<=boundary AND committed_at<p_now-interval '2160 hours'
  FROM public.sync_changes WHERE user_id=p_user AND revision>retired ORDER BY revision LIMIT 1),false) INTO pending;
 WITH doomed AS (
  SELECT i.snapshot_id,i.position FROM public.sync_snapshot_items i
  JOIN public.sync_snapshots s ON s.user_id=i.user_id AND s.id=i.snapshot_id
  WHERE i.user_id=p_user AND s.user_id=p_user AND s.expires_at<=p_now
  ORDER BY s.expires_at,s.id,i.position LIMIT p_limit
 )
 DELETE FROM public.sync_snapshot_items i USING doomed d
  WHERE i.user_id=p_user AND i.snapshot_id=d.snapshot_id AND i.position=d.position;
 GET DIAGNOSTICS removed_items=ROW_COUNT;
 WITH empty_copies AS (
  SELECT s.id FROM public.sync_snapshots s WHERE s.user_id=p_user AND s.expires_at<=p_now
   AND NOT EXISTS(SELECT 1 FROM public.sync_snapshot_items i WHERE i.user_id=p_user AND i.snapshot_id=s.id)
  ORDER BY s.expires_at,s.id LIMIT least(p_limit,25)
 )
 DELETE FROM public.sync_snapshots s USING empty_copies d WHERE s.user_id=p_user AND s.id=d.id;
 GET DIAGNOSTICS removed_snapshots=ROW_COUNT;
 pending:=pending OR EXISTS(SELECT 1 FROM public.sync_snapshots WHERE user_id=p_user AND expires_at<=p_now);
 UPDATE public.sync_account_state SET feed_compacted_through=retired,
  retention_next_at=CASE WHEN pending THEN p_now ELSE p_next END,
  retention_completed_at=CASE WHEN pending THEN retention_completed_at ELSE p_now END WHERE user_id=p_user;
 RETURN jsonb_build_object('status',CASE WHEN pending THEN 'pending' ELSE 'complete' END,
  'removedEnvelopes',removed,'removedItems',removed_items,'removedSnapshots',removed_snapshots,'floor',retired::text);
END $body$;
REVOKE ALL ON FUNCTION ritmo_expire_sync(uuid,timestamptz,timestamptz,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ritmo_expire_sync(uuid,timestamptz,timestamptz,integer) TO ritmo_domain;
