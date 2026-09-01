#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/cnl-ckc-smoke.XXXXXX")"
served="$tmp/served"
nested="$served/deploy/nested/cnl-ckc-demo"
server_log="$tmp/http.log"
server_pid=

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT INT TERM

cd "$root"
pnpm build
mkdir -p "$nested"
cp -a dist/. "$nested/"

python3 -u -m http.server 0 --bind 127.0.0.1 --directory "$served" >"$server_log" 2>&1 &
server_pid=$!
port=
for _ in {1..200}; do
  port="$(python3 -c 'import re,sys; s=open(sys.argv[1], encoding="utf-8").read(); m=re.search(r"port ([0-9]+)",s); print(m.group(1) if m else "")' "$server_log")"
  [[ -n "$port" ]] && break
  kill -0 "$server_pid" 2>/dev/null || { printf 'smoke: HTTP server exited\n' >&2; exit 1; }
  sleep 0.05
done
[[ -n "$port" ]] || { printf 'smoke: HTTP server did not publish a port\n' >&2; exit 1; }

url="http://127.0.0.1:$port/deploy/nested/cnl-ckc-demo/"
webcap "$url" \
  --selector '[data-engine="ready"]' \
  --timeout 45000 \
  --png "$tmp/page.png" \
  --dom "$tmp/page.html"

python3 - "$nested" "$url" "$tmp/page.html" <<'PY'
from pathlib import Path
from urllib.parse import quote, urljoin
from urllib.request import urlopen
import re
import sys

nested = Path(sys.argv[1])
base = sys.argv[2]
dom = Path(sys.argv[3]).read_text(encoding="utf-8")
if 'data-engine="ready"' not in dom:
    raise SystemExit("smoke: ready marker absent from captured DOM")
if 'data-engine="error"' in dom:
    raise SystemExit("smoke: error marker present in captured DOM")

index = (nested / "index.html").read_text(encoding="utf-8")
refs = re.findall(r'(?:src|href)="([^"]+)"', index)
css = [urljoin(base, ref) for ref in refs if ref.split("?", 1)[0].endswith(".css")]
main = [urljoin(base, ref) for ref in refs if ref.split("?", 1)[0].endswith(".js")]
workers = [path for path in nested.rglob("*.js") if "worker" in path.name]
pvms = list(nested.rglob("*.pvm"))
if len(css) != 1:
    raise SystemExit(f"smoke: expected one CSS asset, found {len(css)}")
if len(main) != 1:
    raise SystemExit(f"smoke: expected one main JS asset, found {len(main)}")
if len(workers) != 1:
    raise SystemExit(f"smoke: expected one worker asset, found {len(workers)}")
if len(pvms) != 1:
    raise SystemExit(f"smoke: expected one PVM asset, found {len(pvms)}")

def asset_url(path: Path) -> str:
    relative = path.relative_to(nested).as_posix()
    return urljoin(base, quote(relative))

targets = [
    ("nested index", base),
    ("CSS", css[0]),
    ("main JS", main[0]),
    ("worker", asset_url(workers[0])),
    ("PVM", asset_url(pvms[0])),
]
for label, target in targets:
    with urlopen(target, timeout=45) as response:
        status = response.status
        response.read()
    if status != 200:
        raise SystemExit(f"smoke: {label} returned HTTP {status}: {target}")

print("smoke ok — nested index, CSS, main JS, worker and PVM returned 200")
PY
