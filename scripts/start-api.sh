#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER:-postgres}" -q; do
  sleep 1
done
echo "✅ PostgreSQL is ready"

cd /app/packages/core

echo "📦 Running prisma db push..."
npx prisma db push --skip-generate

echo "🚀 Starting API server..."
exec node dist/index.js
