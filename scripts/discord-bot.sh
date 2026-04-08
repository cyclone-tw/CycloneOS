#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="$HOME/discord-bot"
REPO_DIR="$HOME/CycloneOS"

# Ensure bot working directory exists with latest CLAUDE.md
mkdir -p "$BOT_DIR"
cp "$REPO_DIR/discord-bot/CLAUDE.md" "$BOT_DIR/CLAUDE.md"

# Kill existing session if any
tmux kill-session -t discord-bot 2>/dev/null

tmux new-session -d -s discord-bot -c "$BOT_DIR" '
while true; do
  echo "[$(date)] Starting Discord bot..."
  claude --channels plugin:discord@claude-plugins-official \
    --dangerously-skip-permissions --model sonnet
  EXIT_CODE=$?
  echo "[$(date)] Bot exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
'

echo "Discord bot started in tmux session '\''discord-bot'\''"
