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
# inert) but the deployed function was unreachable.
#
# PR #32 (round-1 hot-fix) removed the bad config export but did NOT fix
# production — the real root cause was the default-export shape (a bare
# `export default async function handler(request)` falls through to
# `@vercel/node`'s legacy `(IncomingMessage, ServerResponse)` codepath
# rather than the Web `Request`/`Response` codepath, so the very first
# `request.headers.get(...)` call inside the handler throws TypeError).
# PR #34 (round-2 hot-fix) changes the export to `{ fetch: handler }`.
#
# This script catches that whole regression class at the only place it can
# be observed reliably: against the actually-deployed function. If it
# fails again, the failure footer below points at where in the Vercel
# dashboard to look for the real cold-start exception trace.
#
# What it asserts
# ---------------
#   1. OPTIONS preflight returns a 2xx (CORS works, module loads, handler
#      is reachable).
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

# Track Vercel request IDs from any failing assertion. The X-Vercel-Id
# header uniquely identifies the invocation in the Vercel dashboard's
# Functions → Logs view. Without this, future-Devon has to guess which
# log line corresponds to the smoke failure.
failed_vercel_ids=()

# Single combined headers-and-body capture. We need the headers to extract
# X-Vercel-Id even on failure, so capturing them inline avoids a second
# round-trip (which would have a different request ID anyway).
fetch_with_id() {
  local label="$1"
  local method="$2"
  local data="${3:-}"
  local extra_headers=()
  if [[ -n "$data" ]]; then
    extra_headers+=(-H 'Content-Type: application/json' -d "$data")
  fi

  local raw
  raw=$(curl -s -i -X "$method" "$ENDPOINT" \
    -H 'Origin: http://localhost:5173' \
    "${extra_headers[@]}" \
    -w '\n__HTTP__%{http_code}__' \
    --max-time 15)

  local code body header_block
  code="${raw##*__HTTP__}"
  code="${code%__*}"
  body="${raw%$'\n'__HTTP__*__}"
  header_block="$(printf '%s' "$body" | sed -n '1,/^\r\?$/p')"
  body="$(printf '%s' "$body" | sed -e '1,/^\r\?$/d')"

  local vercel_id
  vercel_id=$(printf '%s' "$header_block" \
    | grep -i '^x-vercel-id:' \
    | head -n1 \
    | tr -d '\r' \
    | sed -e 's/^[Xx]-[Vv]ercel-[Ii]d:[[:space:]]*//')

  # Stash via globals — bash arrays from functions are awkward and we don't
  # want to over-engineer this. Read by the caller via these names.
  LAST_CODE="$code"
  LAST_BODY="$body"
  LAST_VERCEL_ID="$vercel_id"

  echo "  HTTP $code  X-Vercel-Id: ${vercel_id:-<none>}"
}

record_failure() {
  fail=1
  # Dedupe: a single bad request can fail multiple assertions (status code
  # AND body content), and we don't want to print the same request ID
  # three times in the failure footer.
  if [[ -n "${LAST_VERCEL_ID:-}" ]]; then
    local already=0
    for existing in "${failed_vercel_ids[@]:-}"; do
      if [[ "$existing" == "$LAST_VERCEL_ID" ]]; then
        already=1
        break
      fi
    done
    if [[ "$already" -eq 0 ]]; then
      failed_vercel_ids+=("$LAST_VERCEL_ID")
    fi
  fi
}

# --- 1. OPTIONS preflight -------------------------------------------------
echo "smoke: OPTIONS preflight"
fetch_with_id "options" OPTIONS
if [[ "$LAST_BODY" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $LAST_BODY" >&2
  record_failure
fi
if [[ "$LAST_CODE" != "204" && "$LAST_CODE" != "200" ]]; then
  echo "  FAIL: expected 204 or 200, got $LAST_CODE" >&2
  record_failure
fi

# --- 2. POST with invalid JSON --------------------------------------------
echo "smoke: POST invalid JSON"
fetch_with_id "post-invalid-json" POST 'not-valid-json'
if [[ "$LAST_BODY" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $LAST_BODY" >&2
  record_failure
fi
if [[ "$LAST_CODE" != "400" ]]; then
  echo "  FAIL: expected 400 (invalid-json), got $LAST_CODE" >&2
  echo "  body: $LAST_BODY" >&2
  record_failure
fi
if [[ "$LAST_BODY" != *"invalid-json"* ]]; then
  echo "  FAIL: expected 'invalid-json' in body, got: $LAST_BODY" >&2
  record_failure
fi

# --- 3. POST with malformed kind ------------------------------------------
echo "smoke: POST malformed body (unknown kind)"
fetch_with_id "post-malformed" POST '{"kind":"nonsense","payload":{}}'
if [[ "$LAST_BODY" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
  echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
  echo "  body: $LAST_BODY" >&2
  record_failure
fi
if [[ "$LAST_CODE" != "400" ]]; then
  echo "  FAIL: expected 400 (invalid-body), got $LAST_CODE" >&2
  echo "  body: $LAST_BODY" >&2
  record_failure
fi

if [[ "$fail" -ne 0 ]]; then
  echo "" >&2
  echo "==============================================================" >&2
  echo "smoke: FAILED  —  where to look for the cold-start trace" >&2
  echo "==============================================================" >&2
  echo "Target:    $ENDPOINT" >&2
  if [[ ${#failed_vercel_ids[@]} -gt 0 ]]; then
    echo "Vercel request IDs (search these in the Functions → Logs view):" >&2
    for id in "${failed_vercel_ids[@]}"; do
      echo "  - $id" >&2
    done
  else
    echo "Vercel request IDs: <none captured — likely a network/DNS error" >&2
    echo "  reaching the deployment, not a function failure>" >&2
  fi
  echo "" >&2
  echo "Open the Vercel dashboard for the marian-learning project, go to" >&2
  echo "the deployment that matches the current main SHA, then:" >&2
  echo "  Functions  →  api/claude  →  Logs" >&2
  echo "Filter by one of the request IDs above to find the exception" >&2
  echo "trace. FUNCTION_INVOCATION_FAILED with no body almost always" >&2
  echo "means a synchronous throw at module-load OR on the first line of" >&2
  echo "the handler — read the stack from the top." >&2
  echo "" >&2
  echo "If every request ID is missing entirely, check Vercel Project" >&2
  echo "Settings → Deployment Protection — preview/prod SSO can mask the" >&2
  echo "real status by returning a 401 HTML page from a different layer." >&2
  echo "==============================================================" >&2
  exit 1
fi
echo "smoke: PASSED"
