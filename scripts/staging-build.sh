#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_ENV_FILE="${API_ENV_FILE:-apps/api/.env.staging}"
ADMIN_ENV_FILE="${ADMIN_ENV_FILE:-apps/admin/.env.staging}"

if [[ ! -f "$API_ENV_FILE" ]]; then
  echo "Missing $API_ENV_FILE"
  exit 1
fi

if [[ ! -f "$ADMIN_ENV_FILE" ]]; then
  echo "Missing $ADMIN_ENV_FILE"
  exit 1
fi

echo "==> Building API (staging)"
set -a
# shellcheck disable=SC1090
source "$API_ENV_FILE"
set +a
npm --workspace apps/api run build

echo "==> Building Admin (staging)"
set -a
# shellcheck disable=SC1090
source "$ADMIN_ENV_FILE"
set +a
npm --workspace apps/admin run build

echo "Staging build complete."
