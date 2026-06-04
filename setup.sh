#!/usr/bin/env bash
set -e

SKILL_SRC="$(cd "$(dirname "$0")" && pwd)/skill/raptor/SKILL.md"
SKILL_NAME="raptor"

echo ""
echo "  🦖 Raptor Setup"
echo ""

# --- Install CLI ---
echo "Step 1: Install raptor CLI"
echo "  Options:"
echo "    1) Global install (npm install -g raptor-docgen)"
echo "    2) Skip (already installed or will use npx)"
echo ""
read -rp "  Choice [1/2]: " cli_choice

case "$cli_choice" in
  1)
    echo "  Installing raptor-docgen globally..."
    npm install -g raptor-docgen
    echo "  ✅ CLI installed"
    ;;
  *)
    echo "  ⏭  Skipping CLI install"
    ;;
esac

# --- Install skill ---
echo ""
echo "Step 2: Install skill"
echo "  Agents:"
echo "    1) GitHub Copilot CLI  (~/.copilot/skills/raptor/)"
echo "    2) Claude Code         (~/.claude/commands/raptor.md)"
echo "    3) Cursor              (.cursor/rules/raptor.mdc)"
echo "    4) All of the above"
echo "    5) Skip"
echo ""
read -rp "  Choice [1-5]: " agent_choice

install_copilot() {
  local dest="$HOME/.copilot/skills/$SKILL_NAME"
  mkdir -p "$dest"
  cp "$SKILL_SRC" "$dest/SKILL.md"
  echo "  ✅ Copilot: $dest/SKILL.md"
}

install_claude() {
  local dest="$HOME/.claude/commands"
  mkdir -p "$dest"
  cp "$SKILL_SRC" "$dest/$SKILL_NAME.md"
  echo "  ✅ Claude Code: $dest/$SKILL_NAME.md"
}

install_cursor() {
  local dest=".cursor/rules"
  mkdir -p "$dest"
  cp "$SKILL_SRC" "$dest/$SKILL_NAME.mdc"
  echo "  ✅ Cursor: $dest/$SKILL_NAME.mdc"
}

case "$agent_choice" in
  1) install_copilot ;;
  2) install_claude ;;
  3) install_cursor ;;
  4) install_copilot; install_claude; install_cursor ;;
  *) echo "  ⏭  Skipping skill install" ;;
esac

echo ""
echo "  ✅ Raptor setup complete!"
echo ""
echo "  Usage: ask your AI assistant to 'generate documentation' or 'run raptor'"
echo "  Docs:  https://github.com/Kobe-eng-it/raptor"
echo ""
