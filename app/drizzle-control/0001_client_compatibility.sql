-- Preserve a required update across restarts and logout. No account data is changed.
ALTER TABLE installation_control ADD COLUMN blocked_client TEXT;
