#!/usr/bin/env bash
# Negative controls for every fail-closed gate step u7/u4 recorded.
# Each: mutate -> run -> record rc -> restore -> prove clean.
set -u
cd "$(dirname "$0")"

run() { # run <label> <cmd...>
  local label=$1; shift
  local out; out=$("$@" 2>&1); local rc=$?
  echo "### $label rc=$rc"
  echo "$out" | /usr/bin/rg -v '^$|^>' | head -8
}

restore() { git checkout -- "$@"; git status --porcelain -- "$@" | /usr/bin/rg . && echo "!! DIRTY $*" || echo "restored clean: $*"; }

echo "===== baseline ====="
run "copy:check baseline" node tools/copy-check.mjs
run "contrast:check baseline" node tools/contrast.mjs
run "kb:asset-check baseline" node tools/kb/check.mjs

echo; echo "===== C1 copy-check: 30-word INSTRUCTIONS sentence ====="
python3 -P - <<'PY'
import pathlib
p = pathlib.Path('src/demo/copy.ts'); t = p.read_text()
probe = "  auditProbe: 'This deliberately overlong probe sentence exists only to prove that the copy validator fails closed when an instruction string exceeds its declared twenty word ceiling by a wide margin here.',\n"
p.write_text(t.replace("export const INSTRUCTIONS = {\n", "export const INSTRUCTIONS = {\n" + probe, 1))
PY
run "copy:check MUTANT" node tools/copy-check.mjs
restore src/demo/copy.ts
run "copy:check RESTORED" node tools/copy-check.mjs

echo; echo "===== C2 contrast: perturb --text-muted ====="
python3 -P - <<'PY'
import pathlib
p = pathlib.Path('src/app.css'); t = p.read_text()
assert '--text-muted: #545d66;' in t
p.write_text(t.replace('--text-muted: #545d66;', '--text-muted: #c9c4ba;', 1))
PY
run "contrast:check MUTANT" node tools/contrast.mjs
restore src/app.css
run "contrast:check RESTORED" node tools/contrast.mjs

echo; echo "===== C3 asset-check: sibling-path reach ====="
python3 -P - <<'PY'
import pathlib
p = pathlib.Path('src/demo/copy.ts')
p.write_text("// audit probe: " + "../" + "cnl-ckc/guidelines\n" + p.read_text())
PY
run "kb:asset-check MUTANT(sibling)" node tools/kb/check.mjs
restore src/demo/copy.ts

echo; echo "===== C4 asset-check: answer-oracle reach ====="
python3 -P - <<'PY'
import pathlib
p = pathlib.Path('src/demo/copy.ts')
p.write_text("// audit probe: " + "queries" + "/" + "answers/category-a-recommendations.pl\n" + p.read_text())
PY
run "kb:asset-check MUTANT(oracle)" node tools/kb/check.mjs
restore src/demo/copy.ts

echo; echo "===== C5 sibling-scan boundary: cnl-ckc-demo must NOT trip ====="
python3 -P - <<'PY'
import pathlib
p = pathlib.Path('src/demo/copy.ts')
p.write_text("// audit probe: " + "../" + "cnl-ckc-demo/kb is this project itself\n" + p.read_text())
PY
run "kb:asset-check MUTANT(cnl-ckc-demo)" node tools/kb/check.mjs
restore src/demo/copy.ts

echo; echo "===== C6 smoke negative control: remove kb.pvm ====="
cp kb/generated/kb.pvm /tmp/audit-kb.pvm.bak && rm kb/generated/kb.pvm
run "smoke MUTANT(no pvm)" node tools/smoke.mjs
cp /tmp/audit-kb.pvm.bak kb/generated/kb.pvm && rm /tmp/audit-kb.pvm.bak
echo "pvm restored bytes: $(python3 -P -c "import pathlib;print(pathlib.Path('kb/generated/kb.pvm').stat().st_size)")"

echo; echo "===== final tree state ====="
git status --porcelain | /usr/bin/rg . && echo "!! WORKTREE DIRTY" || echo "worktree clean"
