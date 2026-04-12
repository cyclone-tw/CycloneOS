#!/bin/bash
# Slash handler while-loop wrapper — auto-restarts on crash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

HANDLER_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="${BOT_DIR:-$HOME/discord-bot}"
LOG_FILE="$BOT_DIR/slash-handler.log"

# Keep log file under 50KB — trim old entries on each restart
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 51200 ]; then
  tail -c 25600 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

while true; do
  echo "[$(date)] Starting slash handler..." | tee -a "$LOG_FILE"
  cd "$HANDLER_DIR" && bun run slash-handler.ts 2>&1 | tee -a "$LOG_FILE"
  EXIT_CODE=${PIPESTATUS[0]}
  echo "[$(date)] Slash handler exited with code $EXIT_CODE, restarting in 3s..." | tee -a "$LOG_FILE"
  sleep 3
done
