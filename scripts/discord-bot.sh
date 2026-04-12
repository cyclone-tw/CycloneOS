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

# ── Start slash handler (while-loop auto-restart) ───────────────────
tmux new-session -d -s slash-handler -c "$HANDLER_DIR" \
  "DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN OBSIDIAN_VAULT=$OBSIDIAN_VAULT BOT_DIR=$BOT_DIR bash $HANDLER_DIR/slash-loop.sh"

# ── Copy bot loop script ─────────────────────────────────────────────
cp "$REPO_DIR/discord-bot/bot-loop.sh" "$BOT_DIR/bot-loop.sh"
chmod +x "$BOT_DIR/bot-loop.sh"

# ── Start bot (while-loop auto-restart) ──────────────────────────────
tmux new-session -d -s discord-bot -c "$BOT_DIR" "$BOT_DIR/bot-loop.sh"

echo "Discord bot started in tmux session 'discord-bot'"
echo "Slash handler started in tmux session 'slash-handler'"
