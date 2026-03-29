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

echo "==> Login ADMIN/COACH/MEMBER"
ADMIN_LOGIN="$(login admin@atlasgym.local admin123)"
COACH_LOGIN="$(login coach@atlasgym.local coach123)"
MEMBER_LOGIN="$(login member@atlasgym.local member123)"

ADMIN_TOKEN="$(extract_token "$ADMIN_LOGIN")"
COACH_TOKEN="$(extract_token "$COACH_LOGIN")"
MEMBER_TOKEN="$(extract_token "$MEMBER_LOGIN")"

assert_non_empty "$ADMIN_TOKEN" "admin login failed"
assert_non_empty "$COACH_TOKEN" "coach login failed"
assert_non_empty "$MEMBER_TOKEN" "member login failed"

echo "==> ADMIN flow"
ADMIN_MEMBERS="$(call_api GET /members "$ADMIN_TOKEN")"
ADMIN_PROGRAMS="$(call_api GET /programs "$ADMIN_TOKEN")"
MEMBER_ID="$(echo "$ADMIN_MEMBERS" | jq -r '.[0].id // empty')"
PROGRAM_ID="$(echo "$ADMIN_PROGRAMS" | jq -r '.[0].id // empty')"
assert_non_empty "$MEMBER_ID" "no member returned for admin"
assert_non_empty "$PROGRAM_ID" "no program returned for admin"

ASSIGN_RESULT="$(call_api PATCH "/programs/$PROGRAM_ID/assign" "$ADMIN_TOKEN" "{\"memberId\":\"$MEMBER_ID\"}")"
ASSIGNED_MEMBER="$(echo "$ASSIGN_RESULT" | jq -r '.memberId // empty')"
assert_non_empty "$ASSIGNED_MEMBER" "admin could not assign program"

NEW_MEMBER_PAYLOAD='{"firstName":"Test","lastName":"NoCoach","phone":"+221999000001"}'
NEW_MEMBER_RESULT="$(call_api POST /members "$ADMIN_TOKEN" "$NEW_MEMBER_PAYLOAD")"
NEW_MEMBER_ID="$(echo "$NEW_MEMBER_RESULT" | jq -r '.id // empty')"
assert_non_empty "$NEW_MEMBER_ID" "admin could not create an unassigned member"

echo "==> COACH flow"
COACH_MEMBERS="$(call_api GET /members "$COACH_TOKEN")"
COACH_MEMBER_ID="$(echo "$COACH_MEMBERS" | jq -r '.[0].id // empty')"
assert_non_empty "$COACH_MEMBER_ID" "coach has no assigned member"

COACH_UPDATE_OK="$(call_api PATCH "/members/$COACH_MEMBER_ID" "$COACH_TOKEN" '{"notes":"updated by coach smoke test"}')"
UPDATED_NOTE="$(echo "$COACH_UPDATE_OK" | jq -r '.notes // empty')"
assert_non_empty "$UPDATED_NOTE" "coach failed to update assigned member"

COACH_FORBIDDEN_HTTP="$(curl -s -o /tmp/coach_forbidden.json -w '%{http_code}' -X PATCH "$API_URL/members/$NEW_MEMBER_ID" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"notes":"should fail"}')"
if [[ "$COACH_FORBIDDEN_HTTP" != "403" ]]; then
  echo "FAIL: coach update outside assignment should return 403 (got $COACH_FORBIDDEN_HTTP)"
  cat /tmp/coach_forbidden.json
  exit 1
fi

echo "==> MEMBER flow"
MEMBER_PROGRAMS="$(call_api GET /programs "$MEMBER_TOKEN")"
MEMBER_PROGRAM_ID="$(echo "$MEMBER_PROGRAMS" | jq -r '.[0].id // empty')"
assert_non_empty "$MEMBER_PROGRAM_ID" "member has no assigned program"

SELF_ATTENDANCE_HTTP="$(curl -s -o /tmp/member_attendance.json -w '%{http_code}' -X POST "$API_URL/attendance/self" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"programId\":\"$MEMBER_PROGRAM_ID\"}")"
if [[ "$SELF_ATTENDANCE_HTTP" != "201" ]]; then
  echo "FAIL: member attendance self-validation failed (HTTP $SELF_ATTENDANCE_HTTP)"
  cat /tmp/member_attendance.json
  exit 1
fi

MEMBER_QR="$(call_api GET /members/me/qr "$MEMBER_TOKEN")"
QR_TOKEN="$(echo "$MEMBER_QR" | jq -r '.qrToken // empty')"
assert_non_empty "$QR_TOKEN" "member QR token not found"

echo "==> QR anti-double scan (5 min cooldown)"
FIRST_SCAN_HTTP="$(curl -s -o /tmp/qr_first.json -w '%{http_code}' -X POST "$API_URL/attendance/scan" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"qrToken\":\"$QR_TOKEN\"}")"
if [[ "$FIRST_SCAN_HTTP" != "201" && "$FIRST_SCAN_HTTP" != "409" ]]; then
  echo "FAIL: first QR scan unexpected HTTP status ($FIRST_SCAN_HTTP)"
  cat /tmp/qr_first.json
  exit 1
fi

if [[ "$FIRST_SCAN_HTTP" == "409" ]]; then
  echo "INFO: cooldown already active for seeded member, validating block payload."
  NEXT_ALLOWED="$(cat /tmp/qr_first.json | jq -r '.nextAllowedAt // empty')"
  assert_non_empty "$NEXT_ALLOWED" "missing nextAllowedAt in QR cooldown response"
fi

SECOND_SCAN_HTTP="$(curl -s -o /tmp/qr_second.json -w '%{http_code}' -X POST "$API_URL/attendance/scan" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"qrToken\":\"$QR_TOKEN\"}")"
if [[ "$SECOND_SCAN_HTTP" != "409" ]]; then
  echo "FAIL: second QR scan should be blocked with 409 (got $SECOND_SCAN_HTTP)"
  cat /tmp/qr_second.json
  exit 1
fi

echo "PASS: ADMIN / COACH / MEMBER flows are healthy."
