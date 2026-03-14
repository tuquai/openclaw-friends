#!/bin/bash
set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SKILLS_DIR="$OPENCLAW_HOME/skills"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_SOURCE="$REPO_ROOT/skills/tuqu-photo-skill"

if [ ! -d "$SKILL_SOURCE" ] || [ ! -f "$SKILL_SOURCE/SKILL.md" ]; then
  echo "Skill source not found. Run: git submodule update --init"
  exit 1
fi

mkdir -p "$SKILLS_DIR"

TARGET="$SKILLS_DIR/tuqu-photo-api"

if [ -L "$TARGET" ]; then
  CURRENT="$(readlink -f "$TARGET")"
  if [ "$CURRENT" = "$(readlink -f "$SKILL_SOURCE")" ]; then
    echo "tuqu-photo-api already linked → $TARGET"
    exit 0
  fi
  rm "$TARGET"
fi

if [ -d "$TARGET" ]; then
  echo "Warning: $TARGET exists as a directory. Replacing with symlink."
  rm -rf "$TARGET"
fi

ln -s "$SKILL_SOURCE" "$TARGET"
echo "Installed tuqu-photo-api → $TARGET"
