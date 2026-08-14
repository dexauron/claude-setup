#!/usr/bin/env bash
#
# Установка общих настроек Claude Code.
#
# Ставит плагины, навыки и MCP-серверы в домашнюю папку (~/.claude),
# то есть для ВСЕХ проектов сразу — прошлых, нынешних и будущих.
# Ни один проект при этом не трогается.
#
# Запуск:
#   bash install.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

echo "==> Устанавливаю общие настройки Claude Code в $CLAUDE_DIR"
mkdir -p "$CLAUDE_DIR/skills"

# ── 1. Плагины и маркетплейсы ───────────────────────────────────────
# settings.json может уже существовать со своими настройками,
# поэтому не перезаписываем файл целиком, а вливаем наши ключи.
if [ -f "$CLAUDE_DIR/settings.json" ]; then
  echo "==> Дописываю плагины в существующий settings.json"
  node -e '
    const fs = require("fs");
    const target = process.argv[1], source = process.argv[2];
    const cur = JSON.parse(fs.readFileSync(target, "utf8"));
    const add = JSON.parse(fs.readFileSync(source, "utf8"));
    cur.extraKnownMarketplaces = { ...(cur.extraKnownMarketplaces || {}), ...add.extraKnownMarketplaces };
    cur.enabledPlugins        = { ...(cur.enabledPlugins || {}),        ...add.enabledPlugins };
    fs.writeFileSync(target, JSON.stringify(cur, null, 2) + "\n");
  ' "$CLAUDE_DIR/settings.json" "$HERE/settings.json"
else
  echo "==> Создаю settings.json"
  cp "$HERE/settings.json" "$CLAUDE_DIR/settings.json"
fi

# ── 2. Навыки ui-ux-pro-max ─────────────────────────────────────────
# 6 навыков: design, design-system, ui-styling, brand, banner-design, slides.
# Качаем с оригинального репозитория — так надёжнее, чем хранить копию.
if [ -d "$CLAUDE_DIR/skills/design" ] && [ -d "$CLAUDE_DIR/skills/ui-styling" ]; then
  echo "==> Навыки ui-ux-pro-max уже стоят — пропускаю"
else
  echo "==> Скачиваю навыки ui-ux-pro-max"
  TMP_UI="$(mktemp -d)"
  git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git "$TMP_UI/uiux"
  for s in "$TMP_UI"/uiux/cli/assets/skills/*/; do
    name="$(basename "$s")"
    rm -rf "$CLAUDE_DIR/skills/$name"
    cp -r "$s" "$CLAUDE_DIR/skills/$name"
    echo "    $name"
  done
  rm -rf "$TMP_UI"
fi

# ── 3. gstack ───────────────────────────────────────────────────────
# 57 навыков, ~23 МБ. В репозитории не храним — качаем при установке.
if [ -d "$CLAUDE_DIR/skills/gstack" ]; then
  echo "==> gstack уже стоит — пропускаю"
else
  echo "==> Скачиваю gstack (57 навыков)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth 1 https://github.com/garrytan/gstack.git "$TMP/gstack"
  # собственные тесты gstack весят ~34 МБ и для работы не нужны
  rm -rf "$TMP/gstack/.git" "$TMP/gstack/test" "$TMP/gstack/browse/test" \
         "$TMP/gstack/benchmark" "$TMP/gstack/benchmark-models"
  cp -r "$TMP/gstack" "$CLAUDE_DIR/skills/gstack"
  echo "    готово: $(find "$CLAUDE_DIR/skills/gstack" -name SKILL.md | wc -l | tr -d ' ') навыков"
fi

# ── 4. Скиллы интерфейса, анимаций и чистки кода ────────────────────
# 20 скиллов из четырёх открытых репозиториев. Все бесплатные:
#   jakubkrehel/skills   типографика, цвета, доступность, вёрстка, тексты
#   emilkowalski/skills  анимации и подход Apple к движению интерфейса
#   yetone/kill-ai-slop  убирает характерные следы генерации из вёрстки
#   MengTo/Skills        промптинг интерфейса от дизайна, а не от кода
if [ -d "$CLAUDE_DIR/skills/better-ui" ]; then
  echo "==> Скиллы интерфейса уже стоят — пропускаю"
else
  echo "==> Скачиваю скиллы интерфейса и анимаций"
  TMP_S="$(mktemp -d)"

  if git clone --depth 1 -q https://github.com/jakubkrehel/skills.git "$TMP_S/jk"; then
    for s in "$TMP_S"/jk/skills/*/; do
      name="$(basename "$s")"
      rm -rf "$CLAUDE_DIR/skills/$name"; cp -r "$s" "$CLAUDE_DIR/skills/$name"
    done
    echo "    типографика, цвета, доступность, вёрстка, тексты"
  fi

  if git clone --depth 1 -q https://github.com/emilkowalski/skills.git "$TMP_S/ek"; then
    for s in "$TMP_S"/ek/skills/*/; do
      name="$(basename "$s")"
      rm -rf "$CLAUDE_DIR/skills/$name"; cp -r "$s" "$CLAUDE_DIR/skills/$name"
    done
    echo "    анимации и подход Apple"
  fi

  # У этого репозитория папка называется skill — даём осмысленное имя
  if git clone --depth 1 -q https://github.com/yetone/kill-ai-slop.git "$TMP_S/ks"; then
    rm -rf "$CLAUDE_DIR/skills/kill-ai-slop"
    cp -r "$TMP_S/ks/skill" "$CLAUDE_DIR/skills/kill-ai-slop"
    echo "    kill-ai-slop"
  fi

  # Все 127 скиллов: веб-дизайн, разработка игр, кодекс, медиа, интерфейс
  if git clone --depth 1 -q https://github.com/MengTo/Skills.git "$TMP_S/mt"; then
    cnt=0
    for s in $(find "$TMP_S/mt/agent-skills" -name SKILL.md | sed 's|/SKILL.md||'); do
      name="$(basename "$s")"
      rm -rf "$CLAUDE_DIR/skills/$name"; cp -r "$s" "$CLAUDE_DIR/skills/$name"
      cnt=$((cnt+1))
    done
    echo "    MengTo: $cnt скиллов"
  fi

  # Remotion — создание видео из кода
  if git clone --depth 1 -q https://github.com/remotion-dev/skills.git "$TMP_S/rm"; then
    for s in "$TMP_S"/rm/skills/*/; do
      name="$(basename "$s")"
      rm -rf "$CLAUDE_DIR/skills/$name"; cp -r "$s" "$CLAUDE_DIR/skills/$name"
    done
    echo "    Remotion: видео из кода"
  fi

  # Obsidian — заметки, диаграммы Mermaid и Excalidraw, семантический поиск
  if git clone --depth 1 -q https://github.com/breferrari/obsidian-mind.git "$TMP_S/om"; then
    for s in "$TMP_S"/om/.claude/skills/*/; do
      name="$(basename "$s")"
      rm -rf "$CLAUDE_DIR/skills/$name"; cp -r "$s" "$CLAUDE_DIR/skills/$name"
    done
    echo "    Obsidian: заметки и диаграммы"
  fi

  rm -rf "$TMP_S"
fi

# ── 5. MCP-серверы ──────────────────────────────────────────────────
# Ставятся в область пользователя. Ключи берутся из переменных
# окружения — в репозитории их нет и быть не должно.
if command -v claude >/dev/null 2>&1; then
  echo "==> Подключаю MCP-серверы"
  claude mcp add firecrawl --scope user \
    -e FIRECRAWL_API_KEY='${FIRECRAWL_API_KEY}' \
    -- npx -y firecrawl-mcp 2>/dev/null || echo "    firecrawl уже подключён"
  claude mcp add n8n --scope user \
    -e N8N_API_URL='${N8N_API_URL}' -e N8N_API_KEY='${N8N_API_KEY}' \
    -- npx -y n8n-mcp 2>/dev/null || echo "    n8n уже подключён"
  claude mcp add yandex-cloud --scope user \
    -e YANDEX_CLOUD_TOKEN='${YANDEX_CLOUD_TOKEN}' \
    -e YANDEX_CLOUD_FOLDER_ID='${YANDEX_CLOUD_FOLDER_ID}' \
    -- npx -y @theyahia/yandex-cloud-mcp 2>/dev/null || echo "    yandex-cloud уже подключён"
else
  echo "!! Команда claude не найдена — MCP-серверы пропущены."
  echo "   Подключи их позже командами из README.md"
fi

echo
echo "Готово. Перезапусти Claude Code."
echo "Плагины скачаются сами при первом запуске — это займёт несколько минут."
