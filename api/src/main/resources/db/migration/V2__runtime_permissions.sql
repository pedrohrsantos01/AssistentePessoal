-- Provision the two NOLOGIN group roles before Flyway, using ops/bootstrap-roles.sql.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ritmo_domain, ritmo_identity;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON habits,habit_day_states,habit_binary_facts,habit_mark_context,
 xp_events,xp_award_decisions,xp_transitions,xp_daily_budgets,sync_account_state,
 sync_operation_receipts,sync_batches,sync_changes,sync_deleted_ids,sync_snapshots,sync_snapshot_items TO ritmo_domain;
GRANT SELECT,INSERT,UPDATE,DELETE ON users,identity_sessions,identity_refresh_tokens,identity_password_resets TO ritmo_identity;
GRANT SELECT(id,display_name,timezone,day_start_hour,plan,onboarded_at,analytics_consent_at,deleted_at,revision),
 UPDATE(display_name,timezone,day_start_hour,onboarded_at,analytics_consent_at,updated_at,revision) ON users TO ritmo_domain;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_access ON users TO ritmo_identity USING(true) WITH CHECK(true);
CREATE POLICY account_profile ON users TO ritmo_domain
 USING(id=nullif(current_setting('app.user_id',true),'')::uuid)
 WITH CHECK(id=nullif(current_setting('app.user_id',true),'')::uuid);
