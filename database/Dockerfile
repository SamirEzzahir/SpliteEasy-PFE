# Postgres image tailored for SplitEasy.
# Pinned to 16-alpine for a small, reproducible database image.
FROM postgres:16-alpine

# Scripts in /docker-entrypoint-initdb.d run ONCE, the first time the data
# directory is empty (i.e. a brand-new volume). They do not re-run on restart.
COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
