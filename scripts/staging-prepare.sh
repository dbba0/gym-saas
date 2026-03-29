#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_ENV_FILE="${API_ENV_FILE:-apps/api/.env.staging}"
ADMIN_ENV_FILE="${ADMIN_ENV_FILE:-apps/admin/.env.staging}"
MOBILE_ENV_FILE="${MOBILE_ENV_FILE:-apps/mobile/.env.staging}"

read_env() {
  local file="$1"
  local key="$2"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  echo "${line#*=}"
}

assert_file_exists() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
}

assert_value_present() {
  local value="$1"
  local label="$2"
  if [[ -z "$value" ]]; then
    echo "Missing value: $label"
    exit 1
  fi
}

assert_not_localhost() {
  local value="$1"
  local label="$2"
  if echo "$value" | grep -Eqi "localhost|127\.0\.0\.1"; then
    echo "Invalid staging value for $label: localhost/127.0.0.1 is not allowed"
    exit 1
  fi
}

assert_not_placeholder() {
  local value="$1"
  local label="$2"
  if echo "$value" | grep -Eq "<|your-domain\\.com"; then
    echo "Invalid staging value for $label: placeholder detected"
    exit 1
  fi
}

assert_url_like() {
  local value="$1"
  local label="$2"
  if ! echo "$value" | grep -Eq '^https?://'; then
    echo "Invalid URL for $label: must start with http:// or https://"
    exit 1
  fi
}

assert_env_key() {
  local file="$1"
  local key="$2"
  local scope="$3"
  local value
  value="$(read_env "$file" "$key")"
  assert_value_present "$value" "$scope $key"
  assert_not_placeholder "$value" "$scope $key"
}

echo "==> Checking staging env files"
assert_file_exists "$API_ENV_FILE"
assert_file_exists "$ADMIN_ENV_FILE"
assert_file_exists "$MOBILE_ENV_FILE"

echo "==> Validating API env"
API_DATABASE_URL="$(read_env "$API_ENV_FILE" "DATABASE_URL")"
API_JWT_SECRET="$(read_env "$API_ENV_FILE" "JWT_SECRET")"
API_CORS_ORIGIN="$(read_env "$API_ENV_FILE" "CORS_ORIGIN")"
API_PUBLIC_BASE_URL="$(read_env "$API_ENV_FILE" "API_PUBLIC_BASE_URL")"
API_PAYDUNYA_MODE="$(read_env "$API_ENV_FILE" "PAYDUNYA_MODE")"
API_PAYDUNYA_WEBHOOK_SECRET="$(read_env "$API_ENV_FILE" "PAYDUNYA_WEBHOOK_SECRET")"

assert_value_present "$API_DATABASE_URL" "apps/api DATABASE_URL"
assert_value_present "$API_JWT_SECRET" "apps/api JWT_SECRET"
assert_value_present "$API_CORS_ORIGIN" "apps/api CORS_ORIGIN"
assert_value_present "$API_PUBLIC_BASE_URL" "apps/api API_PUBLIC_BASE_URL"
assert_not_localhost "$API_DATABASE_URL" "apps/api DATABASE_URL"
assert_not_localhost "$API_CORS_ORIGIN" "apps/api CORS_ORIGIN"
assert_not_localhost "$API_PUBLIC_BASE_URL" "apps/api API_PUBLIC_BASE_URL"
assert_not_placeholder "$API_DATABASE_URL" "apps/api DATABASE_URL"
assert_not_placeholder "$API_JWT_SECRET" "apps/api JWT_SECRET"
assert_not_placeholder "$API_CORS_ORIGIN" "apps/api CORS_ORIGIN"
assert_not_placeholder "$API_PUBLIC_BASE_URL" "apps/api API_PUBLIC_BASE_URL"
assert_url_like "$API_PUBLIC_BASE_URL" "apps/api API_PUBLIC_BASE_URL"
assert_env_key "$API_ENV_FILE" "JWT_EXPIRES_IN" "apps/api"
assert_env_key "$API_ENV_FILE" "REFRESH_TOKEN_TTL_DAYS" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYMENT_PROVIDER" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYMENT_CURRENCY" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYDUNYA_CALLBACK_URL" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYDUNYA_RETURN_URL" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYDUNYA_CANCEL_URL" "apps/api"
assert_env_key "$API_ENV_FILE" "PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS" "apps/api"
assert_value_present "$API_PAYDUNYA_WEBHOOK_SECRET" "apps/api PAYDUNYA_WEBHOOK_SECRET"
assert_not_placeholder "$API_PAYDUNYA_WEBHOOK_SECRET" "apps/api PAYDUNYA_WEBHOOK_SECRET"
assert_url_like "$(read_env "$API_ENV_FILE" "PAYDUNYA_CALLBACK_URL")" "apps/api PAYDUNYA_CALLBACK_URL"
assert_url_like "$(read_env "$API_ENV_FILE" "PAYDUNYA_RETURN_URL")" "apps/api PAYDUNYA_RETURN_URL"
assert_url_like "$(read_env "$API_ENV_FILE" "PAYDUNYA_CANCEL_URL")" "apps/api PAYDUNYA_CANCEL_URL"

if [[ "$API_PAYDUNYA_MODE" != "sandbox" && "$API_PAYDUNYA_MODE" != "live" ]]; then
  echo "Invalid value for apps/api PAYDUNYA_MODE (must be sandbox|live)"
  exit 1
fi

if [[ "$API_PAYDUNYA_MODE" == "sandbox" ]]; then
  assert_env_key "$API_ENV_FILE" "PAYDUNYA_MASTER_KEY" "apps/api"
  assert_env_key "$API_ENV_FILE" "PAYDUNYA_PRIVATE_KEY" "apps/api"
  assert_env_key "$API_ENV_FILE" "PAYDUNYA_TOKEN" "apps/api"
fi

echo "==> Validating Admin env"
ADMIN_API_URL="$(read_env "$ADMIN_ENV_FILE" "NEXT_PUBLIC_API_URL")"
assert_value_present "$ADMIN_API_URL" "apps/admin NEXT_PUBLIC_API_URL"
assert_not_localhost "$ADMIN_API_URL" "apps/admin NEXT_PUBLIC_API_URL"
assert_not_placeholder "$ADMIN_API_URL" "apps/admin NEXT_PUBLIC_API_URL"
assert_url_like "$ADMIN_API_URL" "apps/admin NEXT_PUBLIC_API_URL"

echo "==> Validating Mobile env"
MOBILE_API_URL="$(read_env "$MOBILE_ENV_FILE" "EXPO_PUBLIC_API_URL")"
assert_value_present "$MOBILE_API_URL" "apps/mobile EXPO_PUBLIC_API_URL"
assert_not_localhost "$MOBILE_API_URL" "apps/mobile EXPO_PUBLIC_API_URL"
assert_not_placeholder "$MOBILE_API_URL" "apps/mobile EXPO_PUBLIC_API_URL"
assert_url_like "$MOBILE_API_URL" "apps/mobile EXPO_PUBLIC_API_URL"

if [[ "$ADMIN_API_URL" != "$MOBILE_API_URL" ]]; then
  echo "Warning: Admin and Mobile API URLs differ."
  echo "  admin:  $ADMIN_API_URL"
  echo "  mobile: $MOBILE_API_URL"
fi

echo "==> Installing dependencies"
npm install

echo "==> Generating Prisma client"
npm --workspace apps/api run prisma:generate

echo "==> Typecheck + lint"
npm run lint

echo "==> Building API + Admin with staging env files"
npm run build:staging

echo ""
echo "Staging preflight passed."
echo "Next run commands:"
echo "  npm run start:staging:api"
echo "  npm run start:staging:admin"
echo "  npm run start:staging:mobile"
