-- Operational status only. The owner must see replication statistics; no runtime monitoring grant.
CREATE FUNCTION ritmo_wal_status(target pg_lsn) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE position pg_lsn := target;
BEGIN
    IF pg_is_in_recovery() THEN
        RETURN jsonb_build_object('position',position::text,'durable',false);
    END IF;
    IF position IS NULL THEN
        -- Empty, nontransactional, locally flushed marker covers every earlier WAL insert.
        -- Unlike an insert pointer alone, it also makes aborted/uncommitted WAL streamable.
        position := pg_logical_emit_message(false,'ritmo-durability',''::text,true);
    END IF;
    RETURN jsonb_build_object('position',position::text,'durable',
        NOT pg_is_in_recovery()
        AND current_setting('fsync')='on'
        AND current_setting('full_page_writes')='on'
        AND current_setting('synchronous_commit')='on'
        AND current_setting('synchronous_standby_names')='FIRST 1 (ritmo_wal)'
        AND EXISTS (SELECT 1 FROM pg_stat_replication r
            JOIN pg_replication_slots s ON s.active_pid=r.pid
            AND s.slot_name='ritmo_wal' AND s.slot_type='physical'
            WHERE usename='ritmo_wal_receiver' AND application_name='ritmo_wal'
            AND state='streaming' AND sync_state='sync' AND flush_lsn>=position));
END;
$$;
REVOKE ALL ON FUNCTION ritmo_wal_status(pg_lsn) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ritmo_wal_status(pg_lsn) TO ritmo_domain;
