#!/usr/bin/env bash
# Resumable render: 10 s chunks (finished chunks are kept), then concat + soundtrack.
#   bash src/v3/render-chunks.sh   -> out/v3/genlayer-v3.mp4
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=out/v3
mkdir -p $OUT/chunks
DUR=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['duration'])")
N=$(python3 -c "import math;print(math.ceil($DUR/10))")
: > $OUT/chunks/list.txt
for ((k = 0; k < N; k++)); do
  f=$(printf "chunk%02d.mp4" $k)
  echo "file '$f'" >> $OUT/chunks/list.txt
  [ -f $OUT/chunks/$f ] && continue
  to=$(python3 -c "print(min($DUR, ($k + 1) * 10))")
  node src/render.js --page src/v3/index.html --outdir $OUT --fps 30 --workers 3 --from $((k * 10)) --to $to --noaudio --out chunks/tmp.mp4
  mv $OUT/chunks/tmp.mp4 $OUT/chunks/$f
done
ffmpeg -y -v error -f concat -safe 0 -i $OUT/chunks/list.txt -i $OUT/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $OUT/genlayer-v3.mp4
echo done $OUT/genlayer-v3.mp4
