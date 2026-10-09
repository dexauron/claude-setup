#!/usr/bin/env python3
"""Подбор голоса ElevenLabs: русские мужские голоса из библиотеки,
отсортированные по низкому и ровному (спокойному) тону.

Скачивает превью (бесплатно, кредиты не тратит), измеряет высоту голоса
(медиана частоты основного тона) и её разброс, пишет таблицу и файлы
NN_имя_F0.mp3 — их можно послушать и выбрать.

Использование:
  voice_picker.py search OUTDIR [--top 8]
  voice_picker.py add PUBLIC_OWNER_ID VOICE_ID "Имя"   # голос → «Мои голоса»
"""
import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import elevenlabs  # noqa: E402

WANT = ("calm", "deep", "confident", "authoritative", "professional", "low", "mature", "warm", "serious")


def pitch_stats(path):
    """Медиана F0 (Гц) и разброс тона (полутона, IQR) — по автокорреляции, 16 кГц."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    win, hop = 640, 160  # 40 мс окно, 10 мс шаг
    lo, hi = 16000 // 300, 16000 // 60  # голос 60–300 Гц
    rms_all = np.sqrt(np.mean(a ** 2)) + 1e-9
    f0 = []
    for i in range(0, len(a) - win, hop):
        x = a[i:i + win] - a[i:i + win].mean()
        if np.sqrt(np.mean(x ** 2)) < 0.5 * rms_all:
            continue
        ac = np.correlate(x, x, "full")[win - 1:]
        ac /= ac[0] + 1e-9
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.5:
            f0.append(16000 / lag)
    if len(f0) < 20:
        return None, None
    st = 12 * np.log2(np.array(f0) / np.median(f0))
    return float(np.median(f0)), float(np.subtract(*np.percentile(st, [75, 25])))


def search(outdir, top):
    outdir.mkdir(parents=True, exist_ok=True)
    voices = elevenlabs.shared_voices(language="ru", gender="male")
    rows = []
    for v in voices:
        url = v.get("preview_url")
        for lang in v.get("verified_languages") or []:
            if lang.get("language") == "ru" and lang.get("preview_url"):
                url = lang["preview_url"]  # превью именно на русском
        if not url:
            continue
        f = outdir / f"{v['voice_id']}.mp3"
        if not f.exists():
            urllib.request.urlretrieve(url, f)
        f0, spread = pitch_stats(f)
        if f0 is None:
            continue
        tags = " ".join(str(v.get(k) or "") for k in ("descriptive", "use_case", "description")).lower()
        bonus = sum(w in tags for w in WANT)
        # ниже голос и ровнее тон — выше в списке; совпадение описания — небольшой плюс
        score = f0 / 10 + spread * 3 - bonus * 2
        rows.append({**{k: v.get(k) for k in ("name", "voice_id", "public_owner_id", "age", "descriptive",
                                             "use_case", "description", "usage_character_count_1y",
                                             "free_users_allowed")},
                     "f0_hz": round(f0), "tone_spread_st": round(spread, 1), "score": round(score, 1),
                     "file": f.name})
    rows.sort(key=lambda r: r["score"])
    (outdir / "voices.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    for i, r in enumerate(rows[:top], 1):
        nice = outdir / f"{i:02d}_{r['name'][:24].replace('/', '_').replace(' ', '_')}_{r['f0_hz']}Hz.mp3"
        nice.write_bytes((outdir / r["file"]).read_bytes())
        print(f"{i:2}. {r['name'][:28]:28} F0 {r['f0_hz']:>3} Гц, разброс {r['tone_spread_st']:>4} пт | "
              f"{r['descriptive']}, {r['use_case']} | {r['voice_id']} {r['public_owner_id']}")
    print(f"\nвсего голосов: {len(rows)}; файлы и voices.json в {outdir}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("outdir", type=Path)
    s.add_argument("--top", type=int, default=8)
    a = sub.add_parser("add")
    a.add_argument("public_owner_id")
    a.add_argument("voice_id")
    a.add_argument("name")
    args = ap.parse_args()
    if args.cmd == "search":
        search(args.outdir, args.top)
    else:
        print(elevenlabs.add_shared_voice(args.public_owner_id, args.voice_id, args.name))


if __name__ == "__main__":
    main()
