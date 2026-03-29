#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Demo hardening build pipeline"

echo "==> Checking required env files"
for env_file in apps/api/.env apps/admin/.env apps/mobile/.env; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing $env_file"
    exit 1
  fi
done

echo "==> Installing dependencies"
npm install

echo "==> Generating Prisma client"
npm --workspace apps/api run prisma:generate

echo "==> Lint checks"
npm run lint

echo "==> Building API"
npm --workspace apps/api run build

echo "==> Building Admin"
npm --workspace apps/admin run build

echo "==> Demo build complete"
echo ""
echo "Run these commands in separate terminals for the demo:"
echo "  npm run dev:api"
echo "  npm run dev:admin"
echo "  npm run dev:mobile"
