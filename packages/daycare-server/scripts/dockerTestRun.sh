#!/bin/sh
set -eu

export DATABASE_URL="${DATABASE_URL:-postgresql://daycare:daycare@db:5432/daycare?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://redis:6379}"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"
export TEST_REDIS_URL="${TEST_REDIS_URL:-$REDIS_URL}"
export TOKEN_SERVICE="${TOKEN_SERVICE:-daycare-test}"
export TOKEN_SEED="${TOKEN_SEED:-daycare-test-seed-00000000000000000000000000000000}"
export LIVE_SERVER_URL="${LIVE_SERVER_URL:-http://api:3005}"
export INTEGRATION="${INTEGRATION:-1}"

echo "Applying Prisma migrations for test database..."
yarn workspace daycare-server prisma migrate deploy --schema prisma/schema.prisma

echo "Running daycare-server test suite (unit + integration)..."
yarn workspace daycare-server test --no-file-parallelism --maxWorkers=1

echo "Running live API smoke checks at ${LIVE_SERVER_URL}..."
node packages/daycare-server/scripts/liveApiSmoke.mjs

echo "Dockerized test run completed successfully."
