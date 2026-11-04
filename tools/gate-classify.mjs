// `pnpm gate:classify <product|gate|flake|planted> [note…]` — the entry alone; the command is
// `classifyCommand` (`tools/gate-ledger.mjs`), which the suite drives in process.

import { classifyCommand } from './gate-ledger.mjs';

const { status, stdout, stderr } = classifyCommand(process.argv.slice(2));
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exit(status);
