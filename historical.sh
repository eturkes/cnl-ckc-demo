#!/usr/bin/env bash
# Replay each unit-closing commit's recorded gate summary with the CURRENT toolchain.
# node_modules is the shared primary install (a superset for older commits), so file
# counts carry that caveat; test counts and rc do not depend on it.
set -u
cd "$(dirname "$0")"

for pair in "b935beb:u1(memory Gate: 319 files, 3 files/38 tests, 112 modules)" \
            "2f78353:u2(330 files, 58 tests)" \
            "823ed4f:u4(339 files, 107 tests, 3 assets)" \
            "5e3bf46:u5(342 files, 133 tests, 3 assets, 117 modules)" \
            "d5017dd:u6(350 files, 171 tests, 10 files)"; do
  sha=${pair%%:*}; label=${pair##*:}
  echo "================ $sha  $label ================"
  git checkout -q "$sha" 2>/dev/null || { echo "CHECKOUT FAILED"; continue; }
  rm -rf kb/generated
  out=$(pnpm gate 2>&1); rc=$?
  echo "GATE_RC=$rc"
  echo "$out" | /usr/bin/rg 'COMPLETED|Test Files|Tests  |assets verified|modules transformed|kb:build ok|error|warning' | head -12
  echo
done

git checkout -q wt/audit-m1
echo "=== back on $(git rev-parse --abbrev-ref HEAD) $(git rev-parse --short=7 HEAD) ==="
git status --porcelain | /usr/bin/rg . && echo "!! DIRTY" || echo "worktree clean"
