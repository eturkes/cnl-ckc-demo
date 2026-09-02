#!/usr/bin/env bash
# c19 negative controls + c22 absent-artifact control. Restores every touched path.
set -u
cd "$(dirname "$0")/.." || exit 1
T=src/questions/catalog.ts
LIT='queries/answers'

run() { # label, appended-line
  printf '\n%s\n' "$1"
  cp "$T" .probes/.catalog.bak
  printf '%s\n' "$2" >> "$T"
  pnpm kb:asset-check > .probes/.reach.log 2>&1
  printf 'rc=%s :: %s\n' "$?" "$(command grep -E 'answer-oracle|asset-check' .probes/.reach.log | command head -3 | tr '\n' ' ')"
  cp .probes/.catalog.bak "$T"
  rm -f .probes/.catalog.bak
}

printf '## c19 baseline\n'
pnpm kb:asset-check > .probes/.reach.log 2>&1
printf 'rc=%s :: %s\n' "$?" "$(command grep -E 'asset-check' .probes/.reach.log | command head -2 | tr '\n' ' ')"

run '## c19 static import reach' "import _fixture from '../../.scratch/kb/data/guidelines/cdc-2022-opioid/${LIT}/category-a-recommendations.pl?raw';"
run '## c19 dynamic import() reach' "export const leak = async () => await import('../../.scratch/kb/data/guidelines/cdc-2022-opioid/${LIT}/category-a-recommendations.pl?raw');"
run '## c19 fs read reach' "export const leak2 = (): string => require('node:fs').readFileSync('kb/x/${LIT}/category-a-recommendations.pl', 'utf8');"
run '## c19 bare literal in a comment' "// ${LIT}"

printf '\n## c19 reach parked in kb/generated (production-reachable via @kb alias, outside PRODUCTION_ROOTS)\n'
printf '{"path":"data/guidelines/cdc-2022-opioid/%s/category-a-recommendations.pl"}\n' "$LIT" > kb/generated/leak.json
cp "$T" .probes/.catalog.bak
printf "%s\n" "import _leak from '@kb/leak.json';" >> "$T"
pnpm kb:asset-check > .probes/.reach.log 2>&1
printf 'rc=%s :: %s\n' "$?" "$(command grep -E 'answer-oracle|asset-check' .probes/.reach.log | command head -3 | tr '\n' ' ')"
cp .probes/.catalog.bak "$T"; rm -f .probes/.catalog.bak kb/generated/leak.json

printf '\n## c19 sibling-path scan control (../cnl-ckc)\n'
cp "$T" .probes/.catalog.bak
printf "%s\n" "// ../cnl-ckc/data" >> "$T"
pnpm kb:asset-check > .probes/.reach.log 2>&1
printf 'rc=%s :: %s\n' "$?" "$(command grep -E 'sibling|asset-check' .probes/.reach.log | command head -3 | tr '\n' ' ')"
cp .probes/.catalog.bak "$T"; rm -f .probes/.catalog.bak

printf '\n## c22 absent kb/generated: tests must FAIL, not skip\n'
mv kb/generated .probes/generated-parked
pnpm test > .probes/.absent.log 2>&1
printf 'rc=%s\n' "$?"
command grep -E 'Test Files|Tests |skipped|ENOENT|Cannot find' .probes/.absent.log | command head -8
mv .probes/generated-parked kb/generated

printf '\n## c22 restored\n'
pnpm kb:asset-check > .probes/.reach.log 2>&1
printf 'rc=%s\n' "$?"
git status --porcelain
