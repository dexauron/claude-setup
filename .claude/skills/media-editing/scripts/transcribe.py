#!/usr/bin/env python3
"""Расшифровка речи с таймкодами (faster-whisper, CPU).

Пишет рядом с файлом .srt (субтитры) и .words.json (каждое слово с началом
и концом) — по ним режут видео «по тексту» и ставят субтитры.

Использование: transcribe.py MEDIA [--model small] [--lang ru] [--max-chars 42]
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel


def load_audio(path):
    """Звук через ffmpeg, а не PyAV: свежие PyAV ломают декодер faster-whisper."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def ts(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)):03}"


def chunks(words, max_chars):
    """Режет поток слов на короткие строки субтитров по длине и паузам."""
    line = []
    for w in words:
        text = " ".join(x["word"] for x in line + [w])
        gap = line and w["start"] - line[-1]["end"] > 0.7
        if line and (len(text) > max_chars or gap):
            yield line
            line = []
        line.append(w)
    if line:
        yield line


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", default=None, help="ru, en, ... (по умолчанию определит сам)")
    ap.add_argument("--max-chars", type=int, default=42)
    a = ap.parse_args()

    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        load_audio(a.media), language=a.lang, vad_filter=True, word_timestamps=True
    )
    words = [
        {"word": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2)}
        for seg in segments
        for w in seg.words
    ]

    base = Path(a.media).with_suffix("")
    srt = []
    for i, line in enumerate(chunks(words, a.max_chars), 1):
        text = " ".join(w["word"] for w in line)
        srt.append(f"{i}\n{ts(line[0]['start'])} --> {ts(line[-1]['end'])}\n{text}\n")
        print(f"[{line[0]['start']:7.2f} – {line[-1]['end']:7.2f}] {text}")
    Path(f"{base}.srt").write_text("\n".join(srt), encoding="utf-8")
    Path(f"{base}.words.json").write_text(
        json.dumps({"language": info.language, "words": words}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"\nязык: {info.language}  слов: {len(words)}  -> {base}.srt, {base}.words.json")


if __name__ == "__main__":
    main()
