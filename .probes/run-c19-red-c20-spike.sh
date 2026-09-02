#!/usr/bin/env bash
# c19: the negative control green at base, red under the ANSWERS mutant.
# c20: D9 spike replay with the record field path the spike actually returns.
set -u
W=/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/worktrees/rev-m1u4-3
C=$W/.probes/clean
T=$C/tests/zz-reach.test.ts

cp "$W/.probes/zz-reach.test.ts.src" "$T"

echo "== c19 control at base =="
pnpm --dir "$C" exec vitest run tests/zz-reach.test.ts 2>&1 | /usr/bin/rg 'Tests |Test Files|✓|×|FAIL'; echo "BASE_CONTROL_RC=${PIPESTATUS[0]}"

echo "== c19 control under ANSWERS mutant =="
cp "$C/tools/kb/check.mjs" "$W/.probes/check.mjs.orig"
node -e '
const fs=require("fs");const p=process.argv[1];let s=fs.readFileSync(p,"utf8");const was=s;
s=s.replace("const ANSWERS = new RegExp([\x27queries\x27, \x27answers\x27].join(\x27/\x27));",
            "const ANSWERS = new RegExp([\x27queries\x27, \x27answers\x27].join(\x27/\x27) + \x27zzz\x27);");
if(s===was){console.error("MUTATE_FAILED");process.exit(3);} fs.writeFileSync(p,s);
' "$C/tools/kb/check.mjs"
pnpm --dir "$C" exec vitest run tests/zz-reach.test.ts 2>&1 | /usr/bin/rg 'Tests |Test Files|✓|×|FAIL'; echo "MUTANT_CONTROL_RC=${PIPESTATUS[0]}"
cp "$W/.probes/check.mjs.orig" "$C/tools/kb/check.mjs"

echo "== c19 control under PRODUCTION_ROOTS narrowed to public =="
node -e '
const fs=require("fs");const p=process.argv[1];let s=fs.readFileSync(p,"utf8");const was=s;
s=s.replace("const PRODUCTION_ROOTS = [\x27src\x27, \x27tools\x27, \x27vite.config.ts\x27, \x27index.html\x27];",
            "const PRODUCTION_ROOTS = [\x27public\x27];");
if(s===was){console.error("MUTATE_FAILED");process.exit(3);} fs.writeFileSync(p,s);
' "$C/tools/kb/check.mjs"
pnpm --dir "$C" exec vitest run tests/zz-reach.test.ts 2>&1 | /usr/bin/rg 'Tests |Test Files|✓|×|FAIL'; echo "ROOTS_CONTROL_RC=${PIPESTATUS[0]}"
cp "$W/.probes/check.mjs.orig" "$C/tools/kb/check.mjs"
rm -f "$T" "$C/src/zz-forbidden-reach-control.ts"

echo "== c20 D9 spike replay (gen 65f496a) =="
node "$W/.probes/spike-gen-diff2.mjs" 2>&1
echo "SPIKE_GEN_RC=$?"
