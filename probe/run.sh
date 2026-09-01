#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
out=$(mktemp -d "${TMPDIR:-/tmp}/spike-m1u2-js.XXXXXX")
trap 'rm -rf "$out"' EXIT HUP INT TERM

cd "$root"
pnpm exec tsc \
  --target ES2022 \
  --module ESNext \
  --moduleResolution Bundler \
  --strict \
  --noUncheckedIndexedAccess \
  --exactOptionalPropertyTypes \
  --verbatimModuleSyntax \
  --noFallthroughCasesInSwitch \
  --noUnusedLocals \
  --noUnusedParameters \
  --skipLibCheck \
  --outDir "$out" \
  probe/decoder.mts
node probe/spike.cjs "$out/decoder.mjs" "$@"
