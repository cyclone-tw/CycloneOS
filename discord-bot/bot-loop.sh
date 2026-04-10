#!/bin/bash
# Bot while-loop wrapper — runs inside tmux, auto-restarts on exit
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="${BOT_DIR:-$HOME/discord-bot}"

while true; do
  echo "[$(date)] Starting Discord bot..."

  # Write startup state
  CLAUDE_VER=$(claude --version 2>/dev/null | head -1 || echo 'unknown')
  printf '{"startedAt":"%s","version":"%s"}\n' "$(date +%Y-%m-%dT%H:%M:%S%z)" "$CLAUDE_VER" > "$BOT_DIR/.bot-startup.json"

  # Clear activity log for fresh session
  > "$BOT_DIR/.bot-activity.jsonl"

  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet

  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
