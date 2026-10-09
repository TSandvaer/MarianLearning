#!/bin/zsh
# usage: bench.sh <label> <mode> <port>   (run from mobile/; collector on :8499)
label=$1; mode=$2; port=$3
dir=/private/tmp/claude-502/-Users-thjo-DEV-MarianLearning/d7d032a5-08a1-4702-a78a-9716f8b38714/scratchpad/nw
log=$dir/metro-$label.log
res=$dir/results.txt
touch $res
EXPO_PUBLIC_STYLE_BENCH=1 EXPO_PUBLIC_STYLE_BENCH_MODE=$mode EXPO_PUBLIC_STYLE_BENCH_LABEL=$label EXPO_PUBLIC_MUTE=1 CI=1 \
  npx expo start --go --port $port --clear --no-dev --minify > $log 2>&1 &
until grep -q "Waiting on" $log; do sleep 2; done
for i in 1 2 3; do
  xcrun simctl terminate booted host.exp.Exponent > /dev/null 2>&1
  sleep 2
  xcrun simctl openurl booted exp://127.0.0.1:$port
  n=0
  until [ "$(grep -c "label=$label " $res)" -ge "$i" ] || [ $n -ge 90 ]; do sleep 2; n=$((n+1)); done
done
grep "label=$label " $res
kill $(lsof -nP -iTCP:$port -sTCP:LISTEN -t)
