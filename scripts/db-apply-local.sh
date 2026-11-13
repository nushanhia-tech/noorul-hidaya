#!/usr/bin/env bash
# Recreates a local test database and applies the Supabase shim + all migrations.
# Usage: TEST_DATABASE_URL=postgres://postgres@localhost:54329/college_test scripts/db-apply-local.sh
set -euo pipefail
URL="${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
DB="${URL##*/}"; ADMIN_URL="${URL%/*}/postgres"
psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$DB\" with (force)" -c "create database \"$DB\""
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../supabase/tests/shim.sql"
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
