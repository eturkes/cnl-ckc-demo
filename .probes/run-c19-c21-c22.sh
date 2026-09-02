#!/usr/bin/env bash
# c21 G4 reproduce · c22 P6.3 absent-artifact · c19 killing-mutant (PRODUCTION_ROOTS = []).
set -u
W=/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/worktrees/rev-m1u4-3
C=$W/.probes/clean

echo "== G4 kb:reproduce =="
pnpm --dir "$C" kb:reproduce 2>&1; echo "REPRODUCE_RC=$?"

echo "== c22 P6.3 absent kb/generated -> pnpm test =="
rm -rf "$C/kb/generated"
pnpm --dir "$C" test 2>&1; echo "ABSENT_TEST_RC=$?"

echo "== restore =="
pnpm --dir "$C" kb:build 2>&1; echo "REBUILD_RC=$?"

echo "== c19 mutant: PRODUCTION_ROOTS = [] =="
cp "$C/tools/kb/check.mjs" "$W/.probes/check.mjs.orig"
node -e '
const fs=require("fs");const p=process.argv[1];let s=fs.readFileSync(p,"utf8");
const was=s;
s=s.replace("const PRODUCTION_ROOTS = [\x27src\x27, \x27tools\x27, \x27vite.config.ts\x27, \x27index.html\x27];","const PRODUCTION_ROOTS = [];");
if(s===was){console.error("MUTATE_FAILED");process.exit(3);} fs.writeFileSync(p,s);console.log("MUTATED");
' "$C/tools/kb/check.mjs"; echo "MUTATE_RC=$?"
printf '%s\n' "export const p = 'queries/answers/category-a-recommendations.pl';" > "$C/src/zz-reach-under-mutant.ts"
pnpm --dir "$C" gate 2>&1; echo "MUTANT_GATE_RC=$?"
rm -f "$C/src/zz-reach-under-mutant.ts"
cp "$W/.probes/check.mjs.orig" "$C/tools/kb/check.mjs"
pnpm --dir "$C" kb:asset-check 2>&1; echo "RESTORED_CHECK_RC=$?"
