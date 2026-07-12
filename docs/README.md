# SplitEasy — Documentation Index

Central map of the project's documentation. Docs live next to the code they
describe (service-local), and this page links them all in one place.

## Overview
- [Project README](../README.md) — features, stack, install, run (Docker & local dev)
- [CLAUDE.md](../CLAUDE.md) — product guardrails & design contract for contributors/AI

## Backend (`backend/`)
- [backend/README.md](../backend/README.md) — API architecture, run instructions, layout
- [backend/alembic/README.md](../backend/alembic/README.md) — database migrations workflow

## Frontend (`frontend/`)
- [frontend/README.md](../frontend/README.md) — web client overview & scripts
- [frontend/docs/DESIGN_SYSTEM.md](../frontend/docs/DESIGN_SYSTEM.md) — **source of truth** for UI
- Page-level docs:
  - [dashboard-page.md](../frontend/docs/dashboard-page.md)
  - [groups-page.md](../frontend/docs/groups-page.md)
  - [group-detail-page.md](../frontend/docs/group-detail-page.md)
  - [support.md](../frontend/docs/support.md)
  - [admin-panel.md](../frontend/docs/admin-panel.md)
  - [platform-admin.md](../frontend/docs/platform-admin.md)

## Operations
- [docker-compose.yml](../docker-compose.yml) — full stack (db · backend · web)
- [Makefile](../Makefile) — developer commands (`make help`)
- [database/](../database/) — Postgres image, init SQL, backups/seeds/scripts
