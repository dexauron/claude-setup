#!/usr/bin/env bash
# Краткая сводка по медиафайлу: длительность, кадр, fps, кодеки, поворот, звук.
# Использование: probe.sh FILE...
set -euo pipefail
for f in "$@"; do
  echo "== $f"
  ffprobe -v error -show_entries \
    format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:stream_side_data=rotation:stream_tags=rotate \
    -of compact=p=0:nk=0 "$f" | sed 's/^/  /'
done
