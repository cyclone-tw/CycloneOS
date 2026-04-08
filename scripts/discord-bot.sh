#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

# Kill existing session if any
tmux kill-session -t discord-bot 2>/dev/null

# Start new tmux session with Claude Discord bot
tmux new-session -d -s discord-bot -c "$HOME/CycloneOS" \
  "claude --channels plugin:discord@claude-plugins-official --dangerously-skip-permissions --model sonnet"
