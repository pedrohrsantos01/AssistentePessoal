\set ON_ERROR_STOP on
-- Administrative provisioning once on a clean cluster; no application grants.
CREATE ROLE ritmo_primary_probe LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
  NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE :"DBNAME" TO ritmo_primary_probe;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO ritmo_primary_probe;
ALTER ROLE ritmo_primary_probe SET default_transaction_read_only = on;
-- Password/HBA/TLS come from private external provisioning, never from this file.
