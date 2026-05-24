#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
AGENT_KEY="${AGENT_KEY:-}"

if [ -z "$AGENT_KEY" ]; then
  echo "Missing AGENT_KEY env var" >&2
  exit 1
fi

HDRS=(
  -H "Content-Type: application/json"
  -H "X-AGENT-KEY: ${AGENT_KEY}"
)

echo "1) customer lookup"
curl -sS "${BASE_URL}/api/agent/customer/lookup" "${HDRS[@]}" \
  -d '{"phone":"(616) 951-2984"}' | cat

echo
echo "2) repair orders lookup (by status)"
curl -sS "${BASE_URL}/api/agent/repair-orders/lookup" "${HDRS[@]}" \
  -d '{"status":"New"}' | cat

echo
echo "3) repair order create (phone-first)"
curl -sS "${BASE_URL}/api/agent/repair-orders/create" "${HDRS[@]}" \
  -d '{
    "customer": {"name": "Test Customer", "phone": "6169512984"},
    "vehicle": {"year": "2020", "make": "Honda", "model": "Civic", "plate": "TEST123"},
    "repairOrder": {"serviceType": "Oil change", "jobDescription": "Customer requests oil change", "notes": "Created via agent", "status": "New"}
  }' | cat

echo
echo "4) repair order update (set status)"
echo "Set RO_ID env var to run this step"
if [ -n "${RO_ID:-}" ]; then
  curl -sS "${BASE_URL}/api/agent/repair-orders/update" "${HDRS[@]}" \
    -d "{\"id\":\"${RO_ID}\",\"status\":\"In Progress\"}" | cat
fi

echo
echo "5) repair order add-note (append)"
echo "Set RO_ID env var to run this step"
if [ -n "${RO_ID:-}" ]; then
  curl -sS "${BASE_URL}/api/agent/repair-orders/add-note" "${HDRS[@]}" \
    -d "{\"id\":\"${RO_ID}\",\"note\":\"Follow-up note from agent\"}" | cat
fi

echo
echo "Done"
