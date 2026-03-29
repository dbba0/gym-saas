#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_ENV_FILE="${API_ENV_FILE:-apps/api/.env.staging}"

if [[ ! -f "$API_ENV_FILE" ]]; then
  echo "Missing $API_ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$API_ENV_FILE"
set +a

cd apps/api
npm run start
