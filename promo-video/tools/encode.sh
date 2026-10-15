#!/usr/bin/env bash
# The final files: picture from render.js, sound from mix.py.
#   tools/encode.sh   →  out/hmar-ashshuara.mp4          (1080×1920, for upload)
#                        out/hmar-ashshuara-whatsapp.mp4 (720×1280, light, to send in chats)
#                        out/cover.jpg                   (the title, for platforms that ask for a cover)
set -euo pipefail
cd "$(dirname "$0")/.."
lang=ar
pic=build/$lang/video.mp4
snd=build/$lang/mix.wav
mkdir -p out
meta=(-metadata "title=حمار الشعراء · benjelloun.dev/hmittou"
      -metadata "comment=القراءة والضبط والنشر وإنتاج الفيديو: خالد بنجلّون، فاس · إلقاء: محمد سايد"
      -metadata "artist=Khalid Benjelloun" -metadata:s:a:0 "language=ara")

ffmpeg -y -v error -i "$pic" -i "$snd" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 19 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -profile:v high -level 4.2 \
  -g 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart "${meta[@]}" out/hmar-ashshuara.mp4

ffmpeg -y -v error -i "$pic" -i "$snd" -map 0:v -map 1:a \
  -vf "scale=720:1280:flags=lanczos" -c:v libx264 -preset slow -b:v 1500k -maxrate 2200k -bufsize 4400k \
  -pix_fmt yuv420p -profile:v high -level 4.0 -g 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 128k -ar 48000 -movflags +faststart "${meta[@]}" out/hmar-ashshuara-whatsapp.mp4

t=$(python3 -c "import json; d=json.load(open('scene/timeline.$lang.json', encoding='utf-8')); print(d['scenes']['title']['start'] + 2.6)")
ffmpeg -y -v error -ss "$t" -i "$pic" -frames:v 1 -q:v 2 out/cover.jpg

ls -la out/
