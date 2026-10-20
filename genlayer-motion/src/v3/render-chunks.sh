#!/usr/bin/env bash
# Resumable render: 10 s chunks (finished chunks are kept), then concat + soundtrack.
#   bash src/v3/render-chunks.sh                      -> out/v3/genlayer-v3.mp4 (30 fps)
#   FPS=60 SCALE=1.5 TAG=hq bash src/v3/render-chunks.sh -> out/v3/genlayer-v3-hq.mp4 (60 fps, supersampled)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=out/v3
FPS=${FPS:-30}
SCALE=${SCALE:-1}
TAG=${TAG:-}
CH=chunks${TAG:+-$TAG}
FINAL=$OUT/genlayer-v3${TAG:+-$TAG}.mp4
mkdir -p $OUT/$CH
DUR=$(python3 -c "import json;print(json.load(open('$OUT/timeline.json'))['duration'])")
N=$(python3 -c "import math;print(math.ceil($DUR/10))")
: > $OUT/$CH/list.txt
for ((k = 0; k < N; k++)); do
  f=$(printf "chunk%02d.mp4" $k)
  echo "file '$f'" >> $OUT/$CH/list.txt
  [ -f $OUT/$CH/$f ] && continue
  to=$(python3 -c "print(min($DUR, ($k + 1) * 10))")
  node src/render.js --page src/v3/index.html --outdir $OUT --fps $FPS --workers 4 --scale $SCALE --quality 100 --crf 12 --from $((k * 10)) --to $to --noaudio --out $CH/tmp.mp4
  mv $OUT/$CH/tmp.mp4 $OUT/$CH/$f
done
ffmpeg -y -v error -f concat -safe 0 -i $OUT/$CH/list.txt -i $OUT/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $FINAL
echo done $FINAL
