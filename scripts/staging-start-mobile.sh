#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MOBILE_ENV_FILE="${MOBILE_ENV_FILE:-apps/mobile/.env.staging}"

if [[ ! -f "$MOBILE_ENV_FILE" ]]; then
  echo "Missing $MOBILE_ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$MOBILE_ENV_FILE"
set +a

cd apps/mobile
npm run start -- --tunnel
