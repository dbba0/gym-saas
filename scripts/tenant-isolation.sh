#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000/api}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this script."
  exit 1
fi

login() {
  local email="$1"
  local password="$2"
  curl -s -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
}

extract_token() {
  local response="$1"
  echo "$response" | jq -r '.token // empty'
}

assert_non_empty() {
  local value="$1"
  local message="$2"
  if [[ -z "$value" ]]; then
    echo "FAIL: $message"
    exit 1
  fi
}

call_api() {
  local method="$1"
  local path="$2"
  local token="$3"
  local body="${4:-}"

  if [[ -n "$body" ]]; then
    curl -s -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body"
  else
    curl -s -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $token"
  fi
}

assert_status() {
  local expected="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local body="${5:-}"

  local output_file
  output_file="$(mktemp)"

  local code
  if [[ -n "$body" ]]; then
    code="$(curl -s -o "$output_file" -w '%{http_code}' -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body")"
  else
    code="$(curl -s -o "$output_file" -w '%{http_code}' -X "$method" "$API_URL$path" \
      -H "Authorization: Bearer $token")"
  fi

  if [[ "$code" != "$expected" ]]; then
    echo "FAIL: $method $path expected HTTP $expected, got $code"
    cat "$output_file"
    rm -f "$output_file"
    exit 1
  fi

  rm -f "$output_file"
}

echo "==> Login seeded users in gym A"
ADMIN_A_TOKEN="$(extract_token "$(login admin@atlasgym.local admin123)")"
COACH_A_TOKEN="$(extract_token "$(login coach@atlasgym.local coach123)")"
MEMBER_A_TOKEN="$(extract_token "$(login member@atlasgym.local member123)")"

assert_non_empty "$ADMIN_A_TOKEN" "admin gym A login failed"
assert_non_empty "$COACH_A_TOKEN" "coach gym A login failed"
assert_non_empty "$MEMBER_A_TOKEN" "member gym A login failed"

RUN_ID="$(date +%s)"
GYM_B_PHONE="+2217$((10000000 + RANDOM % 89999999))"
ADMIN_B_EMAIL="admin.${RUN_ID}@tenant.local"
COACH_B_EMAIL="coach.${RUN_ID}@tenant.local"
MEMBER_B_EMAIL="member.${RUN_ID}@tenant.local"
ADMIN_B_PASSWORD="Admin#${RUN_ID}Aa1"

echo "==> Create gym B and admin B"
REGISTER_B_PAYLOAD="$(jq -nc \
  --arg gymName "Tenant Gym ${RUN_ID}" \
  --arg gymAddress "Dakar Plateau" \
  --arg gymPhone "$GYM_B_PHONE" \
  --arg adminName "Tenant Admin ${RUN_ID}" \
  --arg email "$ADMIN_B_EMAIL" \
  --arg password "$ADMIN_B_PASSWORD" \
  '{
    gymName: $gymName,
    gymAddress: $gymAddress,
    gymPhone: $gymPhone,
    adminName: $adminName,
    email: $email,
    password: $password,
    setup: {
      currency: "XOF",
      subscriptionTypes: ["MONTHLY"],
      estimatedMembers: 25,
      estimatedCoaches: 3,
      openingHours: "06:00-22:00"
    }
  }')"

REGISTER_B_RESPONSE="$(curl -s -X POST "$API_URL/auth/register-admin" \
  -H 'Content-Type: application/json' \
  -d "$REGISTER_B_PAYLOAD")"

ADMIN_B_TOKEN="$(extract_token "$REGISTER_B_RESPONSE")"
assert_non_empty "$ADMIN_B_TOKEN" "register-admin for gym B failed"

echo "==> Create coach B and member B"
COACH_B_RESPONSE="$(call_api POST /auth/register-user "$ADMIN_B_TOKEN" "$(jq -nc \
  --arg name "Coach B ${RUN_ID}" \
  --arg email "$COACH_B_EMAIL" \
  '{name: $name, email: $email, password: "coach123", role: "COACH"}')")"
COACH_B_ID="$(echo "$COACH_B_RESPONSE" | jq -r '.profile.id // empty')"
assert_non_empty "$COACH_B_ID" "coach B creation failed"

MEMBER_B_RESPONSE="$(call_api POST /auth/register-user "$ADMIN_B_TOKEN" "$(jq -nc \
  --arg name "Member B ${RUN_ID}" \
  --arg email "$MEMBER_B_EMAIL" \
  '{name: $name, email: $email, password: "member123", role: "MEMBER", firstName: "Tenant", lastName: "Member"}')")"
MEMBER_B_ID="$(echo "$MEMBER_B_RESPONSE" | jq -r '.profile.id // empty')"
assert_non_empty "$MEMBER_B_ID" "member B creation failed"

echo "==> Create gym B program and identify gym B subscription"
PROGRAM_B_RESPONSE="$(call_api POST /programs "$ADMIN_B_TOKEN" "$(jq -nc \
  --arg memberId "$MEMBER_B_ID" \
  '{title: "Tenant Isolation Program", description: "gym B only", memberId: $memberId}')")"
PROGRAM_B_ID="$(echo "$PROGRAM_B_RESPONSE" | jq -r '.id // empty')"
assert_non_empty "$PROGRAM_B_ID" "program B creation failed"

SUBS_B_RESPONSE="$(call_api GET /subscriptions "$ADMIN_B_TOKEN")"
SUB_B_ID="$(echo "$SUBS_B_RESPONSE" | jq -r '.[0].id // empty')"
assert_non_empty "$SUB_B_ID" "subscription B lookup failed"

echo "==> Positive controls (gym B can access its own records)"
assert_status "200" "GET" "/members/$MEMBER_B_ID" "$ADMIN_B_TOKEN"
assert_status "200" "GET" "/coaches/$COACH_B_ID/members" "$ADMIN_B_TOKEN"

echo "==> Cross-tenant checks: ADMIN gym A cannot access gym B"
assert_status "404" "GET" "/members/$MEMBER_B_ID" "$ADMIN_A_TOKEN"
assert_status "404" "PATCH" "/programs/$PROGRAM_B_ID/assign" "$ADMIN_A_TOKEN" '{"memberId":null}'
assert_status "404" "PATCH" "/subscriptions/$SUB_B_ID" "$ADMIN_A_TOKEN" '{"name":"Cross Tenant Attempt"}'

echo "==> Cross-tenant checks: COACH gym A cannot access gym B"
assert_status "404" "GET" "/members/$MEMBER_B_ID" "$COACH_A_TOKEN"
assert_status "404" "PATCH" "/members/$MEMBER_B_ID" "$COACH_A_TOKEN" '{"notes":"cross-tenant should fail"}'
assert_status "404" "GET" "/coaches/$COACH_B_ID/members" "$COACH_A_TOKEN"

echo "==> Cross-tenant checks: MEMBER gym A cannot access gym B"
assert_status "404" "GET" "/progress/$MEMBER_B_ID" "$MEMBER_A_TOKEN"

echo "PASS: multi-tenant gym isolation checks passed for ADMIN / COACH / MEMBER."
