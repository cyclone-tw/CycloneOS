#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:/opt/homebrew/bin:$PATH"

BOT_DIR="$HOME/discord-bot"
REPO_DIR="$HOME/CycloneOS"
HANDLER_DIR="$REPO_DIR/discord-bot"

# ── Environment ──────────────────────────────────────────────────────
export DISCORD_BOT_TOKEN=$(grep DISCORD_BOT_TOKEN "$HOME/.claude/channels/discord/.env" | cut -d= -f2-)
export OBSIDIAN_VAULT=$(find "$HOME/Library/CloudStorage" -maxdepth 3 -name "Obsidian-Cyclone" -type d 2>/dev/null | head -1)
export BOT_DIR

# ── Prepare bot working directory ────────────────────────────────────
mkdir -p "$BOT_DIR/.claude" "$BOT_DIR/hooks"
cp "$REPO_DIR/discord-bot/CLAUDE.md" "$BOT_DIR/CLAUDE.md"
cp "$REPO_DIR/discord-bot/settings.json" "$BOT_DIR/.claude/settings.json"
cp "$REPO_DIR/discord-bot/hooks/log-activity.sh" "$BOT_DIR/hooks/"
chmod +x "$BOT_DIR/hooks/log-activity.sh"

# Init git repo if needed (Claude Code needs git for project settings)
if [ ! -d "$BOT_DIR/.git" ]; then
  git -C "$BOT_DIR" init -q
fi

# ── Install slash handler dependencies ───────────────────────────────
cd "$HANDLER_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install
cd "$REPO_DIR"

# ── Kill old sessions ────────────────────────────────────────────────
tmux kill-session -t discord-bot 2>/dev/null
tmux kill-session -t slash-handler 2>/dev/null

# ── Start slash handler ──────────────────────────────────────────────
tmux new-session -d -s slash-handler -c "$HANDLER_DIR" \
  "DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN OBSIDIAN_VAULT=$OBSIDIAN_VAULT BOT_DIR=$BOT_DIR bun run slash-handler.ts; echo 'Slash handler exited, press Enter to restart'; read"

# ── Start bot (while-loop auto-restart) ──────────────────────────────
tmux new-session -d -s discord-bot -c "$BOT_DIR" "
while true; do
  echo \"[\$(date)] Starting Discord bot...\"
  # Write startup state
  CLAUDE_VER=\$(claude --version 2>/dev/null | head -1 || echo 'unknown')
  printf '{\"startedAt\":\"%s\",\"version\":\"%s\"}\n' \"\$(date +%Y-%m-%dT%H:%M:%S%z)\" \"\$CLAUDE_VER\" > \"$BOT_DIR/.bot-startup.json\"
  # Clear activity log for fresh session
  > \"$BOT_DIR/.bot-activity.jsonl\"
  claude --channels plugin:discord@claude-plugins-official \\
    --dangerously-skip-permissions --model sonnet
  EXIT_CODE=\$?
  echo \"[\$(date)] Bot exited with code \$EXIT_CODE, restarting in 2s...\"
  sleep 2
done
"

echo "Discord bot started in tmux session 'discord-bot'"
echo "Slash handler started in tmux session 'slash-handler'"
