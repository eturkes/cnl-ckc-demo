#!/usr/bin/env bash
# c19 killing mutant that survives type inference: never-matching ANSWERS pattern.
set -u
W=/run/host/home/eturkes/Projects/cnl-ckc-demo/.scratch/worktrees/rev-m1u4-3
C=$W/.probes/clean

cp "$C/tools/kb/check.mjs" "$W/.probes/check.mjs.orig"
node -e '
const fs=require("fs");const p=process.argv[1];let s=fs.readFileSync(p,"utf8");const was=s;
s=s.replace("const ANSWERS = new RegExp([\x27queries\x27, \x27answers\x27].join(\x27/\x27));",
            "const ANSWERS = new RegExp([\x27queries\x27, \x27answers\x27].join(\x27/\x27) + \x27zzz\x27);");
if(s===was){console.error("MUTATE_FAILED");process.exit(3);} fs.writeFileSync(p,s);console.log("MUTATED-regex");
' "$C/tools/kb/check.mjs"; echo "MUTATE_RC=$?"

printf '%s\n' "// Negative control: a production module naming the answer oracle." \
  "export const ORACLE = 'queries/answers/category-a-recommendations.pl';" > "$C/src/zz-reach-under-mutant.ts"

pnpm --dir "$C" gate 2>&1; echo "MUTANT2_GATE_RC=$?"

rm -f "$C/src/zz-reach-under-mutant.ts"
cp "$W/.probes/check.mjs.orig" "$C/tools/kb/check.mjs"
pnpm --dir "$C" kb:asset-check 2>&1; echo "RESTORED_CHECK_RC=$?"
