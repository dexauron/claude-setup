---
name: media-editing
description: Монтаж видео и обработка фото командами — нарезка, склейка, переходы, вертикальный формат 9:16, титры и субтитры на русском, расшифровка речи, громкость, музыка под голос; фото — HEIC с iPhone, кадрирование, цвет, водяной знак, удаление фона, метаданные. Использовать для ЛЮБОЙ просьбы смонтировать, нарезать, склеить, сжать, переформатировать видео, сделать Reels/Shorts/TikTok, вшить субтитры, обработать или пакетно подготовить фотографии.
---

# Монтаж фото и видео

Рилсы-инструкции из записи экрана с озвучкой — навык `reels-tutorial`
(шаблон Remotion в `reels/`). Здесь — общие приёмы.

Монтирую командами, без таймлайна. Видео не смотрю непрерывно — «смотрю»
листами контактов, расшифровкой и списком склеек. Поэтому главное правило:
**каждый результат проверяю глазами (Read по картинке) до отдачи.**

## Окружение

- ffmpeg 6.1: libx264/x265, vp9, av1, aac, opus; фильтры drawtext, subtitles
  (libass), xfade, lut3d, loudnorm, afftdn, vidstab, rubberband, zscale.
- ImageMagick 6 (`convert`, `montage`, `identify`), Pillow + pillow-heif,
  OpenCV, exiftool, mediainfo.
- faster-whisper (модель `small` скачана), PySceneDetect, rembg
  (модели `isnet-general-use`, `u2net` скачаны), yt-dlp.
- Шрифты с кириллицей: Inter, DejaVu, Noto, Liberation. Путь — через
  `fc-match -f '%{file}' 'Inter:bold'`.
- 4 ядра, без GPU, ~30 ГБ диска. Промежуточные файлы — в scratchpad.
- Если чего-то нет — `.claude/hooks/session-start.sh` ставит всё заново.

Скрипты лежат в `scripts/` рядом с этим файлом:

| Скрипт | Зачем |
|---|---|
| `probe.sh FILE…` | длительность, кадр, fps, кодеки, pix_fmt, поворот, звук |
| `contact_sheet.sh VIDEO [COLS ROWS OUT START END]` | кадры с точными таймкодами в одной картинке |
| `transcribe.py MEDIA [--lang ru] [--model small]` | `.srt` + `.words.json` (каждое слово с таймкодом) |
| `loudnorm_filter.py MEDIA [--i -14]` | фильтр точной двухпроходной громкости |
| `title_png.sh "ТЕКСТ" OUT.png [WIDTH SIZE FONT COLOR]` | титр картинкой с переносом строк |

## Порядок работы

1. **Получить исходники.** Файлы в репозитории; Google Drive
   (`download_file_content`); прямая ссылка (`curl -L`); видеоплатформы —
   `yt-dlp` (только свой контент или с правом использования).
2. **Разобраться, что пришло:** `probe.sh` по всем файлам. Заметить разные
   fps, разрешения, поворот, моно/стерео, частоту звука.
3. **«Посмотреть»:** `contact_sheet.sh` (обзор), `transcribe.py` (речь),
   `scenedetect -i X detect-adaptive list-scenes` (склейки внутри файла).
4. **План монтажа.** Таймкоды и порядок — из расшифровки и листов.
   Художественные решения (какой дубль, что вырезать) показываю
   пользователю списком до рендера, если он их не задал сам.
5. **Монтаж:** привести клипы к общим параметрам → резать/склеивать →
   титры, субтитры, музыка → громкость → экспорт.
6. **Проверка:** `probe.sh` (pix_fmt yuv420p, длительность, звук),
   `contact_sheet.sh` по результату, отдельные кадры вокруг склеек и
   титров, громкость через `ebur128`. Нашёл дефект — исправляю, а не отдаю.
7. **Отдать:** `SendUserFile`. Сказать, что проверено и что — нет.

## Видео: проверенные рецепты

Точная нарезка (с перекодированием `-ss` до `-i` точен до кадра):
```bash
ffmpeg -ss 12.5 -t 8 -i in.mp4 -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -b:a 192k cut.mp4
```

Привести клип к общим параметрам — обязательно перед `xfade` и склейкой:
```bash
-vf "scale=1080:1920,fps=30,format=yuv420p,setsar=1" -af "aresample=48000,aformat=channel_layouts=stereo"
```

Горизонтальное → 9:16 с размытым фоном:
```bash
ffmpeg -i in.mp4 -filter_complex "[0:v]split[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.15[b];[fg]scale=1080:-2[f];[b][f]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p,setsar=1[v]" -map "[v]" -map 0:a ...
```
Кроп по центру вместо фона: `crop=ih*9/16:ih,scale=1080:1920`.

Переход (offset = длительность первого клипа − длительность перехода;
брать длительность ВИДЕОпотока, а не контейнера):
```bash
ffmpeg -i A.mp4 -i B.mp4 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=7.5[v];[0:a][1:a]acrossfade=d=0.5[a]" -map "[v]" -map "[a]" ...
```
Другие переходы: `wipeleft`, `slideup`, `circleopen`, `dissolve`, `fadeblack`.

Склейка без перекодирования — только при одинаковых кодеках/параметрах:
```bash
printf "file '%s'\n" "$PWD/a.mp4" "$PWD/b.mp4" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4
```

Титр (появление 0.3 с, исчезновение с 2-й секунды):
```bash
scripts/title_png.sh "Заголовок ролика" title.png 920 72
ffmpeg -i in.mp4 -loop 1 -t 2.5 -i title.png -filter_complex "[1:v]format=rgba,fade=t=in:d=0.3:alpha=1,fade=t=out:st=2:d=0.5:alpha=1[t];[0:v][t]overlay=(W-w)/2:H*0.12:eof_action=pass[v]" -map "[v]" -map 0:a ...
```

Субтитры: вшить (`Fontsize=12` при высоте 1920 ≈ крупные читаемые):
```bash
-vf "subtitles=in.srt:force_style='Fontname=Inter,Bold=1,Fontsize=12,Outline=2,Shadow=0,MarginV=40'"
```
Отдельной дорожкой (включаются в плеере): `-i in.srt -c:s mov_text -metadata:s:s:0 language=rus`.

Громкость, точно в цель (−14 LUFS соцсети, −16 подкаст, −23 эфир):
```bash
ffmpeg -i in.mp4 -af "$(scripts/loudnorm_filter.py in.mp4 --i -14)" -ar 48000 ...
ffmpeg -i out.mp4 -af ebur128=framelog=quiet -f null - 2>&1 | grep ' I:'   # проверка
```

Музыка под голос с автоприглушением (под речью музыка тише на ~10 дБ):
```bash
ffmpeg -i video.mp4 -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=0.5,aformat=channel_layouts=stereo,aresample=48000[m];[0:a]asplit=2[voice][sc];[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];[voice][duck]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out.mp4
```

Скорость ×2: `[0:v]setpts=PTS/2[v];[0:a]atempo=2[a]` (atempo 0.5–2, больше — цепочкой).

Шумоподавление речи: `-af afftdn=nf=-25,highpass=f=80`.

Экспорт для соцсетей (Reels, Shorts, TikTok, Telegram):
```bash
-c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 192k -ar 48000 -movflags +faststart
```
Меньше размер — `-crf 23..26`; черновик быстрее — `-preset veryfast`.

## Фото: проверенные рецепты

HEIC с iPhone — только через pillow-heif (ImageMagick 6 здесь HEIC не читает):
```bash
python3 -c 'import sys,pillow_heif;from PIL import Image,ImageOps;pillow_heif.register_heif_opener();ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB").save(sys.argv[2],quality=92)' in.heic out.jpg
```

Кадр 4:5 (Instagram), автоуровни, насыщенность, резкость, водяной знак:
```bash
convert in.jpg -auto-orient -resize 1080x1350^ -gravity center -extent 1080x1350 \
  -channel RGB -auto-level +channel -modulate 100,110 -unsharp 0x0.75+0.75+0.008 \
  -gravity southeast -font "$(fc-match -f '%{file}' 'Inter:bold')" -pointsize 36 \
  -fill 'rgba(255,255,255,0.8)' -annotate +32+28 '© Подпись' -strip -quality 90 out.jpg
```
Другие форматы: 1:1 `1080x1080`, 9:16 `1080x1920`, 16:9 `1920x1080`.
Пакетно: тот же набор опций через `mogrify -path outdir ... *.jpg`.

Удаление фона (isnet чище на волосах, чем u2net; ~15 с на кадр):
```bash
rembg i -m isnet-general-use in.jpg cutout.png
convert cutout.png -background '#2b5cff' -flatten newbg.jpg     # новый фон
```

Метаданные: смотреть `exiftool -s in.jpg`; убрать всё, включая GPS,
перед публикацией — `exiftool -all= -overwrite_original out.jpg`.

Сравнить варианты бок о бок для проверки:
```bash
montage -label '%f' a.jpg b.jpg c.png -tile 3x1 -geometry 400x500+6+6 -background '#ddd' check.jpg
```

## Подводные камни (все встречены на практике)

- **Без `-pix_fmt yuv420p` H.264 может выйти в yuv444p** — не играет на
  iPhone, в QuickTime и браузерах. Ставить всегда.
- **drawtext не переносит строки** и раскрывает `%` в тексте
  (`expansion=none` отключает). Для титров — `title_png.sh`.
- **ImageMagick: `@файл` запрещён политикой, `%` в тексте — спецсимвол**
  (удваивать). `title_png.sh` это учитывает.
- **Лист контактов через фильтр `fps` врёт с таймкодами** почти на целый
  интервал. `contact_sheet.sh` берёт каждый кадр отдельным поиском.
- **Один проход loudnorm промахивается на ~1 LU** — `loudnorm_filter.py`.
- **faster-whisper + PyAV 19 ломаются** на чтении звука из файла. Хук
  ставит `av<19`; `transcribe.py` на всякий случай декодирует через ffmpeg.
- **Длительность контейнера ≠ видеопотока** (AAC добавляет ~0.03–0.1 с):
  для offset в xfade брать `-select_streams v -show_entries stream=duration`.
- **`xfade` требует одинаковые разрешение, fps, SAR и pix_fmt** у обоих входов.
- Whisper `small` ошибается в редких словах и именах — перед вшиванием
  субтитров вычитать `.srt`. Точнее: `--model medium` (~1.5 ГБ, медленнее).
