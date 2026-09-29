-- Global operational metadata, read before authentication; no account or domain data.
CREATE TABLE app_compatibility (
 singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
 min_supported_version TEXT NOT NULL DEFAULT '0.1.0'
  CHECK(min_supported_version ~ '^(0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})[.](0|[1-9][0-9]{0,5})$')
);
INSERT INTO app_compatibility(singleton) VALUES(TRUE);
REVOKE ALL ON app_compatibility FROM PUBLIC;
GRANT SELECT ON app_compatibility TO ritmo_domain;
