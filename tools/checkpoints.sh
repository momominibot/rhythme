#!/bin/bash
# Asks jev whether a change summary meets Jamie's checkpoints (docs/JAMIE-CHECKPOINTS.md). Usage: tools/checkpoints.sh "what changed, how it was verified"
# Prints one line per pointer with jev's probability that the pointer is honoured by the described change (or untouched by it).
cd "$(dirname "$0")/.." || exit 1
SUMMARY="$1"; [ -z "$SUMMARY" ] && { echo "usage: tools/checkpoints.sh \"change summary\""; exit 2; }
command -v jev >/dev/null || { echo "jev not on PATH"; exit 3; }
grep -E '^[0-9]+\. ' docs/JAMIE-CHECKPOINTS.md | while IFS= read -r line; do
  n="${line%%.*}"; text="${line#*. }"
  q="Given this change summary, is Jamie's checkpoint honoured or left untouched (not made worse)? Checkpoint: $text"
  ans=$(perl -e 'alarm 30; exec @ARGV' jev "$q" --state "$SUMMARY" 2>/dev/null | head -1)
  echo "$n: ${ans:-no answer}  [$text]"
done
