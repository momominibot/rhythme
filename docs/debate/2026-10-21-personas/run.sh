#!/bin/sh
# Four Codex persona walks of the Harbour Lane branch, one at a time, read-only; stops on the first failure, as every
# earlier batch did, and never re-runs a walk whose review already exists. Run from a clean checkout of
# claude/wizardly-galileo-0qg6f8 (PR 45, stacked on PR 44):
#   git fetch origin && git worktree add ../rhythme-walk origin/claude/wizardly-galileo-0qg6f8 && cd ../rhythme-walk
#   sh docs/debate/2026-10-21-personas/run.sh
# If your Codex version names these flags differently, run each brief + persona the way the 20 Oct walks were run.
set -e
D=docs/debate/2026-10-21-personas
for p in ttc postpartum peri meno; do
  out="$D/codex-$p.md"
  if [ -s "$out" ]; then echo "skip $p: $out exists"; continue; fi
  echo "walk $p ($(date '+%H:%M:%S'))"
  cat "$D/brief-codex.md" "$D/persona-$p.md" | codex exec --sandbox read-only --output-last-message "$out" -
  [ -s "$out" ] || { echo "STOP at $p: no review written"; exit 1; }
done
echo "done: push the four codex-*.md files to the branch, or paste them into the Claude session"
