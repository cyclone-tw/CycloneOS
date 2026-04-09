#!/bin/bash
# PostToolUse hook: logs Discord reply/react activity to JSONL
# Receives hook payload on stdin with tool_name, tool_input, tool_response

LOG_FILE="${BOT_DIR:-$HOME/discord-bot}/.bot-activity.jsonl"
INPUT=$(cat)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' | sed 's/.*__//')
TS=$(date +"%Y-%m-%dT%H:%M:%S%z")
CHAT_ID=$(echo "$INPUT" | jq -r '.tool_input.chat_id // empty')
TEXT=$(echo "$INPUT" | jq -r '.tool_input.text // empty')
MSG_ID=$(echo "$INPUT" | jq -r '.tool_input.message_id // empty')
EMOJI=$(echo "$INPUT" | jq -r '.tool_input.emoji // empty')

# Guard: skip if essential fields are missing
[ -z "$TOOL" ] || [ -z "$CHAT_ID" ] && exit 0

# reply tool_response format: {content: [{type:"text", text:"sent (id: 123456)"}]}
if [ "$TOOL" = "reply" ]; then
  RESP_TEXT=$(echo "$INPUT" | jq -r '.tool_response.content[0].text // empty')
  RESP_MSG_ID=$(echo "$RESP_TEXT" | grep -oE 'id: ([0-9]+)' | head -1 | cut -d' ' -f2)
  [ -n "$RESP_MSG_ID" ] && MSG_ID="$RESP_MSG_ID"
fi

jq -nc \
  --arg ts "$TS" \
  --arg tool "$TOOL" \
  --arg chat_id "$CHAT_ID" \
  --arg text "$TEXT" \
  --arg message_id "$MSG_ID" \
  --arg emoji "$EMOJI" \
  '{ts:$ts, tool:$tool, chat_id:$chat_id} +
   (if $text != "" then {text:$text} else {} end) +
   (if $message_id != "" then {message_id:$message_id} else {} end) +
   (if $emoji != "" then {emoji:$emoji} else {} end)' >> "$LOG_FILE"
