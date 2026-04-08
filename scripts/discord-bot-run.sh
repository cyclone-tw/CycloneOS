#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
cd "$HOME/CycloneOS"
claude --channels plugin:discord@claude-plugins-official --dangerously-skip-permissions --model sonnet
