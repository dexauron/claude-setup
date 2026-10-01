#!/usr/bin/env bash
#
# Базовая настройка домашнего сервера на Ubuntu.
#
#   1. Обновляет систему и включает автообновления безопасности
#   2. Docker — для своих программ и сайтов
#   3. Общая папка /srv/files — файлы с телефона и компьютера
#   4. Файрвол — снаружи закрыто всё, кроме домашней сети и Tailscale
#   5. Claude Code и служба, через которую ИИ подключается к серверу
#   6. Tailscale — доступ к серверу с телефона и компьютера откуда угодно
#
# Запуск — от своего пользователя, без sudo:
#   bash server/setup.sh
#
# Повторный запуск безопасен: сделанное пропускается.
#
set -euo pipefail

ME="$(id -un)"
SUDOERS_FILE=/etc/sudoers.d/90-claude-nopasswd

step() { printf '\n==> %s\n' "$*"; }
warn() { printf '!!  %s\n' "$*"; }

apt_get() {
  sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1 apt-get -y \
    -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold "$@"
}

if [ "$(id -u)" -eq 0 ]; then
  warn "Запусти от своего пользователя, без sudo: bash server/setup.sh"
  exit 1
fi
# shellcheck source=/dev/null
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  warn "Скрипт рассчитан на Ubuntu, а здесь ${PRETTY_NAME:-неизвестная система}"
  exit 1
fi
# Без терминала (скрипт запустил ИИ) вопросы не задаём, а подсказываем,
# что сделать руками
INTERACTIVE=0
[ -t 0 ] && INTERACTIVE=1
if ! sudo true; then
  warn "Нужны права sudo. Без терминала — только если sudo разрешён без пароля."
  exit 1
fi

# ── 1. Система ──────────────────────────────────────────────────────
step "Обновляю систему (может занять несколько минут)"
apt_get update
apt_get upgrade
apt_get install openssh-server curl git tmux ufw unattended-upgrades \
  ca-certificates htop nodejs npm samba docker.io
apt_get install docker-compose-v2 || warn "docker compose не поставился — Docker работает и без него"

step "Включаю автообновления безопасности"
sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── 2. Docker ───────────────────────────────────────────────────────
step "Docker"
sudo systemctl enable --now docker
RELOGIN=0
if ! id -nG "$ME" | grep -qw docker; then
  sudo usermod -aG docker "$ME"
  RELOGIN=1
fi

# ── 3. Общая папка ──────────────────────────────────────────────────
step "Общая папка /srv/files"
sudo mkdir -p /srv/files
sudo chown "$ME:$ME" /srv/files
if ! grep -q '^\[files\]' /etc/samba/smb.conf; then
  sudo tee -a /etc/samba/smb.conf >/dev/null <<EOF

[files]
   comment = Files
   path = /srv/files
   valid users = $ME
   read only = no
   browseable = yes
   create mask = 0644
   directory mask = 0755
EOF
fi
if ! sudo pdbedit -L 2>/dev/null | cut -d: -f1 | grep -qx "$ME"; then
  if [ "$INTERACTIVE" -eq 1 ]; then
    echo "    Придумай пароль для доступа к папке с телефона и компьютера"
    echo "    (можно такой же, как вход на сервер):"
    sudo smbpasswd -a "$ME" || warn "Пароль не задан — повтори: sudo smbpasswd -a $ME"
  else
    warn "Пароль к папке не задан — задай сам: sudo smbpasswd -a $ME"
  fi
fi
sudo systemctl restart smbd

# ── 4. Файрвол ──────────────────────────────────────────────────────
# Из домашней сети открыты только SSH (22) и общая папка (445).
# Через Tailscale доступно всё. Из интернета — ничего.
step "Файрвол"
LAN_DEV="$(ip -4 route show default | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')"
LAN_NET=""
if [ -n "$LAN_DEV" ]; then
  LAN_NET="$(ip -4 route show dev "$LAN_DEV" proto kernel scope link | awk '{print $1; exit}')"
fi
sudo ufw default deny incoming
sudo ufw default allow outgoing
if [ -n "$LAN_NET" ]; then
  echo "    Домашняя сеть: $LAN_NET"
  sudo ufw allow from "$LAN_NET" to any port 22 proto tcp comment 'SSH from LAN'
  sudo ufw allow from "$LAN_NET" to any port 445 proto tcp comment 'Files from LAN'
else
  # Сеть не определилась — SSH не закрываем, чтобы не потерять доступ
  warn "Не определил домашнюю сеть — SSH оставляю открытым для всех"
  sudo ufw allow 22/tcp comment 'SSH'
fi
sudo ufw allow in on tailscale0 comment 'Everything via Tailscale'
sudo ufw --force enable

# ── 5. Claude Code ──────────────────────────────────────────────────
step "Claude Code"
if ! command -v claude >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/claude" ]; then
  curl -fsSL https://claude.ai/install.sh | bash \
    || warn "Claude Code не поставился — повтори: curl -fsSL https://claude.ai/install.sh | bash"
fi
CLAUDE_BIN="$(command -v claude 2>/dev/null || echo "$HOME/.local/bin/claude")"

# Служба держит `claude remote-control` запущенным в отдельном tmux,
# чтобы сервер всегда был виден в приложении Claude Code.
# Свой сокет tmux (-L), чтобы не путаться с ручными сессиями tmux.
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/claude-remote.service" <<EOF
[Unit]
Description=Claude Code Remote Control (tmux -L claude-rc)
After=network-online.target

[Service]
Type=forking
ExecStart=/usr/bin/tmux -L claude-rc new-session -d -s main -c %h $CLAUDE_BIN remote-control
ExecStop=/usr/bin/tmux -L claude-rc kill-server
Restart=always
RestartSec=15

[Install]
WantedBy=default.target
EOF
# Пользовательские службы работают и без входа в систему
sudo loginctl enable-linger "$ME"
systemctl --user daemon-reload 2>/dev/null || true

if [ "$INTERACTIVE" -eq 1 ] && [ ! -f "$SUDOERS_FILE" ]; then
  echo
  echo "    ИИ сможет настраивать систему, только если ему разрешено"
  echo "    выполнять команды администратора без пароля."
  echo "    Минус: кто войдёт в твой аккаунт Claude, получит полный доступ к серверу."
  read -r -p "    Разрешить? [y/N] " ans </dev/tty || ans=""
  if [[ "$ans" =~ ^[YyДд] ]]; then
    echo "$ME ALL=(ALL) NOPASSWD:ALL" | sudo tee "$SUDOERS_FILE" >/dev/null
    sudo chmod 440 "$SUDOERS_FILE"
    if sudo visudo -cf "$SUDOERS_FILE" >/dev/null; then
      echo "    Разрешено. Отменить: sudo rm $SUDOERS_FILE"
    else
      sudo rm -f "$SUDOERS_FILE"
      warn "Не получилось — права не изменены"
    fi
  else
    echo "    Не разрешено. Команды с sudo ИИ будет просить выполнить тебя."
  fi
fi

# ── 6. Tailscale ────────────────────────────────────────────────────
# Последним, потому что ждёт входа в аккаунт по ссылке.
step "Tailscale"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh \
    || warn "Tailscale не поставился — доступ пока только из домашней сети"
fi
if command -v tailscale >/dev/null 2>&1 && ! tailscale status >/dev/null 2>&1; then
  if [ "$INTERACTIVE" -eq 1 ]; then
    echo "    Сейчас появится ссылка — открой её и войди (через Google, Apple или GitHub)."
    sudo tailscale up || warn "Tailscale не подключился — повтори позже: sudo tailscale up"
  else
    warn "Tailscale ждёт входа: sudo tailscale up — и открыть ссылку"
  fi
fi

# ── Итог ────────────────────────────────────────────────────────────
LAN_IP=""
if [ -n "$LAN_DEV" ]; then
  LAN_IP="$(ip -4 -o addr show dev "$LAN_DEV" | awk '{split($4,a,"/"); print a[1]; exit}')"
fi
TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"

cat <<EOF

────────────────────────────────────────────────────────────
Готово.

Адрес сервера:
  дома:           ${LAN_IP:-не определился}
  откуда угодно:  ${TS_IP:-нет — Tailscale не подключён}  (нужен Tailscale на устройстве)

Подключение:    ssh $ME@${TS_IP:-${LAN_IP:-АДРЕС}}
Папка файлов:   \\\\${TS_IP:-${LAN_IP:-АДРЕС}}\\files     (Windows)
                smb://${TS_IP:-${LAN_IP:-АДРЕС}}/files    (Mac, iPhone)

Осталось подключить ИИ (один раз):
  1. $CLAUDE_BIN   — войди в аккаунт, затем /exit
  2. systemctl --user enable --now claude-remote
  Сервер появится в приложении Claude Code.
EOF
if [ "$RELOGIN" -eq 1 ]; then
  echo
  echo "Перезайди по SSH, чтобы команда docker работала без sudo."
fi
if [ -f /var/run/reboot-required ]; then
  echo
  echo "Обновлению ядра нужна перезагрузка: sudo reboot"
fi
