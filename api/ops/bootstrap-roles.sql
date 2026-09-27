-- Once per fresh database, as its administrator. Credentials are supplied by the operator.
-- Application connections must use separate LOGIN roles, each granted only one of these groups.
CREATE ROLE ritmo_domain NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE ritmo_identity NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
