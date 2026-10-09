#!/usr/bin/env bash
# Лист контактов: кадры видео с ТОЧНЫМИ таймкодами в одной картинке.
# Так видео можно «посмотреть» одним Read вместо десятков кадров.
# Каждый кадр берётся отдельным поиском (-ss), подпись — его настоящий pts:
# фильтр fps при прореживании подменяет кадры, и подписи начинают врать.
# Использование: contact_sheet.sh VIDEO [COLS=4] [ROWS=4] [OUT=VIDEO.sheet.jpg] [START=0] [END=конец]
set -euo pipefail
in="$1"; cols="${2:-4}"; rows="${3:-4}"; out="${4:-${in%.*}.sheet.jpg}"
start="${5:-0}"
end="${6:-$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")}"
n=$((cols * rows))
font="$(fc-match -f '%{file}' 'DejaVu Sans:bold')"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
for i in $(seq 0 $((n - 1))); do
  t=$(awk -v s="$start" -v e="$end" -v i="$i" -v n="$n" 'BEGIN{printf "%.3f", s+(e-s)*(i+0.5)/n}')
  ffmpeg -v error -y -ss "$t" -copyts -i "$in" -frames:v 1 -vf \
    "scale=480:-2,drawtext=fontfile=${font}:text='%{pts\:hms}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4" \
    "$tmp/$(printf %03d "$i").png"
done
montage "$tmp"/*.png -tile "${cols}x${rows}" -geometry +4+4 -background black -quality 85 "$out"
echo "$out"
