#!/usr/bin/env python3
"""Двухпроходная нормализация громкости: замеряет файл и печатает готовый
фильтр для второго прохода. Один проход loudnorm промахивается на ~1 LU.

Использование: loudnorm_filter.py MEDIA [--i -14] [--tp -1.5] [--lra 11]
  ffmpeg -i in.mp4 -af "$(loudnorm_filter.py in.mp4)" -ar 48000 ...
Цели: -14 LUFS — YouTube/соцсети, -16 — подкасты, -23 — эфир (EBU R128).
"""
import argparse
import json
import re
import subprocess

ap = argparse.ArgumentParser()
ap.add_argument("media")
ap.add_argument("--i", type=float, default=-14)
ap.add_argument("--tp", type=float, default=-1.5)
ap.add_argument("--lra", type=float, default=11)
a = ap.parse_args()

target = f"I={a.i}:TP={a.tp}:LRA={a.lra}"
log = subprocess.run(
    ["ffmpeg", "-hide_banner", "-i", a.media, "-vn", "-af", f"loudnorm={target}:print_format=json", "-f", "null", "-"],
    capture_output=True, text=True, check=True,
).stderr
m = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", log).group(0))
print(
    f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
    f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
    f":offset={m['target_offset']}:linear=true"
)
