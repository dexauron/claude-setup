# Настройки Claude Code

Плагины, навыки и MCP-серверы — **общие для всех проектов**.
Прошлых, нынешних и будущих. Ни один проект эти файлы не хранит.

## Как поставить

На любом компьютере, один раз:

```bash
git clone https://github.com/dexauron/claude-setup.git
cd claude-setup
bash install.sh
```

Перезапусти Claude Code. Плагины скачаются сами при первом запуске —
несколько минут, дальше мгновенно.

## Что внутри

| Что | Где лежит | Куда ставится |
|---|---|---|
| Плагины (289 шт.) | `settings.json` | `~/.claude/settings.json` |
| Навыки ui-ux-pro-max (6 шт.) | качаются при установке | `~/.claude/skills/` |
| gstack (57 навыков) | качается при установке | `~/.claude/skills/gstack` |
| MCP-серверы (3 шт.) | `install.sh` | область пользователя |

Навыки не хранятся здесь копией — `install.sh` скачивает их из
первоисточника. Так они всегда свежие, а репозиторий остаётся крошечным.

`~/.claude` — домашняя папка Claude Code. Всё, что там лежит,
работает в любом проекте автоматически.

## Ключи

Три MCP-сервера без ключей не работают. Ключи в репозиторий **не кладём** —
только имена переменных окружения. Добавь их в свой профиль
(`~/.bashrc`, `~/.zshrc` или переменные системы):

```bash
export FIRECRAWL_API_KEY="..."        # firecrawl.dev
export N8N_API_URL="..."              # адрес твоего сервера n8n
export N8N_API_KEY="..."
export YANDEX_CLOUD_TOKEN="..."       # консоль Yandex Cloud
export YANDEX_CLOUD_FOLDER_ID="..."
```

Пока переменной нет — сервер молчит и ничему не мешает.

## Если что-то пошло не так

**Плагин не появился.** Запусти `/plugin` внутри Claude Code — там видно
список и вкладку с ошибками.

**Навыки не подхватились.** Проверь, что папки на месте:
`ls ~/.claude/skills`. Затем перезапусти Claude Code.

**MCP-сервер не подключается.** Скорее всего нет ключа — смотри раздел выше.
Проверить: `claude mcp list`.

**Хочу убрать один плагин.** `claude plugin uninstall ИМЯ --scope user`

**Хочу убрать всё.** Удали `~/.claude/settings.json` и папку `~/.claude/skills`.
Проекты это не затронет.

## Предупреждение

Здесь установлены **все** плагины официального маркетплейса Anthropic —
по прямой просьбе владельца, включая те, что не нужны ни одному текущему
проекту (SAP, Oracle, Salesforce, Unreal Engine и подобные).

Плата за это: каждый плагин грузит описания своих инструментов в контекст
Claude. Чем их больше, тем меньше места остаётся под твой код и тем чаще
Claude промахивается мимо нужного инструмента.

Если станет заметно хуже — удали лишнее:

```bash
claude plugin uninstall sap-hana-cli --scope user
claude plugin uninstall unreal-engine-skills-for-claude-code --scope user
```

Двадцать по-настоящему универсальных, которые стоит оставить в любом случае:

`typescript-lsp` `pyright-lsp` `serena` `code-review` `code-simplifier`
`pr-review-toolkit` `mattpocock-skills` `security-guidance` `claude-security`
`semgrep` `feature-dev` `commit-commands` `claude-md-management` `hookify`
`modern-web-guidance` `chrome-devtools-mcp` `superdesign` `playground`
`duckdb-skills` `remember`

Плюс из «24 штук» с картинок: `frontend-design` `superpowers` `context7`
`playwright` `firecrawl` `supabase` `telegram` `github` `notion` `hyperframes`
`skill-creator` `caveman` `claude-seo` `gstack` `ui-ux-pro-max`.

## Домашний сервер

Настройка личного сервера на Ubuntu: файлы, Docker, доступ с телефона
и компьютера, подключение ИИ — в [server/README.md](server/README.md).

## Скиллы интерфейса и анимаций

Двадцать скиллов из четырёх открытых репозиториев. Все бесплатные,
установщик качает их из первоисточников.

| Откуда | Что даёт |
|---|---|
| `jakubkrehel/skills` | типографика, цвета, доступность, вёрстка, тексты интерфейса |
| `emilkowalski/skills` | анимации, подход Apple к движению, выбор UI-библиотеки |
| `yetone/kill-ai-slop` | убирает характерные следы генерации из вёрстки и текстов |
| `MengTo/Skills` | промптинг интерфейса от дизайна, а не от кода |

Из последнего репозитория берётся только UI-часть: остальные 126 скиллов
там про соцсети и озвучку, к разработке отношения не имеют.
