---
name: MySQL to PostgreSQL Migration Status
description: Current state of MySQL-specific code that must change when migrating to PostgreSQL
type: project
---

# MySQL to PostgreSQL Migration

**Why:** Active project goal. Backend currently defaults to SQLite for local dev but uses MySQL in production. Goal is to migrate to PostgreSQL.
**How to apply:** Flag MySQL-specific syntax whenever touching migrations, models, or raw SQL.

## MySQL-specific code that must be changed

### core/migrations.py
All manual migration functions use MySQL-specific SQL:
- `information_schema.COLUMNS` with `TABLE_SCHEMA = DATABASE()` — PostgreSQL uses `information_schema.columns` with `table_catalog`/`table_schema`
- `ENUM(...)` column definitions inline in ALTER TABLE — PostgreSQL requires CREATE TYPE first
- `INT AUTO_INCREMENT` / `DATETIME` types — PostgreSQL uses SERIAL/BIGSERIAL and TIMESTAMP
- `MODIFY COLUMN` — PostgreSQL uses `ALTER COLUMN ... TYPE`
- `group_messages` table created with raw MySQL DDL (backtick table name, MySQL DATETIME, etc.)

### models/ (SQLAlchemy)
Need to audit for MySQL-specific column types (TINYINT for bool, etc.)

## Migration plan (not started as of 2026-05-22)
1. Swap DATABASE_URL to `postgresql+asyncpg://...`
2. Replace manual migrations in core/migrations.py with Alembic
3. Audit models for MySQL-specific types
4. Export data, import into PostgreSQL
