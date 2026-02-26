#!/usr/bin/env bash
# ============================================================
# SatsFlo Integration Test Script
# Usage: ./test-integration.sh [BASE_URL] [TOKEN]
#
# Examples:
#   ./test-integration.sh http://localhost:3000 eyJhbGciOi...
#   BASE_URL=http://localhost:3000 TOKEN=eyJ... ./test-integration.sh
# ============================================================

set -euo pipefail

BASE="${1:-${BASE_URL:-http://localhost:3000}}/api/v1"
TOKEN="${2:-${TOKEN:-}}"
TODAY="$(date +%F)"
THIS_MONTH="$(date +%Y-%m)"

# ─── Colours ────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

check_token() {
  if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}ERROR: TOKEN is not set.${NC}"
    echo "  Set it as an env var:  TOKEN=eyJ... ./test-integration.sh"
    echo "  Or pass it as arg 2:   ./test-integration.sh $BASE eyJ..."
    exit 1
  fi
}

# ─── Helper: run a curl call and check status ───────────────
run() {
  local label="$1"
  local expected="$2"
  shift 2
  local resp
  resp=$(curl -s -o /dev/null -w "%{http_code}" "$@")
  if [[ "$resp" == "$expected" ]]; then
    echo -e "  ${GREEN}PASS${NC} [${resp}] ${label}"
    ((PASS++)) || true
  else
    echo -e "  ${RED}FAIL${NC} [${resp}] ${label}  (expected ${expected})"
    ((FAIL++)) || true
  fi
}

# Same but also prints the response body
run_body() {
  local label="$1"
  local expected="$2"
  shift 2
  local body status
  body=$(curl -s -w "\n%{http_code}" "$@")
  status=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')
  if [[ "$status" == "$expected" ]]; then
    echo -e "  ${GREEN}PASS${NC} [${status}] ${label}"
    ((PASS++)) || true
  else
    echo -e "  ${RED}FAIL${NC} [${status}] ${label}  (expected ${expected})"
    echo "       Body: $(echo "$body" | head -c 300)"
    ((FAIL++)) || true
  fi
}

AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

# ============================================================
echo -e "\n${CYAN}=== SatsFlo Integration Tests ===${NC}"
echo "  Base URL : $BASE"
echo "  Date     : $TODAY"
echo ""

# ─── Health Check ───────────────────────────────────────────
echo -e "${YELLOW}[Health]${NC}"
run "GET /health" "200" "$BASE/health"

# ─── Cycle Profile ──────────────────────────────────────────
echo -e "\n${YELLOW}[Cycle Profile]${NC}"
check_token

run_body "POST /cycle-profile" "201" \
  -X POST "${AUTH[@]}" \
  -d "{\"cycle_length\":28,\"period_length\":5,\"last_period_start\":\"$TODAY\"}" \
  "$BASE/cycle-profile"

run_body "GET /cycle-profile" "200" \
  "${AUTH[@]}" \
  "$BASE/cycle-profile"

# ─── Day Logs ───────────────────────────────────────────────
echo -e "\n${YELLOW}[Day Logs]${NC}"

run_body "PUT /logs/:date" "200" \
  -X PUT "${AUTH[@]}" \
  -d '{"period_start":true,"flow_level":"medium","symptoms":["cramps","headache"],"moods":["tired"],"water_intake":1500}' \
  "$BASE/logs/$TODAY"

run_body "GET /logs?date=..." "200" \
  "${AUTH[@]}" \
  "$BASE/logs?date=$TODAY"

run_body "GET /logs/range" "200" \
  "${AUTH[@]}" \
  "$BASE/logs/range?from=2025-01-01&to=$TODAY"

# ─── Water Settings ─────────────────────────────────────────
echo -e "\n${YELLOW}[Water Settings]${NC}"

run_body "GET /water-settings" "200" \
  "${AUTH[@]}" \
  "$BASE/water-settings"

run_body "PUT /water-settings" "200" \
  -X PUT "${AUTH[@]}" \
  -d '{"water_target":2500,"cup_capacity":300,"cup_style":"large"}' \
  "$BASE/water-settings"

# ─── Journal ────────────────────────────────────────────────
echo -e "\n${YELLOW}[Journal]${NC}"

run_body "POST /journal" "201" \
  -X POST "${AUTH[@]}" \
  -d "{\"entry_date\":\"$TODAY\",\"content\":\"Feeling good today. Took my vitamins.\"}" \
  "$BASE/journal"

run_body "GET /journal?month=..." "200" \
  "${AUTH[@]}" \
  "$BASE/journal?month=$THIS_MONTH"

# ─── Threads ────────────────────────────────────────────────
echo -e "\n${YELLOW}[Threads]${NC}"

# Public read (no auth)
run_body "GET /threads (public)" "200" \
  -H "Content-Type: application/json" \
  "$BASE/threads"

run_body "GET /threads?tab=popular" "200" \
  -H "Content-Type: application/json" \
  "$BASE/threads?tab=popular"

run_body "GET /threads?search=cycle" "200" \
  -H "Content-Type: application/json" \
  "$BASE/threads?search=cycle"

# Create thread and capture ID
THREAD_RESP=$(curl -s -X POST "${AUTH[@]}" \
  -d '{"content":"Anyone else tracking water intake alongside their cycle?"}' \
  "$BASE/threads")
THREAD_ID=$(echo "$THREAD_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$THREAD_ID" ]]; then
  echo -e "  ${GREEN}PASS${NC} [201] POST /threads  (id=$THREAD_ID)"
  ((PASS++)) || true
else
  echo -e "  ${RED}FAIL${NC} POST /threads — could not parse thread id"
  echo "       Response: $(echo "$THREAD_RESP" | head -c 300)"
  ((FAIL++)) || true
  THREAD_ID="00000000-0000-0000-0000-000000000000"
fi

# ─── Comments ───────────────────────────────────────────────
echo -e "\n${YELLOW}[Comments]${NC}"

run_body "GET /threads/:id/comments" "200" \
  "${AUTH[@]}" \
  "$BASE/threads/$THREAD_ID/comments"

run_body "POST /threads/:id/comments" "201" \
  -X POST "${AUTH[@]}" \
  -d '{"content":"Yes! I track both, helps so much."}' \
  "$BASE/threads/$THREAD_ID/comments"

# ─── Likes ──────────────────────────────────────────────────
echo -e "\n${YELLOW}[Likes]${NC}"

run_body "POST /threads/:id/like" "200" \
  -X POST "${AUTH[@]}" \
  "$BASE/threads/$THREAD_ID/like"

run_body "DELETE /threads/:id/like" "200" \
  -X DELETE "${AUTH[@]}" \
  "$BASE/threads/$THREAD_ID/like"

# ─── Notifications ──────────────────────────────────────────
echo -e "\n${YELLOW}[Notifications]${NC}"

run_body "GET /notifications" "200" \
  "${AUTH[@]}" \
  "$BASE/notifications"

run_body "PATCH /notifications/read-all" "200" \
  -X PATCH "${AUTH[@]}" \
  "$BASE/notifications/read-all"

# ─── Validation edge cases ──────────────────────────────────
echo -e "\n${YELLOW}[Validation — expect 400]${NC}"

run "POST /cycle-profile missing last_period_start" "400" \
  -X POST "${AUTH[@]}" \
  -d '{"cycle_length":28,"period_length":5}' \
  "$BASE/cycle-profile"

run "GET /logs missing date param" "400" \
  "${AUTH[@]}" \
  "$BASE/logs"

run "GET /logs/range missing from param" "400" \
  "${AUTH[@]}" \
  "$BASE/logs/range?to=$TODAY"

run "POST /journal missing content" "400" \
  -X POST "${AUTH[@]}" \
  -d "{\"entry_date\":\"$TODAY\"}" \
  "$BASE/journal"

run "POST /threads missing content" "400" \
  -X POST "${AUTH[@]}" \
  -d '{}' \
  "$BASE/threads"

# ─── Auth guard ─────────────────────────────────────────────
echo -e "\n${YELLOW}[Auth — expect 401]${NC}"

run "POST /cycle-profile no token" "401" \
  -X POST -H "Content-Type: application/json" \
  -d '{"cycle_length":28,"period_length":5,"last_period_start":"2025-01-01"}' \
  "$BASE/cycle-profile"

run "GET /journal no token" "401" \
  -H "Content-Type: application/json" \
  "$BASE/journal?month=$THIS_MONTH"

# ─── Summary ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}══════════════════════════════════${NC}"
echo -e "  Results: ${GREEN}${PASS} passed${NC}  |  ${RED}${FAIL} failed${NC}"
echo -e "${CYAN}══════════════════════════════════${NC}"

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
