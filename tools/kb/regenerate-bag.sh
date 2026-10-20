#!/bin/sh
# Regenerate the vendored bag from a `cnl-ckc` checkout (`.claude/rules/kb-build.md` `Vendored bag`).
#
# Builds upstream's `ckc` with a project-local toolchain and runs `ckc dist build` in a clone of the
# checkout at <rev>, so the checkout is only read. The bag lands in .scratch/ckc/dist, never in kb/:
# vendoring it is a separate, deliberate copy. Plain `cargo build` compiles the ghost-erased
# kernel, so Verus is not needed; the crates are vendored upstream, so the build runs offline.
#
# Usage: tools/kb/regenerate-bag.sh <cnl-ckc checkout> [<rev>]   (rev defaults to the checkout's HEAD)
# Exit 0 only when the built bag's release-manifest.tsv equals the one committed at <rev> byte for
# byte; when kb/ vendors a bag of the same name, its manifest and tarball are compared too.
set -eu

[ $# -ge 1 ] || { echo "usage: $0 <cnl-ckc checkout> [<rev>]" >&2; exit 2; }
CKC=$(cd "$1" && pwd)
REV=${2:-HEAD}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
S=$ROOT/.scratch/ckc

COMMIT=$(git -C "$CKC" rev-parse --verify "$REV^{commit}")
rm -rf "$S/src" "$S/dist"
mkdir -p "$S"
git clone --quiet "$CKC" "$S/src"
git -C "$S/src" checkout --quiet --detach "$COMMIT"

CHANNEL=$(sed -n 's/^channel *= *"\(.*\)"$/\1/p' "$S/src/rust/rust-toolchain.toml")
[ -n "$CHANNEL" ] || { echo "no toolchain channel in rust/rust-toolchain.toml" >&2; exit 1; }
# rustup itself refuses a CARGO_HOME it was not installed into, so CARGO_HOME reaches cargo alone.
export RUSTUP_HOME="$S/rustup"
rustup toolchain install "$CHANNEL" --profile minimal
# The toolchain's own binaries, never the rustup proxy: the proxy would read the clone's
# rust-toolchain.toml and fetch its extra components.
CARGO=$(rustup which --toolchain "$CHANNEL" cargo)
PATH=$(dirname "$CARGO"):$PATH
export PATH
(cd "$S/src/rust" && CARGO_HOME="$S/cargo" CARGO_TARGET_DIR="$S/target" \
  cargo build --release --locked --offline -q -p ckc)
(cd "$S/src" && "$S/target/release/ckc" dist build "$S/dist")

BAG=$(cd "$S/dist" && ls cnl-ckc-kb-g*.tar.gz)
NAME=${BAG%.tar.gz}
tar -xzOf "$S/dist/$BAG" "$NAME/release-manifest.tsv" > "$S/dist/release-manifest.tsv"
cmp "$S/dist/release-manifest.tsv" "$S/src/release-manifest.tsv"
echo "regenerate-bag: $BAG at ${COMMIT%"${COMMIT#????????}"}: release-manifest.tsv equals upstream's committed one"
if [ -f "$ROOT/kb/$BAG" ]; then
  tar -xzOf "$ROOT/kb/$BAG" "$NAME/release-manifest.tsv" | cmp - "$S/dist/release-manifest.tsv"
  cmp "$ROOT/kb/$BAG" "$S/dist/$BAG"
  echo "regenerate-bag: kb/$BAG is byte-identical to the rebuilt bag, release-manifest.tsv included"
fi
