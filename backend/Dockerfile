FROM python:3.11-slim

# - PYTHONUNBUFFERED: stream logs straight to the container (no buffering)
# - PYTHONDONTWRITEBYTECODE: don't litter the image with .pyc files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so this layer is cached unless requirements change.
# requirements.txt lives at the root of the backend build context.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend source. The FastAPI package lives in ./app, so it is imported
# as the `app` package (`app.main:app`) with /app as the working directory.
COPY . .

EXPOSE 8000

# DATABASE_URL is injected at runtime (see docker-compose.yml). On startup the
# app creates tables and runs the Postgres migrations in app/core/migrations.py.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
