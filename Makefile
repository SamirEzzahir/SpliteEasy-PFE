# ─────────────────────────────────────────────────────────────────────────────
# SplitEasy — developer workflow shortcuts
#   Usage: make <target>   (requires GNU Make; on Windows use Git Bash / WSL)
# ─────────────────────────────────────────────────────────────────────────────
COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help up down build rebuild restart logs ps \
        dev-db dev-backend dev-frontend backend frontend \
        seed seed-force backend-shell frontend-shell db-shell \
        migrate migration migrate-down stamp \
        test lint typecheck backend-venv install-dev clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start the full stack (db + backend + web)
	$(COMPOSE) up -d

build: ## Build all images
	$(COMPOSE) build

rebuild: ## Rebuild images without cache and start
	$(COMPOSE) build --no-cache && $(COMPOSE) up -d

down: ## Stop and remove containers
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

ps: ## Show running services
	$(COMPOSE) ps

# ── Dev mode: DB in Docker, backend + frontend run locally with hot reload ────
# Run each in its own terminal.
dev-db: ## Dev: start ONLY Postgres (published on localhost:5432)
	$(COMPOSE) up -d db

dev-backend: ## Dev: FastAPI with hot reload on :8800 (needs backend/.venv)
	cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8800

dev-frontend: ## Dev: Next.js dev server (fast refresh) on :3000
	cd frontend && npm run dev

backend: ## Dev: run the backend (alias for dev-backend)
	$(MAKE) dev-backend

frontend: ## Dev: run the frontend (alias for dev-frontend)
	$(MAKE) dev-frontend

seed: ## Seed the demo dataset (idempotent)
	$(COMPOSE) exec backend python -m app.seed_demo

seed-force: ## Wipe and re-seed the demo dataset
	$(COMPOSE) exec backend python -m app.seed_demo --force

migrate: ## Apply all Alembic migrations (upgrade head)
	$(COMPOSE) exec backend alembic upgrade head

migration: ## Autogenerate a migration:  make migration m="add x column"
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(m)"

migrate-down: ## Roll back the most recent migration
	$(COMPOSE) exec backend alembic downgrade -1

stamp: ## Mark the DB at head without running migrations (adopt existing schema)
	$(COMPOSE) exec backend alembic stamp head

backend-shell: ## Open a shell in the backend container
	$(COMPOSE) exec backend sh

frontend-shell: ## Open a shell in the web container
	$(COMPOSE) exec web sh

db-shell: ## Open psql in the db container
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-spliteasy_db}

typecheck: ## Typecheck the frontend
	cd frontend && npx tsc --noEmit

test: ## Run backend tests (pytest)
	cd backend && .venv/Scripts/python -m pytest

lint: ## Lint backend (ruff) + typecheck frontend (tsc)
	cd backend && .venv/Scripts/python -m ruff check app
	cd frontend && npx tsc --noEmit

install-dev: ## Install backend runtime + dev tools into backend/.venv
	cd backend && .venv/Scripts/python -m pip install -r requirements-dev.txt

backend-venv: ## (Re)create the backend local virtualenv
	python -m venv backend/.venv && backend/.venv/Scripts/pip install -r backend/requirements.txt

clean: ## Stop stack and prune dangling docker resources
	$(COMPOSE) down --remove-orphans && docker system prune -f
