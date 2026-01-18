#!/bin/bash

# Krolik CLI Postinstall Script
# Copies Claude Code plugin to ~/.krolik/claude-plugin/

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

# Source plugin directory
SOURCE_PLUGIN="$PACKAGE_DIR/claude-plugin"

# Target plugin directory
TARGET_DIR="$HOME/.krolik/claude-plugin"

# Check if source exists
if [[ ! -d "$SOURCE_PLUGIN" ]]; then
  # In npm install, the plugin is in the package root
  if [[ -d "$PACKAGE_DIR/../claude-plugin" ]]; then
    SOURCE_PLUGIN="$PACKAGE_DIR/../claude-plugin"
  else
    echo "ℹ️ Claude Code plugin not found, skipping installation"
    exit 0
  fi
fi

# Create target directory
mkdir -p "$TARGET_DIR"

# Copy plugin files
cp -r "$SOURCE_PLUGIN"/* "$TARGET_DIR/"

# Make scripts executable
chmod +x "$TARGET_DIR/hooks/"*.sh 2>/dev/null || true
chmod +x "$TARGET_DIR/scripts/"*.sh 2>/dev/null || true

echo "✅ Krolik Claude Code plugin installed to: $TARGET_DIR"
echo ""
echo "To use with Claude Code:"
echo "  cc --plugin-dir ~/.krolik/claude-plugin"
echo ""
echo "Or add to ~/.claude/settings.json:"
echo '  "pluginDirs": ["~/.krolik/claude-plugin"]'
