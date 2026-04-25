#!/usr/bin/env bash
# Post-deploy smoke check for /api/claude.
#
# Why this exists
# ---------------
# PR #28 (Path A — server-side TTS pipeline) shipped with a broken Vercel
# runtime config (`export const config = { runtime: 'nodejs' }`) that was
# silently rejected by Vercel and caused FUNCTION_INVOCATION_FAILED at
# cold-start on every request — including OPTIONS preflight and invalid
# bodies, i.e. requests that never reach the handler. The unit tests passed
# (they imported the module locally where the magic-string export was
# inert) but the deployed function was unreachable. This script catches
# that regression class at the only place it can be observed: against the
# actually-deployed function.
#
# What it asserts
# ---------------
#   1. OPTIONS preflight returns a 2xx (CORS works, module loads).
#   2. POST with an invalid JSON body returns 400 with `error: invalid-json`
#      (handler is reached and returns a structured error).
#   3. NEITHER response is `FUNCTION_INVOCATION_FAILED`.
#
# Usage
# -----
#   ./scripts/post-deploy-smoke.sh https://marian-learning.vercel.app
#
# Exits 0 on success, non-zero on any failure.

set -euo pipefail

BASE_URL="${1:-${SMOKE_BASE_URL:-}}"
if [[ -z "$BASE_URL" ]]; then
  echo "usage: $0 <base-url>   e.g. https://marian-learning.vercel.app" >&2
  exit 2
fi

ENDPOINT="${BASE_URL%/}/api/claude"
echo "smoke: target = $ENDPOINT"

fail=0

# --- 1. OPTIONS preflight -------------------------------------------------
echo "smoke: OPTIONS preflight"
options_body=$(curl -s -X OPTIONS "$ENDPOINT" \
  -H 'Origin: http://localhost:5173' \
  -w '\n__HTTP__%{http_code}__' \
  --max-time 15)
options_code="${options_body##*__HTTP__}"
options_code="${options_code%__*}"
options_payload="${options_body%__HTTP__*__}"

echo "  HTTP $options_code"
if [[ "$options_payload" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $options_payload" >&2
  fail=1
fi
if [[ "$options_code" != "204" && "$options_code" != "200" ]]; then
  echo "  FAIL: expected 204 or 200, got $options_code" >&2
  fail=1
fi

# --- 2. POST with invalid JSON --------------------------------------------
echo "smoke: POST invalid JSON"
post_body=$(curl -s -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d 'not-valid-json' \
  -w '\n__HTTP__%{http_code}__' \
  --max-time 15)
post_code="${post_body##*__HTTP__}"
post_code="${post_code%__*}"
post_payload="${post_body%__HTTP__*__}"

echo "  HTTP $post_code"
if [[ "$post_payload" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $post_payload" >&2
  fail=1
fi
if [[ "$post_code" != "400" ]]; then
  echo "  FAIL: expected 400 (invalid-json), got $post_code" >&2
  echo "  body: $post_payload" >&2
  fail=1
fi
if [[ "$post_payload" != *"invalid-json"* ]]; then
  echo "  FAIL: expected 'invalid-json' in body, got: $post_payload" >&2
  fail=1
fi

# --- 3. POST with malformed kind ------------------------------------------
echo "smoke: POST malformed body (unknown kind)"
mal_body=$(curl -s -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"nonsense","payload":{}}' \
  -w '\n__HTTP__%{http_code}__' \
  --max-time 15)
mal_code="${mal_body##*__HTTP__}"
mal_code="${mal_code%__*}"
mal_payload="${mal_body%__HTTP__*__}"

echo "  HTTP $mal_code"
if [[ "$mal_payload" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $mal_payload" >&2
  fail=1
fi
if [[ "$mal_code" != "400" ]]; then
  echo "  FAIL: expected 400 (invalid-body), got $mal_code" >&2
  echo "  body: $mal_payload" >&2
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "smoke: FAILED" >&2
  exit 1
fi
echo "smoke: PASSED"
