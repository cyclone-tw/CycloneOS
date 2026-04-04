#!/bin/bash
export PATH="/Users/kangyunsheng/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"
export HOME="/Users/kangyunsheng"

# Kill existing session if any
tmux kill-session -t discord-bot 2>/dev/null

# Start new tmux session with Claude Discord bot
tmux new-session -d -s discord-bot -c /Users/kangyunsheng/CycloneOS \
  "claude --channels plugin:discord@claude-plugins-official --dangerously-skip-permissions --model sonnet"
