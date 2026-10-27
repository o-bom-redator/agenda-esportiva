#!/bin/zsh
# Agenda a geração das imagens pra todo dia às 8h (launchd do macOS).
# Uso: ./agendar.sh          instala/atualiza o agendamento
#      ./agendar.sh remover  desliga o agendamento
set -e
LABEL="net.futnatv.agenda-jogos"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [[ "$1" == "remover" ]]; then
  rm -f "$PLIST"
  echo "Agendamento removido."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/gerar.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$DIR/agenda.log</string>
  <key>StandardErrorPath</key><string>$DIR/agenda.log</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Agendado! Todo dia às 8h. Histórico em: $DIR/agenda.log"
echo "Pra testar agora: launchctl kickstart gui/$(id -u)/$LABEL"
