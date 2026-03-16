#!/bin/bash
set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SKILLS_DIR="$OPENCLAW_HOME/skills"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_SOURCE="$REPO_ROOT/skills/tuqu-photo-skill"

if [ ! -d "$SKILL_SOURCE" ] || [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
  echo "Skill source not found at $SKILL_SOURCE"
  exit 1
fi

mkdir -p "$SKILLS_DIR"

TARGET="$SKILLS_DIR/tuqu-photo-skill"

if [ -L "$TARGET" ] || [ -d "$TARGET" ]; then
  rm -rf "$TARGET"
fi

mkdir -p "$TARGET"
cp -R "$SKILL_SOURCE"/. "$TARGET"/
echo "Installed tuqu-photo-skill → $TARGET"
