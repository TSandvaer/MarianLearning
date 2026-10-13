#!/usr/bin/env bash
# Runs the Maestro flows against Expo Go on an iOS simulator.
#
#   mobile/maestro/run.sh                    # every flow in flows/, in order
#   mobile/maestro/run.sh mobile/maestro/flows/03-word-song.yaml
#
# Run from the repo root as above, or from mobile/ as maestro/run.sh. Flow
# paths are relative to the current directory.
#
# Env:
#   MAESTRO_DEVICE      simulator UDID (default: the only booted simulator)
#   MAESTRO_METRO_PORT  Metro port (default 8399)
#   MAESTRO_OUT         where Metro's log and Maestro's debug output go
#                       (default: a fresh temp dir, printed at the end)
#   MAESTRO_FLOW_RETRIES  reruns of a failed flow, each from empty storage
#                       (default 0; the CI workflow sets 1). A flow that
#                       passes on a rerun reports "PASS (retry)".
#
# Markers in the output, for grepping a CI log:
#   MAESTRO-RETAP  a Hub card tap was lost and tapped again
#                  (subflows/tap-hub-card.yaml); counted per flow
#   MAESTRO-RETRY  a failed flow is being run again
#
# What it does: starts ONE Metro with the harness's bundle-time flags
# (below), then for each flow quits Expo Go, empties the app's storage on
# that simulator (so every flow starts as a fresh install) and runs it.
# Per-flow state (seed, day offset) travels as iOS launch arguments, which
# the flows pass in `launchApp: arguments:`.
#
# WARNING: it empties the Marian Tutor storage inside Expo Go on the chosen
# simulator. Use a simulator you don't need the progress of.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$(cd "$HERE/.." && pwd)"
PORT="${MAESTRO_METRO_PORT:-8399}"
OUT="${MAESTRO_OUT:-$(mktemp -d -t marian-maestro)}"
mkdir -p "$OUT"
EXPO_GO=host.exp.Exponent

# The API base the bundle gets: a closed local port. Every /api/claude call
# fails at once (connection refused), so Math and Word Song run core's
# static plans with silent captions, exactly like an offline iPad. Nothing
# reaches production and nothing is billed.
UNREACHABLE_API=http://127.0.0.1:9

fail() {
  echo "run.sh: $*" >&2
  exit 1
}

# ── Tools ────────────────────────────────────────────────────────────────
if [[ -z "${JAVA_HOME:-}" ]] && ! /usr/libexec/java_home >/dev/null 2>&1; then
  # Maestro needs Java 17+. Homebrew's keg-only openjdk@17 is not on PATH.
  BREW_JDK=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  [[ -x "$BREW_JDK/bin/java" ]] ||
    fail "Maestro needs Java 17+: brew install openjdk@17, or set JAVA_HOME"
  export JAVA_HOME="$BREW_JDK"
fi
MAESTRO="$(command -v maestro || true)"
[[ -n "$MAESTRO" ]] || MAESTRO="$HOME/.maestro/bin/maestro"
[[ -x "$MAESTRO" ]] || fail "maestro not found (see mobile/maestro/README.md)"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

# ── Device ───────────────────────────────────────────────────────────────
UDID="${MAESTRO_DEVICE:-}"
if [[ -z "$UDID" ]]; then
  BOOTED="$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' || true)"
  [[ -n "$BOOTED" ]] || fail "no booted simulator: boot one or set MAESTRO_DEVICE"
  [[ "$(wc -l <<<"$BOOTED" | tr -d ' ')" == 1 ]] ||
    fail "several simulators are booted: set MAESTRO_DEVICE to one of
$BOOTED"
  UDID="$BOOTED"
fi
xcrun simctl get_app_container "$UDID" "$EXPO_GO" >/dev/null 2>&1 ||
  fail "Expo Go is not installed on $UDID: run 'npx expo start --go --ios' once"
# Expo Go's first-run onboarding would cover the app.
xcrun simctl spawn "$UDID" defaults write "$EXPO_GO" EXDevMenuIsOnboardingFinished -bool YES
xcrun simctl spawn "$UDID" defaults write "$EXPO_GO" ExpoGoOnboardingFinished -bool YES

# ── Guards ───────────────────────────────────────────────────────────────
if nc -z -G 2 127.0.0.1 9 >/dev/null 2>&1; then
  fail "something listens on 127.0.0.1:9; the harness needs it closed"
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port $PORT is in use: stop that server or set MAESTRO_METRO_PORT"
fi

# ── Metro ────────────────────────────────────────────────────────────────
stop_metro() {
  xcrun simctl terminate "$UDID" "$EXPO_GO" >/dev/null 2>&1 || true
  [[ -n "${METRO_PID:-}" ]] && kill "$METRO_PID" >/dev/null 2>&1 || true
  local pids
  pids="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -n "$pids" ]] && kill $pids >/dev/null 2>&1 || true
}
trap stop_metro EXIT

echo "Metro on :$PORT (log: $OUT/metro.log)"
# `env -i`-style hygiene without losing PATH/HOME: drop every app flag the
# shell might carry, then set the harness's. EXPO_NO_DOTENV keeps a local
# mobile/.env* (cloud-sync secret, another API base) out of the bundle.
# `--clear`: Metro caches inlined EXPO_PUBLIC_* values across restarts.
(
  cd "$MOBILE"
  exec env \
    -u EXPO_PUBLIC_PROGRESS_API_SECRET \
    -u EXPO_PUBLIC_SEED \
    -u EXPO_PUBLIC_DAY_OFFSET \
    -u EXPO_PUBLIC_QA_ROUTE \
    -u EXPO_PUBLIC_AUDIO_CHECK \
    EXPO_NO_DOTENV=1 \
    CI=1 \
    EXPO_PUBLIC_API_BASE="$UNREACHABLE_API" \
    EXPO_PUBLIC_MUTE=1 \
    EXPO_PUBLIC_DEBUG=1 \
    EXPO_PUBLIC_QA_AUTOTAP_MS=2500 \
    npx expo start --go --offline --port "$PORT" --clear
) >"$OUT/metro.log" 2>&1 &
METRO_PID=$!

for _ in $(seq 1 120); do
  if [[ "$(curl -s --max-time 2 "http://127.0.0.1:$PORT/status" || true)" == "packager-status:running" ]]; then
    break
  fi
  kill -0 "$METRO_PID" 2>/dev/null || fail "Metro exited, see $OUT/metro.log"
  sleep 1
done
[[ "$(curl -s --max-time 2 "http://127.0.0.1:$PORT/status" || true)" == "packager-status:running" ]] ||
  fail "Metro did not start in 120 s, see $OUT/metro.log"

# Build the iOS bundle once before any flow, from the URL the manifest
# gives Expo Go, so Expo Go's own request is served warm. A cold build takes
# ~10 s on an M5 Mac but ~140 s on a hosted CI runner, longer than the first
# flow's 120 s wait for its first screen.
BUNDLE_URL="$(
  curl -s --max-time 60 \
    -H 'expo-platform: ios' -H 'accept: application/expo+json,application/json' \
    "http://127.0.0.1:$PORT/" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).launchAsset.url)}catch{}})' ||
    true
)"
[[ -n "$BUNDLE_URL" ]] || fail "Metro served no iOS manifest, see $OUT/metro.log"
warm_start=$SECONDS
curl -sf --max-time 600 -o /dev/null "$BUNDLE_URL" ||
  fail "the iOS bundle did not build, see $OUT/metro.log"
echo "iOS bundle built in $((SECONDS - warm_start)) s"

# ── Flows ────────────────────────────────────────────────────────────────
reset_app_storage() {
  xcrun simctl terminate "$UDID" "$EXPO_GO" >/dev/null 2>&1 || true
  local data db
  data="$(xcrun simctl get_app_container "$UDID" "$EXPO_GO" data)"
  # Expo Go keeps each project's expo-sqlite files under its scope key.
  for db in "$data"/Documents/ExponentExperienceData/*/marian-tutor*/SQLite/ExpoSQLiteStorage; do
    [[ -f "$db" ]] && sqlite3 "$db" 'DELETE FROM storage;'
  done
  return 0
}

if [[ $# -gt 0 ]]; then
  FLOWS=("$@")
else
  FLOWS=("$HERE"/flows/*.yaml)
fi

RETRIES="${MAESTRO_FLOW_RETRIES:-0}"
[[ "$RETRIES" =~ ^[0-9]+$ ]] || fail "MAESTRO_FLOW_RETRIES must be a whole number, got '$RETRIES'"

# One attempt: empty storage, then the flow. Maestro's console output goes
# to the terminal and to <dir>.log, where the MAESTRO-RETAP lines are
# counted.
run_attempt() { # <flow> <debug dir>
  reset_app_storage
  "$MAESTRO" --device "$UDID" test \
    -e METRO_URL="exp://127.0.0.1:$PORT" \
    --debug-output "$2" \
    "$1" 2>&1 | tee "$2.log"
}

declare -a RESULTS=()
FAILED=0
TOTAL_RETAPS=0
TOTAL_RERUNS=0
for flow in "${FLOWS[@]}"; do
  name="$(basename "$flow" .yaml)"
  start=$SECONDS
  attempt=1
  retaps=0
  retapped=""
  while :; do
    dir="$OUT/$name"
    ((attempt > 1)) && dir="$OUT/$name-attempt$attempt"
    passed=0
    run_attempt "$flow" "$dir" && passed=1
    # Maestro prints a command once, when it ends: one line per re-tap.
    n="$(grep -c 'MAESTRO-RETAP' "$dir.log" 2>/dev/null || true)"
    retaps=$((retaps + ${n:-0}))
    # Which card: tap-hub-card.yaml's `when` (the only one in the flows)
    # completes only when it re-taps.
    retapped+="$(sed -n 's/.*Run flow when id: \([A-Za-z0-9_-]*\) is visible\.\.\. COMPLETED.*/ \1/p' "$dir.log" 2>/dev/null | tr -d '\n' || true)"
    ((passed || attempt > RETRIES)) && break
    attempt=$((attempt + 1))
    TOTAL_RERUNS=$((TOTAL_RERUNS + 1))
    echo "MAESTRO-RETRY $name: failed, running it again from empty storage" \
      "(attempt $attempt of $((RETRIES + 1)); the failed attempt's output: ${dir})"
  done
  TOTAL_RETAPS=$((TOTAL_RETAPS + retaps))

  if ((passed)); then
    line="PASS"
    ((attempt > 1)) && line="PASS (retry)"
  else
    line="FAIL"
    FAILED=1
  fi
  line+="  $name  $((SECONDS - start)) s"
  ((attempt > 1)) && line+="  ($attempt attempts)"
  ((retaps > 0)) && line+="  MAESTRO-RETAP x$retaps${retapped:+ (${retapped# })}"
  ((passed)) || line+="  (debug: $dir)"
  RESULTS+=("$line")
done

echo
echo "── Maestro results ($UDID) ──"
printf '%s\n' "${RESULTS[@]}"
echo "Lost-tap re-taps: $TOTAL_RETAPS · flow reruns: $TOTAL_RERUNS"
echo "Output: $OUT"
exit "$FAILED"
