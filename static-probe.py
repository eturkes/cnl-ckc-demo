#!/usr/bin/env python3
"""Static re-derivations for the audit rows a file read can decide."""

import gzip
import json
import pathlib
import re
import collections

W = pathlib.Path(__file__).parent
KB = pathlib.Path("/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/kb")
NM = pathlib.Path("/run/host/home/eturkes/Projects/cnl-ckc-demo/node_modules")
out = lambda k, v: print(f"{k:6} {v}")

# A088 concatenated pl/ raw + gzip-9
pl = sorted(KB.glob("data/guidelines/*/pl/*.pl"))
blob = b"".join(p.read_bytes() for p in pl)
out("A088", f"concatenated pl/ raw={len(blob)} B, gzip-9={len(gzip.compress(blob, 9))} B (recorded 4,716,517 / 169,571)")

# A089 production build sizes
dist = sorted(f for f in (W / "dist").rglob("*") if f.is_file())
worker = [f for f in dist if "worker" in f.name and f.suffix == ".js"]
pvm = [f for f in dist if f.suffix == ".pvm"]
out("A089", f"dist total={sum(f.stat().st_size for f in dist)} B over {len(dist)} files; worker={worker[0].stat().st_size if worker else '?'}; pvm={pvm[0].stat().st_size if pvm else '?'} (recorded 3,500,973 raw / worker 3,062,652 / PVM 437,064)")

# A092 / A119 catalog artifact size
cat = W / "kb/generated/question-catalog.json"
out("A092", f"question-catalog.json = {cat.stat().st_size} B (memory ~3.3 kB; m1u4 D1 2644 B)")

# A094 atom site counts
src = b"".join(p.read_bytes() for p in pl)
for atom in (b"'category-B-recommendation'", b"'evidence-type-3-recommendation'", b"'category-A-recommendation'", b"'evidence-type-1-recommendation'"):
    out("A094", f"{atom.decode():36} sites={src.count(atom)}")
for near in (b"'category-B-decision'", b"'evidence-type-2-recommendation'", b"'evidence-type-4-recommendation'"):
    out("A094", f"near-miss {near.decode():36} sites={src.count(near)}")

# A122 humanizer corpus shape
txt = src.decode()
out("A122", f"Role product={len(re.findall(chr(39)+'[$]guideline_id'+chr(39)+r'\(product,', txt))} context={len(re.findall(chr(39)+'[$]guideline_id'+chr(39)+r'\(context,', txt))} (recorded 10336 / 8911)")
refs = [int(m) for m in re.findall(r"ref\((\d+)\)", txt)]
boxes = [int(m) for m in re.findall(r"box\((\d+)\)", txt)]
sent = [int(m) for m in re.findall(chr(39) + "[$]guideline_id" + chr(39) + r"\(\w+,'[^']+',(\d+),", txt)]
out("A122", f"ref range {min(refs)}..{max(refs)}; box range {min(boxes)}..{max(boxes)}; sentence range {min(sent)}..{max(sent)}")
docids = set(re.findall(chr(39) + "[$]guideline_id" + chr(39) + r"\(\w+,'([^']+)'", txt))
out("A122", f"distinct doc ids referenced = {len(docids)} (recorded 337 unique)")

# A120 committed category-A answer file
ans = KB / "data/guidelines/cdc-2022-opioid/queries/answers/category-a-recommendations.pl"
b = ans.read_bytes()
i, j = b.find(b"solutions(["), b.rfind(b"])")
out("A120", f"file={len(b)} B, lines={b.count(chr(10).encode())}, solutions([ at {i}, closing at {j + 2} -> substring len {j + 2 - i} (recorded 734 B / 2 lines / 481 B at [249,730))")

# A095 / A129 manifest
man = json.loads((W / "kb/generated/kb-manifest.json").read_text())
out("A095", f"manifest version field = {man.get('version', man.get('manifestVersion'))}; has catalog block = {'catalog' in man}; keys={sorted(man)}")
out("A129", f"input digest = {json.dumps(man.get('input'))[:200]}")

# A080 Query.close undeclared
dts = (NM / "swipl-wasm/dist/prolog.d.ts")
cands = [p for p in (NM / "swipl-wasm/dist").rglob("*.d.ts")]
hits = {p.name: (b"close" in p.read_bytes(), b"next" in p.read_bytes(), b"once" in p.read_bytes()) for p in cands}
out("A080", f"swipl-wasm .d.ts (close,next,once) presence: {hits}")

# A081 reserved wrapper names + full-stop strip
eng = (W / "src/engine").read_bytes() if False else b"".join(p.read_bytes() for p in (W / "src/engine").glob("*.ts"))
for name in (b"BudgetDepth_", b"BudgetInference_", b"BudgetResource_"):
    out("A081", f"{name.decode()} in src/engine = {name in eng}")
out("A081", f"trailing full-stop strip present = {bool(re.search(rb'replace\(/[^/]*\\\\.[^/]*/|endsWith\(.\..\)|trimEnd', eng))}")

# A097 eslint-plugin-svelte rule census
try:
    rules = json.loads((NM / "eslint-plugin-svelte/package.json").read_text())["version"]
    mod = list((NM / "eslint-plugin-svelte/lib/rules").glob("*.js"))
    a11y = [p.name for p in mod if p.name.startswith("a11y")]
    out("A097", f"eslint-plugin-svelte {rules}: {len(mod)} rule modules, {len(a11y)} a11y-* -> {a11y[:5]}")
except Exception as e:
    out("A097", f"unavailable: {e}")

# A098 / A099 versions
for p in ("axe-core", "jsdom", "bits-ui", "@internationalized/date"):
    f = NM / p / "package.json"
    out("A098", f"{p} installed = {json.loads(f.read_text())['version'] if f.exists() else 'ABSENT'}")

# A101 smoke selector shape
smoke = (W / "tools/smoke.mjs").read_text()
out("A101", f"option-id selector in smoke.mjs: {[l.strip() for l in smoke.splitlines() if 'role=' in l and 'option' in l]}")
combo = (W / "src/questions/QuestionCombobox.svelte").read_text()
out("A101", f"option id template in combobox: {[l.strip() for l in combo.splitlines() if 'option-' in l][:3]}")

# A112 TS runners absent
for p in ("tsx", "vite-node", "jiti", "esbuild"):
    out("A112", f"{p} present in node_modules = {(NM / p).exists()}")
out("A112", f"vitest deps include vite-node = {'vite-node' in json.loads((NM / 'vitest/package.json').read_text()).get('dependencies', {})}")

# A113 assetsInlineLimit + hashed pvm size
vc = (W / "vite.config.ts").read_text().splitlines()
out("A113", f"assetsInlineLimit line = {[f'{n+1}:{l.strip()}' for n, l in enumerate(vc) if 'assetsInlineLimit' in l]}")
out("A113", f"built hashed pvm bytes = {pvm[0].stat().st_size if pvm else '?'} (recorded 437064)")

# A121 eslint core rule + check.mjs line anchors
chk = (W / "tools/kb/check.mjs").read_text().splitlines()
out("A121", f"check.mjs total lines = {len(chk)}; fail-accumulator at {[n+1 for n,l in enumerate(chk) if 'failures.push' in l or 'const fail' in l]}")
nri = NM / ".pnpm"
found = list(nri.glob("eslint@*/node_modules/eslint/lib/rules/no-restricted-imports.js"))
if found:
    lines = found[0].read_text().splitlines()
    out("A121", f"no-restricted-imports.js lines = {len(lines)}; 858-864 = {[l.strip()[:60] for l in lines[857:864]]}")
else:
    out("A121", "no-restricted-imports.js not found under .pnpm")

# A135 / A045 probe
out("A135", f"tools/visual-qa.mjs in primary tree = {(W / 'tools/visual-qa.mjs').exists()}")
