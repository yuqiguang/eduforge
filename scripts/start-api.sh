#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-postgres}" -q; do
  sleep 1
done
echo "PostgreSQL is ready"

cd /app/packages/core

echo "Running prisma db push..."
NODE_ENV=production npx prisma db push --skip-generate

echo "Starting API server..."
export NODE_ENV=${NODE_ENV:-production}
exec node dist/index.js
