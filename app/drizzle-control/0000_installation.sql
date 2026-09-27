-- Installation control only. Credentials live exclusively in SecureStore.
CREATE TABLE installation_control (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 device_id TEXT NOT NULL,
 selected_account_id TEXT,
 session_generation INTEGER NOT NULL DEFAULT 0 CHECK(session_generation BETWEEN 0 AND 9007199254740991),
 session_state TEXT NOT NULL DEFAULT 'locked' CHECK(session_state IN ('active','logging_out','locked')),
 credentials_key TEXT,
 revoke_key TEXT
);
--> statement-breakpoint
CREATE TABLE protected_keys (
 key TEXT PRIMARY KEY NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('credentials','revocation')),
 account_id TEXT NOT NULL,
 session_id TEXT NOT NULL
);
