#!/usr/bin/env bash
set -euo pipefail

echo "This will remove the local PostgreSQL Docker volume and recreate the database."
echo "Existing local data will be deleted. Press Ctrl+C to cancel, or wait 5 seconds."
sleep 5

docker compose down -v
docker compose up --build -d db

echo "Database container started. Schema and seed SQL will run automatically on first startup."
echo "Start the full app with: docker compose up --build"
