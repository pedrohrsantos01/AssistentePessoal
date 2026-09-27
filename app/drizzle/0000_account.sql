-- Per-account canonical/intention store. Apply no credentials to this database.

CREATE TABLE account_storage (
 account_id TEXT PRIMARY KEY NOT NULL,
 singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK(singleton=1)
);
--> statement-breakpoint
CREATE TABLE canonical_entities (
 account_id TEXT NOT NULL REFERENCES account_storage(account_id),
 kind TEXT NOT NULL CHECK(kind IN ('profile','habit','habitDay','xpGrant','xpDecision','xpTransition','xpBudget','tombstone')),
 entity_key TEXT NOT NULL, revision TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 PRIMARY KEY(account_id,kind,entity_key),
 CHECK(revision NOT GLOB '*[^0-9]*' AND length(revision) BETWEEN 1 AND 19),
 CHECK(revision='0' OR substr(revision,1,1)<>'0'),
 CHECK(length(revision)<19 OR revision<='9223372036854775807')
);
--> statement-breakpoint
CREATE TABLE sync_mutations (
 account_id TEXT NOT NULL REFERENCES account_storage(account_id), operation_id TEXT NOT NULL,
 device_id TEXT NOT NULL, client_sequence INTEGER NOT NULL CHECK(client_sequence BETWEEN 1 AND 9007199254740991),
 envelope TEXT NOT NULL CHECK(json_valid(envelope)), dependencies TEXT NOT NULL CHECK(json_valid(dependencies)),
 status TEXT NOT NULL CHECK(status IN ('pending','in_flight','retry_wait','deferred','blocked_local','rejected','acknowledged')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at TEXT,
 error TEXT CHECK(error IS NULL OR json_valid(error)), result TEXT CHECK(result IS NULL OR json_valid(result)),
 PRIMARY KEY(account_id,operation_id), UNIQUE(account_id,device_id,client_sequence)
);
--> statement-breakpoint
CREATE TABLE sync_state (
 account_id TEXT PRIMARY KEY REFERENCES account_storage(account_id), cursor TEXT,
 next_sequence INTEGER NOT NULL CHECK(next_sequence BETWEEN 1 AND 9007199254740991),
 onboarding_step TEXT NOT NULL CHECK(onboarding_step IN ('time_context','first_habit','complete')),
 snapshot_id TEXT, snapshot_revision TEXT, snapshot_cursor TEXT, snapshot_expires_at TEXT
);
--> statement-breakpoint
CREATE TABLE snapshot_staging (
 account_id TEXT NOT NULL REFERENCES account_storage(account_id), snapshot_id TEXT NOT NULL,
 kind TEXT NOT NULL, entity_key TEXT NOT NULL, revision TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(account_id,snapshot_id,kind,entity_key)
);
--> statement-breakpoint
CREATE TABLE projected_views (
 account_id TEXT NOT NULL REFERENCES account_storage(account_id), kind TEXT NOT NULL CHECK(kind IN ('habit','xp')),
 entity_key TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(account_id,kind,entity_key)
);
--> statement-breakpoint
CREATE INDEX pending_operations ON sync_mutations(account_id,status,client_sequence);
