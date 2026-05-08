#!/bin/bash

# API Testing Script for ReflectivAI Worker
# This script tests all backend endpoints to verify they're working correctly

BASE_URL="${1:-http://localhost:8787}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${YELLOW}ReflectivAI Backend API Test Suite${NC}"
echo "=================================="
echo "Testing: $BASE_URL"
echo ""

# Test 1: Health Check
echo -n "✓ Health Check... "
RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 2: Login
echo -n "✓ User Login... "
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')

SESSION=$(echo "$LOGIN_RESPONSE" | jq -r '.session.token' 2>/dev/null || echo "")

if [ -n "$SESSION" ]; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 3: Get App Settings
echo -n "✓ Get App Settings... "
SETTINGS=$(curl -s "$BASE_URL/api/apps/public/prod/public-settings/by-id/app1")
if echo "$SETTINGS" | grep -q '"appId"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 4: Get All Snippets
echo -n "✓ Get All Snippets... "
SNIPPETS=$(curl -s "$BASE_URL/api/snippets")
if echo "$SNIPPETS" | grep -q '"snippets"'; then
  COUNT=$(echo "$SNIPPETS" | jq '.total')
  echo -e "${GREEN}PASS${NC} ($COUNT snippets)"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 5: Get Snippets (Filtered)
echo -n "✓ Get Snippets (Category Filter)... "
FILTERED=$(curl -s "$BASE_URL/api/snippets?category=objection_handling")
if echo "$FILTERED" | grep -q 'objection_handling'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 6: Get Snippets (Search)
echo -n "✓ Get Snippets (Search)... "
SEARCH=$(curl -s "$BASE_URL/api/snippets?search=listening")
if echo "$SEARCH" | grep -q '"snippets"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 7: LLM Invoke (Simple)
echo -n "✓ LLM Invoke (Simple Prompt)... "
LLM=$(curl -s -X POST "$BASE_URL/api/llm/invoke" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello"}')
if echo "$LLM" | grep -q '"response"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 8: LLM Invoke (With JSON Schema)
echo -n "✓ LLM Invoke (JSON Schema)... "
LLM_JSON=$(curl -s -X POST "$BASE_URL/api/llm/invoke" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Rate","response_json_schema":{"type":"object"}}')
if echo "$LLM_JSON" | grep -q '"model"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 9: Log User Activity (requires session)
echo -n "✓ Log User Activity... "
LOG=$(curl -s -X POST "$BASE_URL/api/logs/user" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$SESSION" \
  -d '{"event":"test","page":"/test"}')
if echo "$LOG" | grep -q '"success"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 10: Get Current User (requires session)
echo -n "✓ Get Current User... "
USER=$(curl -s "$BASE_URL/api/auth/me" -H "Cookie: session=$SESSION")
if echo "$USER" | grep -q '"id"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 11: Logout
echo -n "✓ User Logout... "
LOGOUT=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Cookie: session=$SESSION")
if echo "$LOGOUT" | grep -q '"success"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 12: Unauthorized Access (no session)
echo -n "✓ Unauthorized Access (401)... "
UNAUTH=$(curl -s "$BASE_URL/api/auth/me")
if echo "$UNAUTH" | grep -q '"error"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 13: 404 Not Found
echo -n "✓ 404 Not Found... "
NOTFOUND=$(curl -s "$BASE_URL/api/nonexistent")
if echo "$NOTFOUND" | grep -q '"error"'; then
  echo -e "${GREEN}PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}FAIL${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "=================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "=================================="
