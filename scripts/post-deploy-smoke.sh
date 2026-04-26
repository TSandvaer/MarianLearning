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

# --- 4. POST kind=session-start with a tiny plan → Azure TTS round-trip ----
#
# Catches the entire failure class that motivated ticket 86c9gvgjk: any
# auth/region misconfig (AZURE_SPEECH_KEY missing or wrong, AZURE_SPEECH_REGION
# pointing at the wrong region for the F0 resource, etc.) surfaces here as
# a 502 tts-failed instead of green. The previous WSS pipeline used to time
# out at 8000ms here; the Azure path should answer in <2s wall.
#
# Set TTS_SMOKE_SKIP=1 to skip just this check (e.g. against a preview that
# is intentionally configured without the Azure vars).
if [[ "${TTS_SMOKE_SKIP:-}" == "1" ]]; then
  echo "smoke: POST session-start (Azure TTS) — SKIPPED (TTS_SMOKE_SKIP=1)"
else
  echo "smoke: POST session-start (Azure TTS round-trip)"
  fetch_with_id "post-tts-session-start" POST \
    '{"kind":"session-start","payload":{"plan":{"utterances":[{"id":"smoke.0","text":"Hello Marian."}]}}}'
  if [[ "$LAST_BODY" == *"FUNCTION_INVOCATION_FAILED"* ]]; then
    echo "  FAIL: response contains FUNCTION_INVOCATION_FAILED" >&2
    echo "  body: $LAST_BODY" >&2
    record_failure
  fi
  if [[ "$LAST_CODE" != "200" ]]; then
    echo "  FAIL: expected 200 (Azure TTS happy path), got $LAST_CODE" >&2
    echo "  body: $LAST_BODY" >&2
    record_failure
  else
    # Body shape: { ok: true, kind: "session-start", utterances: [{ id, text,
    # audio: { kind: "inline", base64, mime: "audio/mpeg" } }] }. Use jq if
    # available — falls back to grep so the script is portable without a
    # hard dependency.
    if command -v jq >/dev/null 2>&1; then
      kind=$(printf '%s' "$LAST_BODY" | jq -r '.kind // empty')
      utt_count=$(printf '%s' "$LAST_BODY" | jq -r '.utterances | length // 0')
      first_b64=$(printf '%s' "$LAST_BODY" | jq -r '.utterances[0].audio.base64 // empty')
      first_mime=$(printf '%s' "$LAST_BODY" | jq -r '.utterances[0].audio.mime // empty')

      if [[ "$kind" != "session-start" ]]; then
        echo "  FAIL: response.kind = '$kind' (want 'session-start')" >&2
        record_failure
      fi
      if [[ "$utt_count" -lt 1 ]]; then
        echo "  FAIL: utterances[] is empty (want >=1)" >&2
        record_failure
      fi
      if [[ "$first_mime" != "audio/mpeg" ]]; then
        echo "  FAIL: utterances[0].audio.mime = '$first_mime' (want 'audio/mpeg')" >&2
        record_failure
      fi
      # Validate base64: non-empty, base64 charset, decodes to non-empty
      # bytes whose first 2 bytes look like an MP3 frame header (0xFF 0xFB
      # for MPEG-1 Layer III, mono, 24kHz/48kbps — what the Azure output
      # format header asks for).
      if [[ -z "$first_b64" ]]; then
        echo "  FAIL: utterances[0].audio.base64 is empty" >&2
        record_failure
      else
        if ! printf '%s' "$first_b64" | grep -qE '^[A-Za-z0-9+/]+=*$'; then
          echo "  FAIL: utterances[0].audio.base64 is not valid base64" >&2
          record_failure
        else
          # Decode the first ~6 bytes and check the MP3 sync word. Accept
          # both 0xFFFB (MPEG-1 L3) and 0xFFF3 (MPEG-2 L3) — Azure may
          # emit either depending on bitrate negotiation.
          first_two_hex=$(printf '%s' "$first_b64" | head -c 16 \
            | base64 -d 2>/dev/null | od -An -N2 -tx1 | tr -d ' \n' || true)
          if [[ -z "$first_two_hex" ]]; then
            echo "  FAIL: base64 decoded to empty bytes" >&2
            record_failure
          elif [[ "$first_two_hex" != fffb* && "$first_two_hex" != fff3* && "$first_two_hex" != fffa* && "$first_two_hex" != fff2* ]]; then
            echo "  FAIL: decoded bytes do not start with an MP3 frame sync (got 0x$first_two_hex)" >&2
            record_failure
          fi
        fi
      fi
    else
      # Minimal non-jq fallback: just check the wire-shape strings appear.
      if [[ "$LAST_BODY" != *'"kind":"session-start"'* ]]; then
        echo "  FAIL: body missing kind:session-start" >&2
        record_failure
      fi
      if [[ "$LAST_BODY" != *'"audio":{"kind":"inline"'* ]]; then
        echo "  FAIL: body missing audio:{kind:inline} marker" >&2
        record_failure
      fi
      if [[ "$LAST_BODY" != *'"mime":"audio/mpeg"'* ]]; then
        echo "  FAIL: body missing mime:audio/mpeg marker" >&2
        record_failure
      fi
    fi
  fi
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
