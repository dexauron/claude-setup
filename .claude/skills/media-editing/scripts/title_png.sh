#!/usr/bin/env bash
# Титр картинкой: сам переносит строки по ширине, центрирует, даёт мягкую тень.
# Надёжнее drawtext: тот не переносит строки и спотыкается о % : ' в тексте.
# Использование: title_png.sh "ТЕКСТ" OUT.png [WIDTH=920] [SIZE=72] [FONT="Inter:bold"] [COLOR=white]
# Наложение с появлением/исчезновением (титр 2.5 с):
#   ffmpeg -i in.mp4 -loop 1 -t 2.5 -i title.png -filter_complex \
#   "[1:v]format=rgba,fade=t=in:d=0.3:alpha=1,fade=t=out:st=2:d=0.5:alpha=1[t];[0:v][t]overlay=(W-w)/2:H*0.12:eof_action=pass" ...
set -euo pipefail
text="$1"; out="$2"; width="${3:-920}"; size="${4:-72}"
font="$(fc-match -f '%{file}' "${5:-Inter:bold}")"; color="${6:-white}"
# ImageMagick раскрывает %-последовательности в тексте, а @файл запрещён политикой
text="${text//%/%%}"
convert -background none -fill "$color" -font "$font" -pointsize "$size" \
  -size "${width}x" -gravity center caption:"$text" \
  \( +clone -background black -shadow 70x8+0+4 \) +swap \
  -background none -layers merge +repage "$out"
identify -format '%f %wx%h\n' "$out"
