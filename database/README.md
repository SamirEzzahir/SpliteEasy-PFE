# Postgres (SplitEasy)

Dockerized PostgreSQL 16 for the SplitEasy backend.

## What's here
- **`Dockerfile`** — `postgres:16-alpine` plus the init scripts below.
- **`init/01-init.sql`** — runs **once** when the data volume is first created.
  Enables the `pg_trgm` and `citext` extensions. It does **not** create tables —
  the backend does that on startup via SQLAlchemy + `backend/core/migrations.py`.

## How it's wired
Started by the root `docker-compose.yml` as the `db` service. The backend
connects with:

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@db:5432/<db>
```

Credentials come from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
(defaults: `postgres` / `postgres123` / `spliteasy_db`). Override them in a
root `.env` (see `.env.example`).

Data persists in the named volume `pgdata`.

## Common commands
```bash
# Start just the database
docker compose up -d db

# Open a psql shell inside the container
docker compose exec db psql -U postgres -d spliteasy_db

# Re-run init scripts from scratch (DESTROYS all data)
docker compose down -v && docker compose up -d db
```

> The init scripts only run on a fresh volume. After the first start, edit the
> schema through the backend migrations, not by changing `init/`.
