#!/usr/bin/env python3
"""Сборка данных рилса-инструкции из plan.json.

Озвучивает каждую сцену (ElevenLabs или Piper — см. "tts" в plan.json),
подгоняет кусок записи экрана под длину фразы, раскладывает слова субтитров
по времени и пишет reel.json для Remotion (композиция ScreenTutorial).

Использование: build_reel.py plan.json OUTDIR
Дальше: tools/render.sh OUTDIR out.mp4
"""
import difflib
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import elevenlabs  # noqa: E402

FPS = 30
LEAD = 0.12  # пауза перед фразой в сцене
TAIL = 0.35  # пауза после фразы
PIPER_DIR = Path.home() / ".local/share/piper"
PIPER_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/{v}/medium/ru_RU-{v}-medium.onnx"


def run(cmd):
    subprocess.run(cmd, check=True)


class ElevenVoice:
    """Основной голос: живая речь и время каждого слова прямо из ответа API."""
    sr = elevenlabs.SR

    def __init__(self, cfg):
        self.voice_id = cfg["voiceId"]
        self.model = cfg.get("model", "eleven_multilingual_v2")
        self.settings = cfg.get("settings", {})

    def speak(self, text, prev=None, nxt=None):
        return elevenlabs.tts(text, self.voice_id, self.model, self.settings, prev, nxt)


class PiperVoice:
    """Запасной офлайн-голос для черновиков. Звучит заметно хуже ElevenLabs."""
    sr = 22050

    def __init__(self, cfg):
        self.voice = cfg.get("voice", "denis")
        self.length_scale = cfg.get("lengthScale", 0.95)
        self.model = PIPER_DIR / f"ru_RU-{self.voice}-medium.onnx"
        if not self.model.exists():
            PIPER_DIR.mkdir(parents=True, exist_ok=True)
            for ext in ("", ".json"):
                run(["curl", "-sSL", "-o", f"{self.model}{ext}", PIPER_URL.format(v=self.voice) + ext])

    def speak(self, text, prev=None, nxt=None):
        raw = subprocess.run(
            ["python3", "-m", "piper", "-m", str(self.model), "--length-scale", str(self.length_scale),
             "--output-raw"], input=text.encode(), check=True, capture_output=True).stdout
        return np.frombuffer(raw, np.int16).astype(np.float32) / 32768, None


def make_voice(plan):
    cfg = plan.get("tts") or {"engine": "piper", "voice": plan.get("voice", "denis"),
                              "lengthScale": plan.get("lengthScale", 0.95)}
    return (ElevenVoice if cfg["engine"] == "elevenlabs" else PiperVoice)(cfg)


def trim(audio, heard, sr):
    """Срезать тишину по краям, сдвинув время слов на столько же."""
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    a0 = max(0, loud[0] - int(0.03 * sr))
    audio = audio[a0: loud[-1] + int(0.06 * sr)]
    if heard is not None:
        heard = [(w, max(0.0, t - a0 / sr)) for w, t in heard]
    return audio, heard


def vowels(word):
    n = len(re.findall(r"[аеёиоуыэюяaeiouy]", word.lower()))
    n += 2 * len(re.findall(r"\d", word))  # «43» звучит как «сорок три»
    return max(1, n)


_whisper = None


def heard_words(speech, sr):
    """Слова, которые реально прозвучали, с началом каждого (Whisper по озвучке)."""
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel("small", device="cpu", compute_type="int8")
    idx = np.round(np.arange(0, len(speech), sr / 16000)).astype(int)
    segs, _ = _whisper.transcribe(speech[idx[idx < len(speech)]], language="ru", word_timestamps=True)
    return [(w.word.strip(), w.start) for s in segs for w in s.words]


def norm(w):
    return re.sub(r"[^а-яёa-z0-9]", "", w.lower())


def place_words(text, speech, start, sr, heard=None):
    """Слова субтитров по времени. Совпавшие со звуком слова берут время из
    тайминга ElevenLabs (или распознавания озвучки); остальные («43» при
    сказанном «сорок три») раскладываются между соседями по числу слогов."""
    words = []
    for w in text.split():  # одиночное тире не должно висеть отдельной «строкой»
        if words and not re.search(r"\w", w):
            words[-1] += " " + w
        else:
            words.append(w)
    dur = len(speech) / sr
    heard = heard if heard is not None else heard_words(speech, sr)
    anchors = {0: 0.0}
    sm = difflib.SequenceMatcher(a=[norm(w) for w in words], b=[norm(h[0]) for h in heard], autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            anchors[blk.a + k] = heard[blk.b + k][1]
    anchors[len(words)] = dur
    # между опорными словами — пропорционально слогам; время только растёт
    weights = [vowels(w) for w in words]
    starts = [0.0] * (len(words) + 1)
    keys = sorted(anchors)
    for i0, i1 in zip(keys, keys[1:]):
        t0, t1 = anchors[i0], max(anchors[i1], anchors[i0])
        total = sum(weights[i0:i1]) or 1
        acc = 0
        for i in range(i0, i1):
            starts[i] = t0 + (t1 - t0) * acc / total
            acc += weights[i]
    starts[len(words)] = dur
    lead = 0.05  # субтитр чуть раньше звука воспринимается как синхронный
    return [{"text": w, "start": round(max(0.0, start + a - lead), 3), "end": round(start + b - lead, 3)}
            for w, a, b in zip(words, starts[:-1], starts[1:])]


def cut_clip(src, crop, a, b, dur, height, out):
    """Кусок записи [a, b] → ровно dur секунд (ускорение/замедление), 30 fps."""
    x, y, w, h = crop
    factor = dur / (b - a)
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a}", "-to", f"{b}", "-i", src, "-an",
         "-vf", f"crop={w}:{h}:{x}:{y},setpts=PTS*{factor:.5f},fps={FPS},"
                f"scale=-2:{height}:flags=lanczos,unsharp=5:5:0.6,format=yuv420p",
         "-t", f"{dur:.3f}", "-c:v", "libx264", "-crf", "16", "-preset", "fast", out])


def still(src, crop, at, height, out):
    x, y, w, h = crop
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at}", "-i", src, "-frames:v", "1",
         "-vf", f"crop={w}:{h}:{x}:{y},scale=-2:{height}:flags=lanczos", out])


def main():
    plan_path, outdir = Path(sys.argv[1]), Path(sys.argv[2])
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    outdir.mkdir(parents=True, exist_ok=True)
    src = str((plan_path.parent / plan["source"]).resolve())
    crop = plan["crop"]
    voice = make_voice(plan)
    SR = voice.sr
    clip_h = plan.get("clipHeight", 1080)

    segments = [dict(plan["hook"], kind="hook")] + \
               [dict(s, kind="step") for s in plan["scenes"]] + \
               [dict(plan["cta"], kind="cta")]

    t = 0.0
    scenes, words, track = [], [], []
    say = [seg.get("say", seg["text"]) for seg in segments]
    for i, seg in enumerate(segments):
        # соседние фразы передаются в ElevenLabs, чтобы интонация шла одной речью
        speech, heard = voice.speak(say[i], say[i - 1] if i else None, say[i + 1] if i + 1 < len(say) else None)
        speech, heard = trim(speech, heard, SR)
        sdur = len(speech) / SR
        dur = max(seg.get("minDuration", 1.2), LEAD + sdur + TAIL)
        scene = {"kind": seg["kind"], "start": round(t, 3), "duration": round(dur, 3)}
        for k in ("step", "label", "title", "subtitle", "focus"):
            if k in seg:
                scene[k] = seg[k]
        if seg["kind"] == "step":
            a, b = seg["from"], seg["to"]
            cut_clip(src, crop, a, b, dur, clip_h, str(outdir / f"clip{i:02d}.mp4"))
            scene["clip"] = f"clip{i:02d}.mp4"
            if "click" in seg:  # время клика — в секундах записи, переводим в сцену
                cx, cy, cat = seg["click"]
                scene["click"] = {"x": cx, "y": cy, "at": round((cat - a) * dur / (b - a), 3)}
        else:
            still(src, crop, seg["stillAt"], clip_h, str(outdir / f"still{i:02d}.png"))
            scene["still"] = f"still{i:02d}.png"
        scenes.append(scene)
        words += place_words(seg["text"], speech, t + LEAD, SR, heard)
        track += [np.zeros(int(LEAD * SR), np.float32), speech,
                  np.zeros(int(round((t + dur) * SR)) - int(round(t * SR)) - int(LEAD * SR) - len(speech), np.float32)]
        t += dur

    audio = np.concatenate(track)
    with wave.open(str(outdir / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())

    x, y, cw, ch = crop
    props = {
        "fps": FPS, "width": 1080, "height": 1920, "duration": round(t, 3),
        "accent": plan.get("accent", "#FFC400"), "kicker": plan.get("kicker", ""),
        "clipAspect": round(cw / ch, 4), "voice": "voice.wav",
        "scenes": scenes, "words": words,
    }
    if plan.get("music"):
        run(["cp", str(plan_path.parent / plan["music"]), str(outdir / "music.mp3")])
        props["music"], props["musicVolume"] = "music.mp3", plan.get("musicVolume", 0.12)
    (outdir / "reel.json").write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(scenes)} сцен, {t:.1f} c -> {outdir / 'reel.json'}")


if __name__ == "__main__":
    main()
