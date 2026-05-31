#!/usr/bin/env sh
set -e

alembic upgrade head

if [ "${SEED_DB_ON_START:-false}" = "true" ]; then
  python -m app.scripts.seed_complete
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
