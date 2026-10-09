#!/usr/bin/env bash
# Рендер рилса: Remotion → mp4, затем точная громкость −14 LUFS.
# Использование: render.sh OUTDIR OUT.mp4   (OUTDIR — то, что собрал build_reel.py)
set -euo pipefail
dir="$(cd "$1" && pwd)"; out="$2"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skill="$here/../.claude/skills/media-editing/scripts"
tmp="$dir/_render.mp4"
(cd "$here" && npx remotion render src/index.ts ScreenTutorial "$tmp" \
  --props="$dir/reel.json" --public-dir="$dir" --concurrency=4 --log=error)
ffmpeg -v error -y -i "$tmp" -c:v copy -af "$("$skill/loudnorm_filter.py" "$tmp" --i -14)" \
  -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$out"
rm -f "$tmp"
echo "$out"
