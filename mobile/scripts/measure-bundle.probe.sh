#!/bin/zsh
# usage: measure-bundle.sh <label>  (run from mobile/). Output dir must not exist yet.
label=$1
out=/private/tmp/claude-502/-Users-thjo-DEV-MarianLearning/d7d032a5-08a1-4702-a78a-9716f8b38714/scratchpad/nw/$label
for plat in ios android; do
  start=$(date +%s)
  npx expo export --platform $plat --output-dir $out/$plat --clear > $out-$plat.log 2>&1
  code=$?
  end=$(date +%s)
  hbc=$(find $out/$plat/_expo/static/js -type f \( -name '*.hbc' -o -name '*.js' \) | head -1)
  echo "$label $plat exit=$code export_s=$((end-start)) bundle=$(stat -f %z $hbc) file=$(basename $hbc)"
done
start=$(date +%s)
npx expo export --platform ios --output-dir $out/ios-js --no-bytecode --source-maps > $out-iosjs.log 2>&1
end=$(date +%s)
js=$(find $out/ios-js/_expo/static/js/ios -name '*.js' | head -1)
map=$(find $out/ios-js/_expo/static/js/ios -name '*.js.map' | head -1)
mods=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$map','utf8')).sources.length)")
echo "$label ios-js export_s=$((end-start)) js_bytes=$(stat -f %z $js) gzip_bytes=$(gzip -9 -c $js | wc -c | tr -d ' ') modules=$mods"
