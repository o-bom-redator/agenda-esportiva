#!/bin/zsh
# Deixa o bot de gols (bot.js) ligado no Mac: liga sozinho ao entrar e volta se cair.
# Uso: ./bot.sh          liga / atualiza
#      ./bot.sh remover  desliga
set -e
LABEL="net.futnatv.bot-gols"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [[ "$1" == "remover" ]]; then
  rm -f "$PLIST"
  echo "Bot desligado."
  exit 0
fi

if ! grep -q '^TELEGRAM_TOKEN=.' "$DIR/.env" 2>/dev/null; then
  echo "Falta o TELEGRAM_TOKEN no arquivo .env (veja o README, seção \"Bot de gols\")."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/bot.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/bot.log</string>
  <key>StandardErrorPath</key><string>$DIR/bot.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Bot ligado! Histórico em: $DIR/bot.log"
