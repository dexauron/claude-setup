#!/bin/bash
# Набор для монтажа фото и видео в облачных сессиях Claude Code.
# Ставит недостающее и скачивает модели; повторный запуск ничего не делает.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── Системные утилиты: метаданные и сводка по файлам ──
if ! command -v exiftool >/dev/null || ! command -v mediainfo >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libimage-exiftool-perl mediainfo >/dev/null
fi

# ── Python: расшифровка речи, склейки, удаление фона, HEIC, загрузка ──
# av<19: в PyAV 19 faster-whisper не может прочитать звук из файла
if ! python3 -c 'import cv2, faster_whisper, scenedetect, rembg, filetype, pillow_heif, av, sys; sys.exit(int(av.__version__.split(".")[0]) >= 19)' 2>/dev/null \
   || ! command -v yt-dlp >/dev/null; then
  pip3 install -q --break-system-packages \
    opencv-python-headless faster-whisper "av<19" scenedetect "rembg[cpu,cli]" pillow-heif yt-dlp
fi

# ── Модели: скачиваются один раз и остаются в кэше контейнера ──
# Проверка по файлам, без загрузки моделей в память — так быстрее.
python3 - <<'PY'
from faster_whisper.utils import download_model

try:
    download_model("small", local_files_only=True)
except Exception:
    download_model("small")
PY
if ! ls "${U2NET_HOME:-$HOME/.rembg/models}"/isnet-general-use/*.onnx >/dev/null 2>&1; then
  python3 -c 'from rembg import new_session; new_session("isnet-general-use")'
fi

echo "media toolkit ready"
