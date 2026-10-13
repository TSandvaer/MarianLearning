# The every-step sweep: `run.sh --sweep [<step>]` (see README.md).
#
# Sourced by run.sh, which owns the device, Metro, the storage reset and
# the cleanup. Uses run.sh's HERE, MOBILE, OUT, UDID, MAESTRO, PORT,
# EXPO_GO, fail() and reset_app_storage().
#
#   sweep_setup <step or "">   lists the steps, starts the sweep API and
#                              sets API_BASE (before Metro starts)
#   sweep_run                  plays every step, prints the table, returns
#                              non-zero on any FAIL or XPASS
#   sweep_stop_api             stops the sweep API (run.sh's EXIT trap)
#
# Bash 3.2 (macOS /bin/bash): no mapfile, no associative arrays.

ROOT="$(cd "$MOBILE/.." && pwd)"
TSX="$ROOT/node_modules/.bin/tsx"
SWEEP_CLI="$ROOT/scripts/maestroSweep.ts"
SWEEP_API_PORT="${MAESTRO_SWEEP_API_PORT:-8398}"
SWEEP_API_LOG="$OUT/sweep-api.jsonl"
SWEEP_API_PID=""
declare -a SWEEP_STEPS=()

sweep_setup() {
  local only="$1" line
  [[ -x "$TSX" ]] ||
    fail "the sweep runs the repo's API handler: run 'yarn install' in $ROOT first"
  [[ "$SWEEP_API_PORT" != "$PORT" ]] || fail "MAESTRO_SWEEP_API_PORT must differ from the Metro port"
  if lsof -nP -iTCP:"$SWEEP_API_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "port $SWEEP_API_PORT is in use: stop that server or set MAESTRO_SWEEP_API_PORT"
  fi

  # `steps` checks the expected-fail list and <step> against core's steps.
  local list
  list="$("$TSX" "$SWEEP_CLI" steps ${only:+--only "$only"})" || exit 1
  while IFS= read -r line; do
    [[ -n "$line" ]] && SWEEP_STEPS+=("$line")
  done <<<"$list"
  ((${#SWEEP_STEPS[@]} > 0)) || fail "no steps to sweep"

  # No credential can reach the API process: `env -i` keeps PATH and HOME
  # only, and the API refuses to start if one is set anyway. It binds
  # 127.0.0.1 and blocks every outbound fetch (scripts/maestroSweepApi.ts).
  echo "Sweep API on :$SWEEP_API_PORT (log: $OUT/sweep-api.out)"
  env -i PATH="$PATH" HOME="$HOME" \
    "$TSX" "$SWEEP_CLI" serve --port "$SWEEP_API_PORT" --log "$SWEEP_API_LOG" \
    >"$OUT/sweep-api.out" 2>&1 &
  SWEEP_API_PID=$!
  for _ in $(seq 1 60); do
    [[ "$(curl -s --max-time 1 "http://127.0.0.1:$SWEEP_API_PORT/__sweep/health" || true)" == ok ]] && break
    kill -0 "$SWEEP_API_PID" 2>/dev/null || fail "the sweep API exited, see $OUT/sweep-api.out"
    sleep 0.5
  done
  [[ "$(curl -s --max-time 1 "http://127.0.0.1:$SWEEP_API_PORT/__sweep/health" || true)" == ok ]] ||
    fail "the sweep API did not start, see $OUT/sweep-api.out"
  API_BASE="http://127.0.0.1:$SWEEP_API_PORT"
}

sweep_stop_api() {
  [[ -n "$SWEEP_API_PID" ]] && kill "$SWEEP_API_PID" >/dev/null 2>&1 || true
}

# Bytes / lines in a file (0 when it doesn't exist yet).
_bytes() { [[ -f "$1" ]] && wc -c <"$1" | tr -d ' ' || echo 0; }
_lines() { [[ -f "$1" ]] && wc -l <"$1" | tr -d ' ' || echo 0; }

sweep_run() {
  local sweep_start=$SECONDS entry node world position xfail
  local dir metro_from api_from start flow_exit verdict_line verdict detail note secs
  local retaps retap_note
  local TAB=$'\t'
  local n_pass=0 n_xfail=0 n_xpass=0 n_fail=0
  declare -a rows=()
  local tsv="$OUT/sweep-results.tsv"
  printf 'verdict\tworld\tposition\tstep\tseconds\tdetail\n' >"$tsv"

  for entry in "${SWEEP_STEPS[@]}"; do
    read -r node world position xfail <<<"$entry"
    dir="$OUT/sweep/$world-$(printf '%02d' "$position")-$node"
    mkdir -p "$dir"
    reset_app_storage
    metro_from="$(_bytes "$OUT/metro.log")"
    api_from="$(_lines "$SWEEP_API_LOG")"
    note=""
    ((xfail)) && note=" (expected to fail)"
    echo
    echo "── sweep $world $position: $node$note ──"
    start=$SECONDS
    flow_exit=0
    # </dev/null: Maestro must not read the step list's stdin.
    "$MAESTRO" --device "$UDID" test \
      -e METRO_URL="exp://127.0.0.1:$PORT" \
      -e STEP="$node" \
      -e WORLD="$world" \
      --debug-output "$dir/maestro" \
      "$HERE/sweep/step.yaml" </dev/null >"$dir/maestro.log" 2>&1 || flow_exit=$?
    # Let Metro write the device's last console lines before slicing.
    sleep 2
    tail -c +"$((metro_from + 1))" "$OUT/metro.log" >"$dir/metro.log"
    tail -n +"$((api_from + 1))" "$SWEEP_API_LOG" >"$dir/api.jsonl"
    verdict_line="$("$TSX" "$SWEEP_CLI" verdict \
      --step "$node" --world "$world" --xfail "$xfail" --flow-exit "$flow_exit" \
      --metro "$dir/metro.log" --api "$dir/api.jsonl")" ||
      verdict_line="FAIL${TAB}the verdict script failed (see above)"
    verdict="${verdict_line%%"$TAB"*}"
    detail="${verdict_line#*"$TAB"}"
    case "$verdict" in
      PASS) n_pass=$((n_pass + 1)) ;;
      XFAIL) n_xfail=$((n_xfail + 1)) ;;
      XPASS) n_xpass=$((n_xpass + 1)) ;;
      *) n_fail=$((n_fail + 1)) ;;
    esac
    secs=$((SECONDS - start))
    # Lost taps tapped again (subflows/tap-and-confirm.yaml, open-app.yaml),
    # in the same "MAESTRO-RETAP xN" form as run.sh's flow result lines.
    retaps="$(grep -c 'MAESTRO-RETAP.*\.\.\. COMPLETED' "$dir/maestro.log" 2>/dev/null || true)"
    retap_note=""
    ((${retaps:-0} > 0)) && retap_note="  MAESTRO-RETAP x$retaps"
    echo "$verdict  $node  $secs s  $detail$retap_note"
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$verdict" "$world" "$position" "$node" "$secs" "$detail$retap_note" >>"$tsv"
    # The table keeps a line per step; the full detail is in the TSV.
    ((${#detail} > 110)) && detail="${detail:0:107}..."
    detail+="$retap_note"
    [[ "$verdict" == PASS || "$verdict" == XFAIL ]] || detail+="  (output: $dir)"
    rows+=("$(printf '%-5s  %-9s  %2s  %-29s  %4s s  %s' \
      "$verdict" "$world" "$position" "$node" "$secs" "$detail")")
  done

  local total=$((SECONDS - sweep_start))
  echo
  echo "── Step sweep results ($UDID) ──"
  printf '%s\n' "${rows[@]}"
  echo "${#SWEEP_STEPS[@]} steps: $n_pass PASS, $n_xfail XFAIL, $n_xpass XPASS, $n_fail FAIL" \
    "in $((total / 60)) min $((total % 60)) s"
  echo "Table: $tsv"
  echo "Output: $OUT"
  ((n_fail == 0 && n_xpass == 0))
}
