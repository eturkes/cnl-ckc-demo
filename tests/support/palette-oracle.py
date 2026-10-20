# The coloraide figures `tests/palette-check.test.ts` holds `tools/palette-check.mjs` to:
# OKLab ΔE×100 plain and under Machado protan + deutan at severity 1.0, for each pair given.
# Regenerate: uv run --with coloraide==8.13.1 python -I tests/support/palette-oracle.py '<json [[a, b], …]>'
import json
import sys

from coloraide import Color

rows = []
for a, b in json.loads(sys.argv[1]):
    ca, cb = Color(a), Color(b)
    row = [a, b, ca.delta_e(cb, method='ok') * 100]
    for cvd in ('protan', 'deutan'):
        fa, fb = ca.filter(cvd, 1.0, method='machado'), cb.filter(cvd, 1.0, method='machado')
        row.append(fa.delta_e(fb, method='ok') * 100)
    rows.append(row)
print(json.dumps(rows))
