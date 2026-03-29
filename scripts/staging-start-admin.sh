#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ADMIN_ENV_FILE="${ADMIN_ENV_FILE:-apps/admin/.env.staging}"

if [[ ! -f "$ADMIN_ENV_FILE" ]]; then
  echo "Missing $ADMIN_ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ADMIN_ENV_FILE"
set +a

cd apps/admin
npm run start
