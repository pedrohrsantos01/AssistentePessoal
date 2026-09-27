-- M1 physical model: specs/00 section 12; migration owner is separate from runtime roles.
-- UUIDs supplied by app/server according to ownership. No secrets in this artifact.
CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL, email_key text NOT NULL UNIQUE,
 password_hash text NOT NULL, display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
 timezone text NOT NULL, day_start_hour smallint NOT NULL DEFAULT 4 CHECK(day_start_hour BETWEEN 0 AND 23),
 plan text NOT NULL DEFAULT 'free' CHECK(plan='free'), onboarded_at timestamptz,
 analytics_consent_at timestamptz, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 deleted_at timestamptz, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE identity_sessions (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, id uuid NOT NULL,
 device_id uuid NOT NULL, revoke_secret_hash bytea NOT NULL UNIQUE CHECK(octet_length(revoke_secret_hash)=32),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,id)
);
CREATE TABLE identity_refresh_tokens (
 user_id uuid NOT NULL, id uuid NOT NULL, session_id uuid NOT NULL,
 token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32),
 expires_at timestamptz NOT NULL, used_at timestamptz, revoked_at timestamptz, replacement_id uuid,
 PRIMARY KEY(user_id,id), FOREIGN KEY(user_id,session_id) REFERENCES identity_sessions(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,replacement_id) REFERENCES identity_refresh_tokens(user_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE identity_password_resets (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, id uuid NOT NULL,
 token_hash bytea NOT NULL UNIQUE CHECK(octet_length(token_hash)=32),
 expires_at timestamptz NOT NULL, used_at timestamptz, PRIMARY KEY(user_id,id)
);
CREATE TABLE habits (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, id uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120), title_key text NOT NULL,
 normalization_version smallint NOT NULL DEFAULT 1 CHECK(normalization_version=1),
 icon text, color text, sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order BETWEEN 0 AND 1000000),
 type text NOT NULL CHECK(type='binary'), schedule_kind text NOT NULL CHECK(schedule_kind='daily'),
 start_day_key date NOT NULL, creation_time_context jsonb NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, deleted_at timestamptz,
 revision bigint NOT NULL CHECK(revision>0), PRIMARY KEY(user_id,id)
);
CREATE UNIQUE INDEX habits_active_title ON habits(user_id,title_key) WHERE deleted_at IS NULL;
CREATE TABLE habit_day_states (
 user_id uuid NOT NULL, id uuid NOT NULL, habit_id uuid NOT NULL, day_key date NOT NULL,
 done boolean NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 PRIMARY KEY(user_id,id), UNIQUE(user_id,habit_id,day_key),
 FOREIGN KEY(user_id,habit_id) REFERENCES habits(user_id,id) ON DELETE CASCADE
);
CREATE TABLE habit_binary_facts (
 user_id uuid NOT NULL, operation_id uuid NOT NULL, habit_day_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('mark','unmark')), occurred_at timestamptz NOT NULL,
 time_context jsonb NOT NULL, accepted_revision bigint NOT NULL CHECK(accepted_revision>0),
 PRIMARY KEY(user_id,operation_id), UNIQUE(user_id,habit_day_id,operation_id),
 FOREIGN KEY(user_id,habit_day_id) REFERENCES habit_day_states(user_id,id) ON DELETE CASCADE
);
CREATE TABLE habit_mark_context (
 user_id uuid NOT NULL, habit_day_id uuid NOT NULL, mark_operation_id uuid NOT NULL, undo_operation_id uuid NOT NULL,
 PRIMARY KEY(user_id,mark_operation_id,undo_operation_id),
 FOREIGN KEY(user_id,habit_day_id,mark_operation_id) REFERENCES habit_binary_facts(user_id,habit_day_id,operation_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,habit_day_id,undo_operation_id) REFERENCES habit_binary_facts(user_id,habit_day_id,operation_id) ON DELETE CASCADE,
 CHECK(mark_operation_id<>undo_operation_id)
);
CREATE TABLE xp_events (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, id uuid NOT NULL,
 source_type text NOT NULL CHECK(source_type='habit_log'), source_id uuid NOT NULL,
 amount integer NOT NULL CHECK(amount=10), day_key date NOT NULL,
 module text NOT NULL CHECK(module='habits'), budget_cost integer NOT NULL CHECK(budget_cost=10),
 active boolean NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 PRIMARY KEY(user_id,id), UNIQUE(user_id,source_type,source_id), UNIQUE(user_id,id,source_id)
 -- Deliberately no source FK: domain deletion preserves the already earned XP (spec/04 §7).
);
CREATE TABLE xp_award_decisions (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_type text NOT NULL CHECK(source_type='habit_log'),
 source_id uuid NOT NULL, outcome text NOT NULL CHECK(outcome IN ('granted','limit_reached')),
 xp_event_id uuid, revision bigint NOT NULL CHECK(revision>0),
 PRIMARY KEY(user_id,source_type,source_id),
 FOREIGN KEY(user_id,xp_event_id,source_id) REFERENCES xp_events(user_id,id,source_id),
 CHECK((outcome='granted' AND xp_event_id IS NOT NULL) OR (outcome='limit_reached' AND xp_event_id IS NULL))
);
CREATE TABLE xp_transitions (
 user_id uuid NOT NULL, operation_id uuid NOT NULL, xp_event_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('grant','reverse','restore')), accepted_at timestamptz NOT NULL,
 revision bigint NOT NULL CHECK(revision>0), PRIMARY KEY(user_id,operation_id,xp_event_id),
 FOREIGN KEY(user_id,xp_event_id) REFERENCES xp_events(user_id,id) ON DELETE CASCADE
);
CREATE TABLE xp_daily_budgets (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, day_key date NOT NULL,
 module text NOT NULL CHECK(module='habits'), consumed integer NOT NULL CHECK(consumed>=0),
 due_habit_count integer NOT NULL CHECK(due_habit_count>=0),
 revision bigint NOT NULL CHECK(revision>0), PRIMARY KEY(user_id,day_key,module)
);
CREATE TABLE sync_account_state (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 last_revision bigint NOT NULL DEFAULT 0 CHECK(last_revision>=0), feed_epoch uuid NOT NULL
);
CREATE TABLE sync_operation_receipts (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, operation_id uuid NOT NULL,
 device_id uuid NOT NULL, client_sequence bigint NOT NULL CHECK(client_sequence BETWEEN 1 AND 9007199254740991),
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32),
 outcome text NOT NULL CHECK(outcome IN ('accepted','reconciled','rejected')),
 accepted_revision bigint, result jsonb NOT NULL, affected_keys jsonb NOT NULL,
 processed_at timestamptz NOT NULL, PRIMARY KEY(user_id,operation_id), UNIQUE(user_id,device_id,client_sequence),
 CHECK((outcome='rejected' AND accepted_revision IS NULL) OR (outcome<>'rejected' AND accepted_revision IS NOT NULL AND accepted_revision>0))
);
CREATE TABLE sync_batches (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, batch_id uuid NOT NULL,
 payload_hash bytea NOT NULL CHECK(octet_length(payload_hash)=32), created_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,batch_id)
);
CREATE TABLE sync_changes (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, revision bigint NOT NULL CHECK(revision>0),
 committed_at timestamptz NOT NULL, envelope jsonb NOT NULL, PRIMARY KEY(user_id,revision)
);
CREATE TABLE sync_deleted_ids (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, entity_kind text NOT NULL CHECK(entity_kind='habit'),
 entity_id uuid NOT NULL, deleted_revision bigint NOT NULL CHECK(deleted_revision>0),
 PRIMARY KEY(user_id,entity_kind,entity_id)
);
CREATE TABLE sync_snapshots (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, id uuid NOT NULL,
 high_water_revision bigint NOT NULL CHECK(high_water_revision>=0), feed_epoch uuid NOT NULL,
 expires_at timestamptz NOT NULL, entity_count integer NOT NULL CHECK(entity_count>=0),
 PRIMARY KEY(user_id,id)
);
CREATE TABLE sync_snapshot_items (
 user_id uuid NOT NULL, snapshot_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0),
 entity jsonb NOT NULL, PRIMARY KEY(user_id,snapshot_id,position),
 FOREIGN KEY(user_id,snapshot_id) REFERENCES sync_snapshots(user_id,id) ON DELETE CASCADE
);
CREATE INDEX habit_days_briefing ON habit_day_states(user_id,day_key);
CREATE INDEX facts_for_day ON habit_binary_facts(user_id,habit_day_id);
CREATE INDEX grants_for_day ON xp_events(user_id,day_key,module);
CREATE INDEX snapshots_expiry ON sync_snapshots(expires_at);

-- Domain RLS templates. Runtime role must not own tables or have BYPASSRLS.
-- Identity pre-auth queries need a separate, narrowly granted role and repository.
DO $policy$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['habits','habit_day_states','habit_binary_facts','habit_mark_context',
 'xp_events','xp_award_decisions','xp_transitions','xp_daily_budgets','sync_account_state',
 'sync_operation_receipts','sync_batches','sync_changes','sync_deleted_ids','sync_snapshots','sync_snapshot_items']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY account_isolation ON %I USING (user_id = nullif(current_setting(''app.user_id'', true), '''')::uuid) WITH CHECK (user_id = nullif(current_setting(''app.user_id'', true), '''')::uuid)',name);
 END LOOP;
END $policy$;
-- No blanket GRANT here. Role creation/grants and pre-auth Identity access must be
-- implemented and tested in the first Flyway/infrastructure slice, never as superuser runtime.
