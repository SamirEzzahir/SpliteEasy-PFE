-- Runs once, on first initialization of an empty data directory.
-- The database/user themselves are created by the postgres image from the
-- POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD environment variables
-- (see docker-compose.yml), so we only do extra setup here.

-- Case-insensitive / fuzzy text search helpers (handy for name/email lookups).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- Note: SplitEasy's tables are created by SQLAlchemy on backend startup
-- (Base.metadata.create_all), then patched by backend/core/migrations.py.
-- No table DDL is needed here.
