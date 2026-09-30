#!/usr/bin/env bash
# Bundles each edge function into one file under supabase/.bundle/<name>/index.ts
# for upload (the Supabase MCP deploy takes flat files). The source of truth
# stays in supabase/functions; the bundle is not committed.
set -euo pipefail
cd "$(dirname "$0")/.."
for fn in sarvam-call-handler build-brief; do
  out="supabase/.bundle/$fn"
  mkdir -p "$out"
  npx --yes esbuild "supabase/functions/$fn/index.ts" \
    --bundle --format=esm --platform=neutral --target=es2022 \
    --external:'jsr:*' --external:'npm:*' \
    --banner:js="// Bundled from supabase/functions/$fn by scripts/bundle-functions.sh. Edit the source, not this file." \
    --outfile="$out/index.ts" --log-level=warning
  echo "$out/index.ts $(wc -c < "$out/index.ts") bytes"
done
