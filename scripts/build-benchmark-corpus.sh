#!/usr/bin/env bash
# Build the benchmark ground-truth corpus described in BENCHMARK.md.
#
# Every benchmark in that document measures an external system against
# Refract's event stream — which means the stream itself is the artifact this
# repo has to publish. This script produces it: one JSONL per benchmark page
# over a FIXED window, plus a manifest with sha256 hashes, the refract
# version, and the exact bounds, so a reviewer can re-run the same commands
# and diff byte-for-byte.
#
# The window is fixed rather than trailing (unlike the daily observation job)
# because reproducibility is the whole point: a trailing window changes every
# day. Full-history analysis is not used because the largest pages exceed any
# fixed heap (see observe.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

WINDOW_START="2026-05-29T00:00:00Z"
WINDOW_END_NOTE="pinned by lastRevisionId per page in the manifest"
OUT="benchmark/ground-truth"
export NODE_OPTIONS="--max-old-space-size=6144"

PAGES=(
  "COVID-19"
  "Bitcoin"
  "GPT-4"
  "Climate change"
  "Donald Trump"
  "CRISPR"
  "COVID-19 pandemic"
  "Russia"
  "Tesla, Inc."
  "Earth"
)

mkdir -p "$OUT"
MANIFEST="$OUT/manifest.json"
VERSION=$(node -p "require('./package.json').version")

echo '{' > "$MANIFEST.tmp"
echo "  \"refractVersion\": \"$VERSION\"," >> "$MANIFEST.tmp"
echo "  \"windowStart\": \"$WINDOW_START\"," >> "$MANIFEST.tmp"
echo "  \"windowEnd\": \"$WINDOW_END_NOTE\"," >> "$MANIFEST.tmp"
echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$MANIFEST.tmp"
echo "  \"depth\": \"detailed\"," >> "$MANIFEST.tmp"
echo '  "pages": [' >> "$MANIFEST.tmp"

first=1
for PAGE in "${PAGES[@]}"; do
  SLUG="${PAGE// /_}"; SLUG="${SLUG//,/}"
  FILE="$OUT/$SLUG.jsonl"
  echo "=== $PAGE ==="
  if node packages/cli/dist/src/cli.js analyze "$PAGE" --depth detailed --json \
      --since "$WINDOW_START" > "$FILE.tmp" 2> "$OUT/$SLUG.log"; then
    mv "$FILE.tmp" "$FILE"
    COUNT=$(wc -l < "$FILE" | tr -d ' ')
    SHA=$(shasum -a 256 "$FILE" | cut -d' ' -f1)
    LASTREV=$(python3 -c "
import json,sys
last=0
for l in open('$FILE'):
    if l.strip():
        e=json.loads(l); last=max(last, e.get('toRevisionId',0))
print(last)")
    [ $first -eq 1 ] || echo ',' >> "$MANIFEST.tmp"
    first=0
    printf '    {"page": "%s", "file": "%s.jsonl", "events": %s, "lastRevisionId": %s, "sha256": "%s"}' \
      "$PAGE" "$SLUG" "$COUNT" "$LASTREV" "$SHA" >> "$MANIFEST.tmp"
    echo "  -> $COUNT events, sha256 $SHA"
  else
    echo "  -> FAILED (see $OUT/$SLUG.log)" >&2
    rm -f "$FILE.tmp"
    exit 1
  fi
done

echo '' >> "$MANIFEST.tmp"
echo '  ]' >> "$MANIFEST.tmp"
echo '}' >> "$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"
rm -f "$OUT"/*.log
echo "=== corpus complete: $MANIFEST ==="
