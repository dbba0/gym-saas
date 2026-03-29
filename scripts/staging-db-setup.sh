#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_ENV_FILE="${API_ENV_FILE:-apps/api/.env.staging}"
WITH_SEED="${WITH_SEED:-0}"

if [[ ! -f "$API_ENV_FILE" ]]; then
  echo "Missing $API_ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$API_ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is missing in $API_ENV_FILE"
  exit 1
fi

echo "==> Prisma generate (staging)"
npm --workspace apps/api run prisma:generate

echo "==> Prisma db push (staging)"
cd apps/api
npx prisma db push

if [[ "$WITH_SEED" == "1" ]]; then
  echo "==> Prisma seed (staging)"
  npx prisma db seed
fi

echo "Staging DB setup complete."
