"""ElevenLabs: озвучка с таймингом каждого символа и поиск голосов в библиотеке.

Ключ берётся из переменной окружения ELEVENLABS_API_KEY (добавляется в
настройках облачного окружения; в чат его не вставлять).
Документация: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
"""
import base64
import json
import os
import urllib.parse
import urllib.request

import numpy as np

API = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io")  # подмена — только для тестов
SR = 24000  # pcm_24000: 16-бит, моно, без заголовка

# Спокойная уверенная подача: высокая стабильность, без утрирования стиля,
# чуть медленнее обычного
CALM = {"stability": 0.65, "similarity_boost": 0.8, "style": 0.05, "use_speaker_boost": True, "speed": 0.95}


def _key():
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise SystemExit(
            "Нет ELEVENLABS_API_KEY. Добавьте ключ в настройках облачного окружения "
            "(меню окружения в заголовке сессии → Edit) и откройте новую сессию."
        )
    return key


def _request(method, path, query=None, body=None):
    url = API + path + ("?" + urllib.parse.urlencode(query, doseq=True) if query else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "xi-api-key": _key(), "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs {method} {path}: {e.code} {e.read().decode(errors='replace')[:400]}")


def tts(text, voice_id, model="eleven_multilingual_v2", settings=None, previous_text=None, next_text=None):
    """Речь и время начала каждого слова: (float32 массив @24 кГц, [(слово, сек), ...])."""
    body = {"text": text, "model_id": model, "voice_settings": {**CALM, **(settings or {})}}
    if previous_text:
        body["previous_text"] = previous_text
    if next_text:
        body["next_text"] = next_text
    r = _request("POST", f"/v1/text-to-speech/{voice_id}/with-timestamps", {"output_format": "pcm_24000"}, body)
    audio = np.frombuffer(base64.b64decode(r["audio_base64"]), "<i2").astype(np.float32) / 32768
    al = r.get("alignment") or r.get("normalized_alignment")
    return audio, _words_from_chars(al["characters"], al["character_start_times_seconds"])


def _words_from_chars(chars, starts):
    words, cur, t0 = [], "", None
    for ch, t in zip(chars + [" "], starts + [None]):
        if ch.isspace():
            if cur:
                words.append((cur, t0))
            cur, t0 = "", None
        else:
            if not cur:
                t0 = t
            cur += ch
    return words


def shared_voices(language="ru", gender="male", pages=3, **filters):
    """Голоса из общей библиотеки ElevenLabs (нужен ключ: без входа фильтры недоступны)."""
    out = []
    for page in range(pages):
        q = {"language": language, "gender": gender, "page_size": 100, "page": page,
             "sort": "usage_character_count_1y", **filters}
        r = _request("GET", "/v1/shared-voices", q)
        out += r.get("voices", [])
        if not r.get("has_more"):
            break
    return out


def add_shared_voice(public_owner_id, voice_id, name):
    """Добавить голос из библиотеки в «Мои голоса», чтобы озвучивать им через API."""
    return _request("POST", f"/v1/voices/add/{public_owner_id}/{voice_id}", body={"new_name": name})
