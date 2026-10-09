#!/usr/bin/env python3
"""Проверка синхронности субтитров и озвучки в готовом ролике.

Распознаёт речь в MP4 и сравнивает начало каждого слова со временем слова
в reel.json. Норма: медиана около 0 (−0.1…+0.05 с), максимум до ~0.25 с.

Использование: check_sync.py OUT.mp4 OUTDIR/reel.json
"""
import difflib
import json
import re
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

video, reel = sys.argv[1], sys.argv[2]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     capture_output=True, check=True).stdout
audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
segs, _ = WhisperModel("small", device="cpu", compute_type="int8").transcribe(
    audio, language="ru", word_timestamps=True)
heard = [(w.word.strip(), w.start) for s in segs for w in s.words]
cap = json.load(open(reel, encoding="utf-8"))["words"]


def norm(x):
    return re.sub(r"[^а-яёa-z0-9]", "", x.lower())


sm = difflib.SequenceMatcher(a=[norm(w["text"]) for w in cap], b=[norm(h[0]) for h in heard], autojunk=False)
d = np.array([cap[b.a + k]["start"] - heard[b.b + k][1] for b in sm.get_matching_blocks() for k in range(b.size)])
print(f"совпало слов: {len(d)}/{len(cap)}; субтитр минус звук: медиана {np.median(d):+.2f} c, "
      f"максимум |{np.abs(d).max():.2f}| c")
print("распознано:", " ".join(h[0] for h in heard))
