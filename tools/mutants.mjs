// The mutant table `pnpm mutate` runs: each entry restores one fixed defect's pre-fix behaviour
// and names the check that closes it, which must go red. A green row is a fix nothing binds.
// An `inv` entry instead plants a wrong implementation or input for one check in
// `.agent/contracts/mnt5-inventory.md`: that check's firing record, rerunnable.
//
// `check` is a vitest file plus a `-t` name filter, or a whole command for a defect a gate step
// closes. The filter is a regex: `$` anchors, so `named $t` selects nothing. Every `old` must
// occur exactly once in its file; a stale anchor stops the run.

/**
 * @typedef {{ path: string, old: string, new: string }} Edit
 * @typedef {{ label: string, edits: Edit[], check: { test: string, name: string } | string[] }} Mutant
 */

/** @type {Mutant[]} */
export const MUTANTS = [
  {
    label: 'R03 cap counted before the extra step',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "            } else if (solutions.length >= budget.answerCap) {\n              // Proving one solution past the cap and discarding it is the only thing\n              // that separates a truncated run from a run holding exactly `answerCap`\n              // answers, which owes the caller honest exhaustion instead.\n              stopped = 'answer-cap';\n            } else {",
        new: '            } else {',
      },
      {
        path: 'src/engine/session.ts',
        old: '        if (stopped !== undefined || exhausted || step.done === true) break;',
        new: "        if (stopped !== undefined || exhausted || step.done === true) break;\n        if (solutions.length >= budget.answerCap) {\n          stopped = 'answer-cap';\n          break;\n        }",
      },
    ],
    check: { test: 'tests/engine-budgets.test.ts', name: 'exact-fit cap' },
  },
  {
    label: 'R23 shlib tolerated at every phase',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "this.#failClosed(engine, 'runtime load');",
        new: "this.#failClosed(engine, 'runtime load', TOLERATED);",
      },
    ],
    check: { test: 'tests/engine-budgets.test.ts', name: 'qsave shlib text' },
  },
  {
    label: 'R09 heap limit reuses the worker',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "heap outcome before its replacement engine has re-verified the contract.\n        if (response.limit === 'heap') await this.#recreate();\n",
        new: 'heap outcome before its replacement engine has re-verified the contract.\n',
      },
    ],
    check: { test: 'tests/engine-budgets.test.ts', name: 'heap limit' },
  },
  {
    label: 'chat-c2 an aborted runtime keeps its worker',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "        return { kind: 'cancelled', solutions: response.solutions };\n      case 'error':\n        // An aborted runtime is retired like a heap trip: the caller resumes on its replacement.\n        if (response.error.code === 'aborted') await this.#recreate();\n",
        new: "        return { kind: 'cancelled', solutions: response.solutions };\n      case 'error':\n",
      },
    ],
    check: {
      test: 'tests/engine-abort-client.test.ts',
      name: "A5 'query' 'aborted error' waits for exactly one booted replacement",
    },
  },
  {
    label: 'c06 undeclared query set accepted',
    edits: [
      {
        path: 'tools/kb/exports.mjs',
        old: '  if (unexpected.length > 0 || missing.length > 0) {',
        new: '  if (false) {',
      },
    ],
    check: { test: 'tests/legacy-export-lane.test.ts', name: 'D2' },
  },
  {
    label: 'c12 row sort by rendered bytes',
    edits: [
      {
        path: 'src/questions/serialize.ts',
        old: '  rows.sort(compareRows);',
        new: "  rows.sort((a, b) => compareText(a.text.join(','), b.text.join(',')));",
      },
    ],
    check: { test: 'tests/questions-live.test.ts', name: 'term order rather than' },
  },
  {
    label: 'c12 duplicate collapse removed',
    edits: [
      {
        path: 'src/questions/serialize.ts',
        old: '  const unique = rows.filter(\n    (row, index) => index === 0 || compareRows(row, rows[index - 1] as Row) !== 0,\n  );',
        new: '  const unique = rows;',
      },
    ],
    check: { test: 'tests/questions-live.test.ts', name: 'duplicate proofs' },
  },
  {
    label: 'R01 consult armed with no deadline',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "{ kind: 'consult', source }, CONSULT_DEADLINE_MS)",
        new: "{ kind: 'consult', source })",
      },
    ],
    check: { test: 'tests/engine-budgets.test.ts', name: 'arms one deadline' },
  },
  {
    label: 'R08 early cancel dropped',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: '    this.#cancelling = this.#deferred.delete(id);\n    const started = Date.now();\n    // The deadline bounds display rendering too',
        new: '    this.#cancelling = false;\n    const started = Date.now();\n    // The deadline bounds display rendering too',
      },
    ],
    check: { test: 'tests/engine-budgets.test.ts', name: 'defers a cancel' },
  },
  {
    label: 'R29 messageerror unhandled',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "    worker.addEventListener('messageerror', () => {\n      if (generation === this.#generation) this.#abort('client could not deserialize a response');\n    });\n",
        new: '',
      },
    ],
    check: { test: 'tests/engine-cancel.test.ts', name: 'messageerror' },
  },
  {
    label: 'R29 post failure escapes as a rejection',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: '      try {\n        worker.postMessage({ ...request, id });\n      } catch (cause) {\n        this.#settle(id, protocolError(id, cause));\n        return;\n      }',
        new: '      worker.postMessage({ ...request, id });',
      },
    ],
    check: { test: 'tests/engine-cancel.test.ts', name: 'postMessage' },
  },
  {
    label: 'R29 retired watchdog resets the live generation',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: '  #onDeadline(id: string): void {\n    if (!this.#pending.has(id)) return;\n',
        new: '  #onDeadline(id: string): void {\n',
      },
    ],
    check: { test: 'tests/engine-cancel.test.ts', name: 'retired generation' },
  },
  {
    label: 'c19 reach scan narrowed off src',
    edits: [
      {
        path: 'tools/kb/check.mjs',
        old: "const PRODUCTION_ROOTS = ['src',",
        new: "const PRODUCTION_ROOTS = ['public',",
      },
    ],
    check: { test: 'tests/kb-reach.test.ts', name: 'fails kb:asset-check' },
  },
  {
    label: 'U03 interior NUL truncated into an accepted name',
    edits: [
      {
        path: 'tools/kb/bag.mjs',
        old: "      const terminated = raw[size - 1] === 0;\n      longName = Buffer.from(terminated ? raw.subarray(0, size - 1) : raw).toString('utf8');",
        new: "      const end = raw.indexOf(0);\n      longName = Buffer.from(end === -1 ? raw : raw.subarray(0, end)).toString('utf8');",
      },
    ],
    check: { test: 'tests/kb-bag.test.ts', name: 'NUL inside a GNU long name' },
  },
  {
    label: 'U08 gzip failure escapes untyped',
    edits: [
      {
        path: 'tools/kb/bag.mjs',
        old: 'const tar = inflate(gzBytes);',
        new: 'const tar = gunzipSync(gzBytes);',
      },
    ],
    check: { test: 'tests/kb-bag.test.ts', name: 'truncated gzip' },
  },
  {
    label: 'U11 document count floored at >= 1',
    edits: [
      {
        path: 'tools/kb/produce.mjs',
        old: "  requireEveryDocument(contract, source, 'image build');\n",
        new: '',
      },
    ],
    check: { test: 'tests/kb-produce.test.ts', name: 'fewer documents' },
  },
  {
    label: 'U12 qsave ERROR tolerated as save noise',
    edits: [
      {
        path: 'tools/kb/produce.mjs',
        old: 'const SAVE_NOISE = /^Warning:.*(?:qsave\\.pl:\\d+:|library\\(shlib\\))/u;',
        new: 'const SAVE_NOISE = /qsave\\.pl:\\d+:|library\\(shlib\\)/u;',
      },
    ],
    check: { test: 'tests/kb-produce.test.ts', name: 'qsave shlib warnings' },
  },
  {
    label: 'L25 recognized binding falls back to raw display',
    edits: [
      {
        path: 'src/questions/humanize.ts',
        old: '  return { text: humanizeGuidelineId(term, display), items: [], structured: false };',
        new: '  return { text: display, items: [], structured: false };',
      },
    ],
    check: { test: 'tests/demo-controller.dom.test.ts', name: 'recognized guideline id' },
  },
  {
    label: 'ui listbox click handler without its compiler exemption',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: '    <!-- svelte-ignore a11y_click_events_have_key_events -->\n    <ul\n',
        new: '    <ul\n',
      },
    ],
    check: ['pnpm', 'check'],
  },
  {
    label: 'L28 dead public member revived',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: '  select(id: QuestionId | null): void {',
        new: "  get solutions(): readonly PlSolution[] {\n    return this.state.kind === 'settled' ? solutionsOf(this.state.result) : [];\n  }\n\n  select(id: QuestionId | null): void {",
      },
    ],
    check: { test: 'tests/demo-api.test.ts', name: 'declared controller members' },
  },
  {
    label: 'E03 corpus count written back into copy',
    edits: [
      {
        path: 'src/i18n/en.ts',
        old: "    `The engine reports ${plural(documents, 'compiled document')}.`,",
        new: "    'The engine reports 337 compiled documents.',",
      },
    ],
    check: { test: 'tests/about-copy.dom.test.ts', name: 'E03' },
  },
  {
    label: 'E05 boot no longer single-flighted',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: '    this.#booting ??= this.#bootOnce(image, report).finally(() => {\n      this.#booting = undefined;\n    });\n    return this.#booting;\n',
        new: '    return this.#bootOnce(image, report);\n',
      },
    ],
    check: { test: 'tests/engine-session.test.ts', name: 'loads the image once' },
  },
  {
    label: 'E10 worker-failure broadcast ignored',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "      if (response.id === WORKER_FAILURE_ID) {\n        this.#abort(\n          response.kind === 'error' ? response.error.message : `worker reported ${response.kind}`,\n        );\n        return;\n      }\n",
        new: '',
      },
    ],
    check: { test: 'tests/engine-cancel.test.ts', name: 'worker reports a failure of its own' },
  },
  {
    label: 'E16 encoder mints an unnamed variable',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: '        return new constructors.Var(name);',
        new: '        return new constructors.Var();',
      },
    ],
    check: { test: 'tests/engine-session.test.ts', name: 're-enters a shared variable' },
  },
  {
    label: 'E18 dict branch reachable behind a $t wrapper',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "  if (value.$t === undefined && typeof value.$tag === 'string' && value.$tag !== 'bindings') {",
        new: "  if (typeof value.$tag === 'string' && value.$tag !== 'bindings') {",
      },
    ],
    check: {
      test: 'tests/engine-session.test.ts',
      name: 'fails closed on a value it does not recognize',
    },
  },
  {
    label: 'E19 serialization scan removed from the gate',
    edits: [
      {
        path: 'tools/kb/check.mjs',
        old: "for (const root of SERIALIZE_ROOTS) {\n  for (const path of walk(join(ROOT, root))) {\n    if (SERIALIZE.test(readFileSync(path, 'latin1'))) fail(`JSON serialization in ${relative(ROOT, path)}`);\n  }\n}\n\n",
        new: '',
      },
    ],
    check: { test: 'tests/kb-reach.test.ts', name: 'fails kb:asset-check on a serializing call' },
  },
  {
    label: 'E22 client drops the solutions it received',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "      case 'solutions':\n        return { kind: 'solutions', solutions: response.solutions };",
        new: "      case 'solutions':\n        return { kind: 'solutions', solutions: [] };",
      },
    ],
    check: {
      test: 'tests/engine-client-live.test.ts',
      name: 'seven category-A solutions through EngineClient',
    },
  },
  {
    label: 'R34 hard reset keeps the old worker alive',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: '    this.#worker?.terminate();\n    this.#worker = undefined;\n    // Retiring the generation before settling keeps a late response from the dead',
        new: '    this.#worker = undefined;\n    // Retiring the generation before settling keeps a late response from the dead',
      },
    ],
    check: { test: 'tests/engine-client-live.test.ts', name: 'drops an asserted overlay' },
  },
  {
    label: 'I07 closed ArrowUp opens at the selection',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: "      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {\n        event.preventDefault();\n        show();\n      } else if (key === 'ArrowUp' || key === 'Home' || key === 'End') {\n        // K2 + K4: these three open at a fixed end, not at the selection.\n        event.preventDefault();\n        show();\n        activeIndex = key === 'End' ? LAST : 0;",
        new: "      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {\n        event.preventDefault();\n        show();\n      } else if (key === 'Home' || key === 'End') {\n        event.preventDefault();\n        show();\n        activeIndex = key === 'Home' ? 0 : LAST;",
      },
    ],
    check: { test: 'tests/question-combobox.dom.test.ts', name: 'K2 opens on ArrowUp' },
  },
  {
    label: 'I09 fresh prefix searches after the active option',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: '    const first = scan(prefix, 0);',
        new: '    const first = scan(prefix, after);',
      },
    ],
    check: {
      test: 'tests/question-combobox.dom.test.ts',
      name: 'K5 opens a fresh prefix at the first match',
    },
  },
  {
    label: 'I23 typeahead window shortened to 1 ms',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: 'const TYPEAHEAD_MS = 500;',
        new: 'const TYPEAHEAD_MS = 1;',
      },
    ],
    check: { test: 'tests/question-combobox.dom.test.ts', name: 'K5 holds the prefix buffer' },
  },
  {
    label: 'I23 typeahead window stretched to 599 ms',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: 'const TYPEAHEAD_MS = 500;',
        new: 'const TYPEAHEAD_MS = 599;',
      },
    ],
    check: { test: 'tests/question-combobox.dom.test.ts', name: 'K5 holds the prefix buffer' },
  },
  {
    label: 'I03 question-literal scan removed from the gate',
    edits: [
      {
        path: 'tools/kb/check.mjs',
        old: "for (const root of QUESTION_ROOTS) {\n  for (const path of walk(join(ROOT, root))) {\n    const source = readFileSync(path, 'latin1');\n    for (const question of questions) {\n      if (source.includes(question)) fail(`catalog question text in ${relative(ROOT, path)}`);\n    }\n  }\n}\n",
        new: '',
      },
    ],
    check: { test: 'tests/kb-reach.test.ts', name: 'copied question sentence' },
  },
  {
    label: 'R35 reset reports ready without verifying the replacement',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: '    if (\n      contract.schemaVersion !== expected.schemaVersion ||\n      contract.documents !== expected.documents\n    ) {',
        new: '    if (false) {',
      },
    ],
    check: { test: 'tests/engine-recovery.test.ts', name: 'REPLACEMENT engine' },
  },
  {
    label: 'R35 readOutcome tests depth before inference',
    edits: [
      {
        path: 'src/engine/budget.ts',
        old: "  const inference = bindings.BudgetInference_;\n  if (inference?.kind === 'atom' && inference.value === 'inference_limit_exceeded') {\n    return { kind: 'limit', limit: 'inference' };\n  }\n  const depth = bindings.BudgetDepth_;\n  if (depth?.kind === 'atom' && depth.value === 'depth_limit_exceeded') {\n    return { kind: 'limit', limit: 'depth' };\n  }\n",
        new: "  const depth = bindings.BudgetDepth_;\n  if (depth?.kind === 'atom' && depth.value === 'depth_limit_exceeded') {\n    return { kind: 'limit', limit: 'depth' };\n  }\n  const inference = bindings.BudgetInference_;\n  if (inference?.kind === 'atom' && inference.value === 'inference_limit_exceeded') {\n    return { kind: 'limit', limit: 'inference' };\n  }\n",
      },
    ],
    check: { test: 'tests/engine-recovery.test.ts', name: 'outer inference limit' },
  },
  {
    label: 'R35 main-thread module imports swipl-wasm',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: 'export type PlInteger',
        new: "import 'swipl-wasm';\n\nexport type PlInteger",
      },
    ],
    check: ['node', 'tools/engine-check.mjs'],
  },
  {
    label: 'R35 an unpinned export escapes the decode trap battery',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: 'export class DecodeError',
        new: 'export function sneak(): void {}\n\nexport class DecodeError',
      },
    ],
    check: ['node', 'tools/engine-check.mjs'],
  },
  {
    label: 'U7-26 a font pin loosened to a range',
    edits: [
      {
        path: 'package.json',
        old: '"@fontsource-variable/literata": "5.3.0"',
        new: '"@fontsource-variable/literata": "^5.3.0"',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 a face loses font-display swap',
    edits: [
      {
        path: 'src/app.css',
        old: "  font-display: swap;\n  src: url('@fontsource-variable/literata/files/literata-latin-wght-normal.woff2')",
        new: "  src: url('@fontsource-variable/literata/files/literata-latin-wght-normal.woff2')",
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 a face fetches its font from a CDN',
    edits: [
      {
        path: 'src/app.css',
        old: "url('@fontsource-variable/literata/files/literata-latin-wght-normal.woff2')",
        new: "url('https://fonts.gstatic.com/s/literata/literata-latin.woff2')",
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 a face ships a subset outside latin',
    edits: [
      {
        path: 'src/app.css',
        old: 'literata-latin-ext-wght-normal.woff2',
        new: 'literata-cyrillic-wght-normal.woff2',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 a face names a file the package does not contain',
    edits: [
      {
        path: 'src/app.css',
        old: 'literata-latin-ext-wght-normal.woff2',
        new: 'literata-latin-ext-wght-bold.woff2',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: "U7-26 a family carries the package's Variable suffix",
    edits: [
      {
        path: 'src/app.css',
        old: "font-family: 'Atkinson Hyperlegible Mono';\n  font-style: normal;\n  font-weight: 200 800;\n  font-display: swap;\n  src: url('@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2')",
        new: "font-family: 'Atkinson Hyperlegible Mono Variable';\n  font-style: normal;\n  font-weight: 200 800;\n  font-display: swap;\n  src: url('@fontsource-variable/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-wght-normal.woff2')",
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 two faces resolve to one file, leaving latin-ext unshipped',
    edits: [
      {
        path: 'src/app.css',
        old: 'atkinson-hyperlegible-mono-latin-ext-wght-normal.woff2',
        new: 'atkinson-hyperlegible-mono-latin-wght-normal.woff2',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-26 a shipped OFL drifts from the package it came from',
    edits: [
      {
        path: 'public/licenses/literata.txt',
        old: 'literata) Literata-Italic',
        new: 'literata) Literata-Oblique',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-20 the combobox field loses overflow containment',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: '    overflow-wrap: anywhere;\n    cursor: pointer;\n  }\n\n  .box:focus-visible',
        new: '    cursor: pointer;\n  }\n\n  .box:focus-visible',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'U7-20 a live status surface loses overflow containment',
    edits: [
      {
        path: 'src/demo/RunControls.svelte',
        old: '    line-height: 1.45;\n    overflow-wrap: anywhere;\n  }\n\n  .status {',
        new: '    line-height: 1.45;\n  }\n\n  .status {',
      },
    ],
    check: ['node', 'tools/presentation-check.mjs'],
  },
  {
    label: 'C3 a failed page draw keeps Load page viewer disabled',
    edits: [
      {
        path: 'src/provenance/PageViewer.svelte',
        old: "    disabled={open && viewer.kind !== 'failed'}",
        new: '    disabled={open}',
      },
    ],
    check: {
      test: 'tests/page-viewer.dom.test.ts',
      name: 'a failed draw re-enables Load page viewer',
    },
  },
  {
    label: 'copy-quotes copy:check reads single-quoted English literals alone',
    edits: [
      {
        path: 'tools/copy-check.mjs',
        old: '    /(?:^|\\n)\\s*(?:\\/\\*\\*[\\s\\S]*?\\*\\/\\s*)?([\\w]+):\\s*((?:(?:\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")(?:\\s*\\+)?\\s*)+)/g;',
        new: "    /(?:^|\\n)\\s*(?:\\/\\*\\*[\\s\\S]*?\\*\\/\\s*)?([\\w]+):\\s*((?:'(?:[^'\\\\]|\\\\.)*'(?:\\s*\\+)?\\s*)+)/g;",
      },
      {
        path: 'tools/copy-check.mjs',
        old: "    const text = [...group.matchAll(/'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\"/g)]\n      .map(([, single, double]) => single ?? double ?? '')\n      .join('');",
        new: "    const text = [...group.matchAll(/'((?:[^'\\\\]|\\\\.)*)'/g)].map(([, s]) => s ?? '').join('');",
      },
      {
        path: 'tools/copy-check.mjs',
        old: "  for (const [, quoted, double] of rest.matchAll(\n    /(?:^|[^\\w'\"])(?:(?:'|`)((?:[^'`\\\\\\n]|\\\\.){12,})(?:'|`)|\"((?:[^\"\\\\\\n]|\\\\.){12,})\")/g,\n  )) {\n    const text = quoted ?? double;\n    if (text !== undefined) out.push({ key: '<literal>', text });\n  }",
        new: "  for (const [, text] of rest.matchAll(/(?:^|[^\\w'])(?:'|`)((?:[^'`\\\\\\n]|\\\\.){12,})(?:'|`)/g)) {\n    if (text !== undefined) out.push({ key: '<literal>', text });\n  }",
      },
    ],
    check: ['node', 'tools/copy-check.mjs'],
  },
  {
    label: 'copy-quotes the Japanese register reads single-quoted bodies alone',
    edits: [
      {
        path: 'tools/copy-check.mjs',
        old: "const stringBodies = (slice) =>\n  [...slice.matchAll(/'((?:[^'\\\\]|\\\\.)*)'|\"((?:[^\"\\\\]|\\\\.)*)\"|`((?:[^`\\\\]|\\\\.)*)`/g)].map(\n    ([, quoted, double, template]) => quoted ?? double ?? template ?? '',\n  );",
        new: "const stringBodies = (slice) =>\n  [...slice.matchAll(/'((?:[^'\\\\]|\\\\.)*)'|`((?:[^`\\\\]|\\\\.)*)`/g)].map(\n    ([, quoted, template]) => quoted ?? template ?? '',\n  );",
      },
    ],
    check: ['node', 'tools/copy-check.mjs'],
  },
  {
    label: 'inv format:check: a source line the formatter would rewrite',
    edits: [
      {
        path: 'src/main.ts',
        old: "const target = document.getElementById('app');",
        new: 'const target = document.getElementById( "app" );',
      },
    ],
    check: ['pnpm', 'exec', 'prettier', '--check', '.'],
  },
  {
    label: 'inv lint: a component renders catalog text through an {@html} sink',
    edits: [
      {
        path: 'src/demo/AboutPanel.svelte',
        old: '<p>{t.DESCRIPTIONS.purpose}</p>',
        new: '<p>{@html t.DESCRIPTIONS.purpose}</p>',
      },
    ],
    check: ['pnpm', 'lint'],
  },
  {
    label: 'inv check: the app mounts on a number instead of its target element',
    edits: [
      {
        path: 'src/main.ts',
        old: 'export default mount(App, { target });',
        new: 'export default mount(App, { target: 1 });',
      },
    ],
    check: ['pnpm', 'check'],
  },
  {
    label: 'inv test:browser: the typeahead window shortened to 100 ms',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: 'const TYPEAHEAD_MS = 500;',
        new: 'const TYPEAHEAD_MS = 100;',
      },
    ],
    check: ['pnpm', 'test:browser', 'tests/question-combobox.browser.test.ts'],
  },
  {
    label: 'inv kb-release: the vendored-tree grader passes a changed byte',
    edits: [
      {
        path: 'tools/kb/release.mjs',
        old: 'else if (gitBlobSha(bytes) !== sha) out.push(',
        new: 'else if (gitBlobSha(bytes) !== sha && false) out.push(',
      },
    ],
    check: { test: 'tests/kb-release.test.ts', name: 'R2 the vendored upstream tree equals' },
  },
  {
    label: 'inv proof-identity: a provenance chunk keys a clause by the wrong line',
    edits: [
      {
        path: 'kb/generated/provenance/documents/cdc2022-opioid-rec01-imp01.json',
        old: '"line": 48,',
        new: '"line": 47,',
      },
    ],
    check: { test: 'tests/proof-identity.test.ts', name: 'keys every schema clause by a unique' },
  },
  {
    label:
      'inv chat-server-fake: the fake refuses a missing outputSchema without naming the contract',
    edits: [
      {
        path: 'tests/support/fake-codex.mjs',
        old: "      assert('outputSchema' in params, 'turn/start must carry the contract outputSchema');",
        new: "      assert('outputSchema' in params);",
      },
    ],
    check: { test: 'tests/chat-server-fake.test.ts', name: 'B1 B2 fake control' },
  },

  {
    label: 'inv chat-engine: model goal drops readonly option',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: 'client.query(goal, budget, signal, undefined, { readonly: true })',
        new: 'client.query(goal, budget, signal)',
      },
    ],
    check: { test: 'tests/chat-engine.test.ts', name: 'D7 createDemoEngine' },
  },
  {
    label: 'inv clinical-differential: premise ordinals start at one',
    edits: [
      {
        path: 'tools/kb/clinical.mjs',
        old: '`clinical_premise(${key},${String(ordinal)},(${groundTerm(goal, variables, skolem)})).`,',
        new: '`clinical_premise(${key},${String(ordinal + 1)},(${groundTerm(goal, variables, skolem)})).`,',
      },
    ],
    check: { test: 'tests/clinical-differential.test.ts', name: 'D2: preserves premise order' },
  },
  {
    label: 'inv corpus-browser.dom: section omitted from filter',
    edits: [
      {
        path: 'src/provenance/CorpusBrowser.svelte',
        old: '[row.id, row.region.id, row.region.section].some((field) =>',
        new: '[row.id, row.region.id].some((field) =>',
      },
    ],
    check: {
      test: 'tests/corpus-browser.dom.test.ts',
      name: 'filters by document, region or section',
    },
  },
  {
    label: 'inv demo-abort.dom: settled run cannot start again',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: "    const live = this.state.kind !== 'booting' && this.state.kind !== 'boot-error';",
        new: "    const live = this.state.kind === 'idle';",
      },
    ],
    check: { test: 'tests/demo-abort.dom.test.ts', name: 'A7 shows the heap limit' },
  },
  {
    label: 'inv demo-lifecycle: settled result leaves run active',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: "      this.state = { kind: 'settled', id, result };",
        new: "      this.state = { kind: 'running', id };",
      },
    ],
    check: { test: 'tests/demo-lifecycle.test.ts', name: 'R3 enters running synchronously' },
  },
  {
    label: 'inv demo-proof-controller: stale proof completion overwrites selection',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: '    if (this.#disposed || controller.signal.aborted || token !== this.#proofToken) return;',
        new: '    if (this.#disposed) return;',
      },
    ],
    check: {
      test: 'tests/demo-proof-controller.test.ts',
      name: 'aborts a prior selection and suppresses its stale completion',
    },
  },
  {
    label: 'inv boot-phases: unexpected progress ignored silently',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "          this.onProtocolViolation?.({\n            code: 'protocol',\n            message: `${response.kind} for ${response.id}, which reports none`,\n          });",
        new: '          void response;',
      },
    ],
    check: { test: 'tests/boot-phases.test.ts', name: 'progress for a request that reports none' },
  },
  {
    label: 'inv census: latin-ext face duplicates latin file',
    edits: [
      {
        path: 'src/app.css',
        old: 'literata-latin-ext-wght-normal.woff2',
        new: 'literata-latin-wght-normal.woff2',
      },
    ],
    check: {
      test: 'tests/census.test.ts',
      name: 'every figure the rules state equals its derivation',
    },
  },
  {
    label: 'inv palette-check: protan simulated with the identity matrix',
    edits: [
      {
        path: 'tools/palette-check.mjs',
        old: '    [0.152286, 1.052583, -0.204868],\n    [0.114503, 0.786281, 0.099216],\n    [-0.003882, -0.048116, 1.051998],',
        new: '    [1, 0, 0],\n    [0, 1, 0],\n    [0, 0, 1],',
      },
    ],
    check: { test: 'tests/palette-check.test.ts', name: 'P1 matches coloraide' },
  },
  {
    label: 'inv chat-client: malformed event line skipped',
    edits: [
      {
        path: 'src/chat/client.ts',
        old: "          if (event === undefined) return 'protocol';",
        new: '          if (event === undefined) continue;',
      },
    ],
    check: { test: 'tests/chat-client.test.ts', name: 'D8 malformed event line fails protocol' },
  },
  {
    label: 'inv chat-controller: malformed answer earns model label',
    edits: [
      {
        path: 'src/chat/ChatController.svelte.ts',
        old: "? [{ text: answer, source: 'model', queries: [], urls: [], label: 'unverified' }]",
        new: "? [{ text: answer, source: 'model', queries: [], urls: [], label: 'model' }]",
      },
    ],
    check: {
      test: 'tests/chat-controller.test.ts',
      name: 'D5 malformed final answer is exactly one raw unverified segment',
    },
  },
  {
    label: 'inv chat-events: answer missing text admitted',
    edits: [
      {
        path: 'src/chat/events.ts',
        old: 'return isText(value.text) ? { type: value.type, text: value.text } : undefined;',
        new: 'return isText(value.text) || value.text === undefined ? { type: value.type, text: value.text } : undefined;',
      },
    ],
    check: {
      test: 'tests/chat-events.test.ts',
      name: 'D1 rejects every missing required field and every non-string replacement',
    },
  },
  {
    label: 'inv chat-binding: query card drops engine outcome',
    edits: [
      {
        path: 'src/chat/ChatController.svelte.ts',
        old: '      card(call, { call, goal, outcome, result });',
        new: '      card(call, { call, goal, result });',
      },
    ],
    check: {
      test: 'tests/chat-binding.test.ts',
      name: 'D4 real controller cards and posted result change',
    },
  },
  {
    label: 'inv chat-panel.dom: source links accept every scheme',
    edits: [
      {
        path: 'src/chat/ChatPanel.svelte',
        old: "      return protocol === 'https:' || protocol === 'http:' ? url : '';",
        new: '      return url;',
      },
    ],
    check: {
      test: 'tests/chat-panel.dom.test.ts',
      name: 'V2 a search result URL that is not http',
    },
  },
  {
    label: 'inv chat-provenance: extra segment fields admitted',
    edits: [
      {
        path: 'src/chat/provenance.ts',
        old: '  return own.length === keys.length && keys.every((key) => own.includes(key));',
        new: '  return keys.every((key) => own.includes(key));',
      },
    ],
    check: {
      test: 'tests/chat-provenance.test.ts',
      name: 'D3 parseAnswer rejects every missing, mistyped or extra segment field',
    },
  },
  {
    label: 'inv chat-queue.dom: model goal runs before boot',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: '    if (run === undefined || !booted || this.#disposed) return undefined;',
        new: '    if (run === undefined || this.#disposed) return undefined;',
      },
    ],
    check: { test: 'tests/chat-queue.dom.test.ts', name: 'D7 no ready engine yields undefined' },
  },
  {
    label: 'inv chat-result: refused goal reported as executed',
    edits: [
      {
        path: 'src/chat/result.ts',
        old: '      return { ok: false, text: text.slice(0, TOOL_RESULT_MAX), shown: 0, total: 0 };',
        new: '      return { ok: true, text: text.slice(0, TOOL_RESULT_MAX), shown: 0, total: 0 };',
      },
    ],
    check: {
      test: 'tests/chat-result.test.ts',
      name: 'D2 real guard refusal returns the engine message',
    },
  },
  {
    label: 'inv clinical-answer-live: partial document answer admitted',
    edits: [
      {
        path: 'tools/kb/proof.mjs',
        old: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\n',
        new: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\nclinical_derived([_|Ss],Doc,T) :- clinical_derived(Ss,Doc,T).\n',
      },
    ],
    check: {
      test: 'tests/clinical-answer-live.test.ts',
      name: 'A6 withholding one document premises',
    },
  },
  {
    label: 'inv clinical-binding: erased clause leaves partial answer',
    edits: [
      {
        path: 'tools/kb/proof.mjs',
        old: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\n',
        new: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\nclinical_derived([_|Ss],Doc,T) :- clinical_derived(Ss,Doc,T).\n',
      },
    ],
    check: { test: 'tests/clinical-binding.test.ts', name: 'E2 erasing one cited clause' },
  },
  {
    label: 'inv clinical-gate-live: emitted gate lines offset by one',
    edits: [
      {
        path: 'tools/kb/clinical.mjs',
        old: "grounded.map(({ line }) => String(line)).join(',')",
        new: "grounded.map(({ line }) => String(line + 1)).join(',')",
      },
    ],
    check: { test: 'tests/clinical-gate-live.test.ts', name: 'T15 exact-site refutation' },
  },
  {
    label: 'inv clinical-proof-live: erased clause retains partial proof',
    edits: [
      {
        path: 'tools/kb/proof.mjs',
        old: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\n',
        new: 'clinical_derive(Doc,S,Rule,P), !, clinical_derived(Ss,Doc,T).\nclinical_derived([_|Ss],Doc,T) :- clinical_derived(Ss,Doc,T).\n',
      },
    ],
    check: { test: 'tests/clinical-proof-live.test.ts', name: 'B5 erasing a cited clause line' },
  },
  {
    label: 'inv clinical-records: multiple antecedents admitted',
    edits: [
      {
        path: 'tools/kb/clinical.mjs',
        old: '        if (bodies.length !== 1) {',
        new: '        if (bodies.length === 0) {',
      },
    ],
    check: { test: 'tests/clinical-records.test.ts', name: 'T5 one antecedent per sentence' },
  },
  {
    label: 'inv corpus-index: unsupported schema admitted',
    edits: [
      {
        path: 'src/provenance/model.ts',
        old: "  if (root.schemaVersion !== 1) throw new Error('corpus index has an unsupported schema');",
        new: "  if (root.schemaVersion === 0) throw new Error('corpus index has an unsupported schema');",
      },
    ],
    check: {
      test: 'tests/corpus-index.test.ts',
      name: 'refuses a malformed row rather than listing it',
    },
  },
  {
    label: 'inv engine-readonly-client: drops requested readonly flag',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "        ? { kind: 'query', goal, budget: spec, readonly: true }",
        new: "        ? { kind: 'query', goal, budget: spec }",
      },
    ],
    check: {
      test: 'tests/engine-readonly-client.test.ts',
      name: 'G8 posts readonly true only when explicitly selected',
    },
  },
  {
    label: 'inv graph-live: neighborhood depth cutoff off by one',
    edits: [
      {
        path: 'src/graph/model.ts',
        old: '      if (current === undefined || current.depth >= depth) continue;\n      const candidates = this.incident(current.id)',
        new: '      if (current === undefined || current.depth + 1 >= depth) continue;\n      const candidates = this.incident(current.id)',
      },
    ],
    check: {
      test: 'tests/graph-live.test.ts',
      name: 'opens a bounded, connected document neighborhood',
    },
  },
  {
    label: 'inv engine-abort-live: heap trap loses heap classification',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "      this.#aborted = lines.some((line) => OUT_OF_MEMORY.test(line)) ? 'heap' : 'aborted';",
        new: "      this.#aborted = 'aborted';",
      },
    ],
    check: { test: 'tests/engine-abort-live.test.ts', name: 'A2 reports heap limit' },
  },
  {
    label: 'inv engine-abort-session: later requests reuse aborted runtime',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: '  #require(): Engine {\n    if (this.#aborted !== undefined) throw new RuntimeAborted(ABORTED);',
        new: '  #require(): Engine {',
      },
    ],
    check: {
      test: 'tests/engine-abort-session.test.ts',
      name: 'A4 preserves the aborted invariant',
    },
  },
  {
    label: 'inv engine-fallback: fallback document count unchecked',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: '      contract.schemaVersion !== expected.schemaVersion ||\n      contract.documents !== expected.documents',
        new: '      contract.schemaVersion !== expected.schemaVersion',
      },
    ],
    check: { test: 'tests/engine-fallback.test.ts', name: 'F5 fallback documents mismatch' },
  },
  {
    label: 'inv engine-heap: allocator trap becomes generic abort',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "      this.#aborted = lines.some((line) => OUT_OF_MEMORY.test(line)) ? 'heap' : 'aborted';",
        new: "      this.#aborted = 'aborted';",
      },
    ],
    check: { test: 'tests/engine-heap.test.ts', name: 'A1 returns heap limit' },
  },
  {
    label: 'inv engine-readonly-budget: atom builder joins builtin allowlist',
    edits: [
      {
        path: 'src/engine/readonly.ts',
        old: "const BUILTINS = new Set([\n  '=/2',",
        new: "const BUILTINS = new Set([\n  'atom_concat/3',\n  '=/2',",
      },
    ],
    check: { test: 'tests/engine-readonly-budget.test.ts', name: 'G1 refuses 32 atom doublings' },
  },
  {
    label: 'inv engine-readonly-guard: disjunction needs only one KB branch',
    edits: [
      {
        path: 'src/engine/readonly.ts',
        old: '      return (guarded ? reads(first) : branch(first)) && branch(second);',
        new: '      return (guarded ? reads(first) : branch(first)) || branch(second);',
      },
    ],
    check: {
      test: 'tests/engine-readonly-guard.test.ts',
      name: 'G10 requires a KB read on every way',
    },
  },
  {
    label: 'inv engine-readonly-session: accepts truthy readonly flags',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "  if (flag !== true) throw new GuardRefusal('the readonly flag must be true when present');",
        new: "  if (!flag) throw new GuardRefusal('the readonly flag must be true when present');",
      },
    ],
    check: {
      test: 'tests/engine-readonly-session.test.ts',
      name: 'G7 rejects malformed posted readonly',
    },
  },
  {
    label: 'inv engine-runtime-facts: integers reencode as atoms',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "      case 'atom':\n      case 'integer':\n      case 'float':\n        return term.value;",
        new: "      case 'integer':\n        return String(term.value);\n      case 'atom':\n      case 'float':\n        return term.value;",
      },
    ],
    check: {
      test: 'tests/engine-runtime-facts.test.ts',
      name: 'corrupts a guideline id round-tripped through JSON',
    },
  },
  {
    label: 'inv engine-u2-port: unmatched response is silently dropped',
    edits: [
      {
        path: 'src/engine/client.ts',
        old: "        this.onProtocolViolation?.({\n          code: 'protocol',\n          message: `response ${response.id} matched no pending request`,\n        });\n        return;",
        new: '        return;',
      },
    ],
    check: { test: 'tests/engine-u2-port.test.ts', name: 'P2.2 reports an unmatched response id' },
  },
  {
    label: 'inv engine-u3-port: maximum budget is excluded',
    edits: [
      {
        path: 'src/engine/budget.ts',
        old: '    if (value > BUDGET_MAX[field]) {',
        new: '    if (value >= BUDGET_MAX[field]) {',
      },
    ],
    check: { test: 'tests/engine-u3-port.test.ts', name: 'P1.2 — zero' },
  },
  {
    label: 'inv graph-condition-merges: kept scope replaced by folded scope',
    edits: [
      {
        path: 'tools/kb/graph.mjs',
        old: '              keptWorld: conditionWorlds.get(key) ?? -1,',
        new: '              keptWorld: world(clause, call),',
      },
    ],
    check: { test: 'tests/graph-condition-merges.test.ts', name: 'records 28 negated folds' },
  },
  {
    label: 'inv graph-annotations: threshold scope taken from the comparison goal',
    edits: [
      {
        path: 'tools/kb/graph.mjs',
        old: "            'condition bound of',\n            card.call,",
        new: "            'condition bound of',\n            call,",
      },
    ],
    check: { test: 'tests/graph-annotations.test.ts', name: 'A4 holds every threshold' },
  },
  {
    label: 'inv graph-model: scope terminal reference unchecked',
    edits: [
      {
        path: 'src/graph/model.ts',
        old: '    if (scope.chain.at(-1) !== scope.reference) {\n      throw new GraphDataError(`scopes[${String(index)}].chain must end with its reference`);\n    }\n',
        new: '',
      },
    ],
    check: {
      test: 'tests/graph-model.test.ts',
      name: 'rejects scope chain with the wrong terminal reference by field',
    },
  },
  {
    label: 'inv graph-scope: empty scope table accepted',
    edits: [
      {
        path: 'tools/kb/graph.mjs',
        old: "    return ['scopes table is empty, so graph scope validation grades no record'];",
        new: '    return [];',
      },
    ],
    check: { test: 'tests/graph-scope.test.ts', name: 'validates the emitted scope shape' },
  },
  {
    label: 'inv graph-semantics.review: argument source role unchecked',
    edits: [
      {
        path: 'src/graph/model.ts',
        old: "  argument: ['event'],\n  preposition: ['event'],",
        new: "  preposition: ['event'],",
      },
    ],
    check: { test: 'tests/graph-semantics.review.test.ts', name: 'rejects an argument edge' },
  },
  {
    label: 'inv graph-shortcut-justification: far scope copied from near end',
    edits: [
      {
        path: 'src/graph/model.ts',
        old: '        farScopeOperators: targetScope,',
        new: '        farScopeOperators: nearScope,',
      },
    ],
    check: {
      test: 'tests/graph-shortcut-justification.test.ts',
      name: 'records the 67 shortcuts whose endpoint scopes contradict',
    },
  },
  {
    label: 'inv i18n.dom: document language stays English',
    edits: [
      {
        path: 'src/i18n/locale.svelte.ts',
        old: '  document.documentElement.lang = next;',
        new: "  document.documentElement.lang = 'en';",
      },
    ],
    check: {
      test: 'tests/i18n.dom.test.ts',
      name: 'switches the interface, the lang attribute and the document title',
    },
  },
  {
    label: 'inv m1u5-port.dom: active option scroll aligns at start',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: "    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });",
        new: "    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'start' });",
      },
    ],
    check: {
      test: 'tests/m1u5-port.dom.test.ts',
      name: 'B1 every active-option change scrolls that option with nearest block alignment',
    },
  },
  {
    label: 'inv m1u7-port.dom: first font licence link omitted',
    edits: [
      {
        path: 'src/demo/AboutPanel.svelte',
        old: '    {#each FONT_LICENCES as licence (licence.href)}',
        new: '    {#each FONT_LICENCES.slice(1) as licence (licence.href)}',
      },
    ],
    check: {
      test: 'tests/m1u7-port.dom.test.ts',
      name: 'A7 links every contracted font licence from the disclosure',
    },
  },
  {
    label: 'inv provenance-ladder.dom: graph focus drops proof lines',
    edits: [
      {
        path: 'src/provenance/ProvenanceLadder.svelte',
        old: '            ...(proofSourceLines.length === 0 ? {} : { lines: proofSourceLines }),\n',
        new: '',
      },
    ],
    check: {
      test: 'tests/provenance-ladder.dom.test.ts',
      name: 'links the proof to the graph and pairs keyboard-selected alignment spans',
    },
  },
  {
    label: 'inv question-combobox.browser: active descendant never exposed',
    edits: [
      {
        path: 'src/questions/QuestionCombobox.svelte',
        old: '      aria-activedescendant={open ? optionId(activeIndex) : undefined}',
        new: '      aria-activedescendant={undefined}',
      },
    ],
    check: ['pnpm', 'test:browser', 'tests/question-combobox.browser.test.ts'],
  },
  {
    label: 'inv trace-failure.dom: failed proof shown as unavailable',
    edits: [
      {
        path: 'src/provenance/ProvenanceLadder.svelte',
        old: "      case 'failure':\n        return TEXT.traceFailure();",
        new: "      case 'failure':\n        return TEXT.traceUnavailable();",
      },
    ],
    check: {
      test: 'tests/trace-failure.dom.test.ts',
      name: 'renders TEXT.traceFailure when the proof request fails, in both locales',
    },
  },
  {
    label: 'inv kb-live: reported document count off by one',
    edits: [
      {
        path: 'tools/kb/produce.mjs',
        old: "    documents: Number(documents['N']),",
        new: "    documents: Number(documents['N']) + 1,",
      },
    ],
    check: { test: 'tests/kb-live.test.ts', name: 'loads the saved state into a live engine' },
  },
  {
    label: 'inv licences: package name substitutes for licence text',
    edits: [
      {
        path: 'tools/licences.mjs',
        old: '    .filter((notice) => !text.includes(section(notice)))',
        new: '    .filter((notice) => !text.includes(notice.name))',
      },
    ],
    check: {
      test: 'tests/licences.test.ts',
      name: 'carries each package licence file verbatim and refuses one it omits',
    },
  },
  {
    label: 'inv m1u7-port: a non-role root token planted',
    edits: [
      {
        path: 'src/app.css',
        old: '  --surface: #f5f7f9;',
        new: '  --surface: #f5f7f9;\n  --zz-unrolled: #000;',
      },
    ],
    check: { test: 'tests/m1u7-port.test.ts', name: 'T1 defines only role-named root tokens' },
  },
  {
    label: 'inv mutant-anchors: exported-query mutant retains a stale anchor',
    edits: [
      {
        path: 'tools/mutants.mjs',
        old: "        old: '  if (unexpected.length > 0 || missing.length > 0) {',\n",
        new: "        old: '  if (unexpected.length > 0 || missing.length > 0) { /* retired anchor */',\n",
      },
    ],
    check: {
      test: 'tests/mutant-anchors.test.ts',
      name: 'finds every mutant anchor exactly once in the tree',
    },
  },
  {
    label: 'inv proof-live: inference exhaustion reported as depth',
    edits: [
      {
        path: 'src/engine/budget.ts',
        old: "    return { kind: 'limit', limit: 'inference' };",
        new: "    return { kind: 'limit', limit: 'depth' };",
      },
    ],
    check: {
      test: 'tests/proof-live.test.ts',
      name: 'surfaces a proof budget trip as a typed limit',
    },
  },
  {
    label: 'inv provenance-model: overlapping spans are accepted',
    edits: [
      {
        path: 'src/provenance/model.ts',
        old: '    if (span.start < cursor || span.end > points.length)',
        new: '    if (span.end > points.length)',
      },
    ],
    check: {
      test: 'tests/provenance-model.test.ts',
      name: 'rejects overlapping, out-of-bounds, and text-mismatched spans',
    },
  },
  {
    label: 'inv question-link.dom: unknown id falls back to first question',
    edits: [
      {
        path: 'src/questions/link.ts',
        old: '  return QUESTION_IDS.find((known) => known === id) ?? null;',
        new: '  return QUESTION_IDS.find((known) => known === id) ?? QUESTION_IDS[0];',
      },
    ],
    check: {
      test: 'tests/question-link.dom.test.ts',
      name: 'ignores an id outside the catalog and strips it without a history entry',
    },
  },
  {
    label: 'inv questions-u4-port: service accepts case-folded ids',
    edits: [
      {
        path: 'src/questions/service.ts',
        old: "    if (!isQuestionId(id)) return { kind: 'rejected', reason: 'unknown-id' };\n    const entry = QUESTION_CATALOG[id];",
        new: "    if (typeof id === 'string') id = id.toLowerCase();\n    if (!isQuestionId(id)) return { kind: 'rejected', reason: 'unknown-id' };\n    const entry = QUESTION_CATALOG[id];",
      },
    ],
    check: {
      test: 'tests/questions-u4-port.test.ts',
      name: 't.case P1.1/P1.3 rejects case folds and punctuation variants',
    },
  },
  {
    label: 'inv semantic-graph.dom: client HTTP errors pass response guard',
    edits: [
      {
        path: 'src/graph/SemanticGraph.svelte',
        old: '      if (!response.ok) throw new Error(`graph asset returned HTTP ${String(response.status)}`);',
        new: '      if (response.status >= 500) throw new Error(`graph asset returned HTTP ${String(response.status)}`);',
      },
    ],
    check: {
      test: 'tests/semantic-graph.dom.test.ts',
      name: 'reports a failed asset request and retries from an explicit control',
    },
  },
  {
    label: 'inv solution-streaming.dom: latest answer replaces earlier answers',
    edits: [
      {
        path: 'src/demo/DemoController.svelte.ts',
        old: '      this.state = { ...state, solutions: [...(state.solutions ?? []), solution] };',
        new: '      this.state = { ...state, solutions: [solution] };',
      },
    ],
    check: {
      test: 'tests/solution-streaming.dom.test.ts',
      name: 'shows each streamed answer while the run is busy, then the settled answer',
    },
  },
  {
    label: 'inv validate-report: unknown no longer marks a placeholder',
    edits: [
      {
        path: 'tools/validate-report.mjs',
        old: "const PLACEHOLDER = new Set(['unknown', 'todo', 'tbd', 'n/a', 'na', '-', '?', '']);",
        new: "const PLACEHOLDER = new Set(['todo', 'tbd', 'n/a', 'na', '-', '?', '']);",
      },
    ],
    check: { test: 'tests/validate-report.test.ts', name: 'refuses a seeded all-unknown skeleton' },
  },
  {
    label: 'inv smoke: package licence omits LLVM exception',
    edits: [
      {
        path: 'package.json',
        old: '  "license": "Apache-2.0 WITH LLVM-exception",',
        new: '  "license": "Apache-2.0",',
      },
    ],
    check: {
      test: 'tests/smoke.test.ts',
      name: 'carries the project name and the LICENSE identifier',
    },
  },
  {
    label: "inv inventory: the inventory drops the validate-report suite's row",
    edits: [
      {
        path: '.agent/contracts/mnt5-inventory.md',
        old: '| `tests/validate-report.test.ts` | off | report grader counts unknown placeholders as filled findings | mutate | `inv validate-report: unknown no longer marks a placeholder` |\n',
        new: '',
      },
    ],
    check: { test: 'tests/inventory.test.ts', name: 'lists every suite, gate step and lane' },
  },
  {
    label: "inv toolchain-pins: the TypeScript pin reads another package's manifest",
    edits: [
      {
        path: 'tests/toolchain-pins.test.ts',
        old: "expect(capFailures(manifest('typescript-eslint'), manifest('typescript'))).toEqual([]);",
        new: "expect(capFailures(manifest('typescript-eslint'), manifest('eslint'))).toEqual([]);",
      },
    ],
    check: { test: 'tests/toolchain-pins.test.ts', name: 'caps TypeScript below 6.1' },
  },
  {
    label: 'spec-check-suite a ticked row passes without its SHA',
    edits: [
      {
        path: 'tools/spec-check.mjs',
        old: 'else if (!/^- \\[x\\] [0-9a-f]{7,40} /u.test(item)) {',
        new: 'else if (!/^- \\[x\\] /u.test(item)) {',
      },
    ],
    check: { test: 'tests/spec-check.test.ts', name: 'its SHA control on a planted row' },
  },
  {
    label: 'spec-check-suite an open unit passes as a plain bullet',
    edits: [
      {
        path: 'tools/spec-check.mjs',
        old: "if (item.startsWith('- [ ] ')) continue;",
        new: "if (!item.startsWith('- [x] ')) continue;",
      },
    ],
    check: { test: 'tests/spec-check.test.ts', name: 'its open-unit controls on a planted row' },
  },
  {
    label: "inv axe-contrast.browser: the probe's pair made readable",
    edits: [
      {
        path: 'tests/support/axe-contrast.ts',
        old: '\'<p style="color:#777;background:#787878">nearly invisible text</p>\'',
        new: '\'<p style="color:#000;background:#fff">plainly readable text</p>\'',
      },
    ],
    check: ['pnpm', 'test:browser', 'tests/axe-contrast.browser.test.ts'],
  },
  {
    label: "m10 a compound named $t is handed to the wrapper's encoder",
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "        // The wrapper's `toProlog` reads `$t` as the type tag, which this name's arguments\n        // overwrite. Refused, as a dict is.\n        if (term.functor === '$t') {\n          throw new DecodeError('a compound named $t cannot re-enter the engine');\n        }\n",
        new: '',
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'refuses its re-entry by name' },
  },
  {
    label: 'm4 a compound named functor fails to decode',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "  // A compound NAMED `functor` writes its arguments over the name it was just given. A dict\n  // spelling the same keys is no wrapper compound, so it stays out and fails closed below.\n  if (value.$t === 't' && Array.isArray(value.functor) && wrapperCompound(value)) {\n    return compound('functor', value.functor);\n  }\n",
        new: '',
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'compound named functor' },
  },
  {
    label: 'm18 close leaves a retired child running',
    edits: [
      {
        path: 'server/chat.mjs',
        old: '    this.#onExit(child);\n    this.#dismiss(child);\n  }',
        new: '    this.#onExit(child);\n    void child.close();\n  }',
      },
    ],
    check: { test: 'tests/chat-server.test.ts', name: 'close awaits every child' },
  },
  {
    label: 'f1 a dict spelling a compound named functor takes its arm',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "if (value.$t === 't' && Array.isArray(value.functor) && wrapperCompound(value)) {",
        new: "if (value.$t === 't' && Array.isArray(value.functor)) {",
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'dict whose keys spell' },
  },
  {
    label: 'f1 a dict spelling a compound named $t takes its arm',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "if (Array.isArray(value.$t) && value.functor === '$t' && wrapperCompound(value)) {",
        new: "if (Array.isArray(value.$t) && value.functor === '$t') {",
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'dict whose keys spell' },
  },
  {
    label: 'f2 a second close skips the first close drain',
    edits: [
      {
        path: 'server/chat.mjs',
        old: '    this.#closing ??= this.#drain();\n    return this.#closing;',
        new: '    if (this.#closing) return Promise.resolve();\n    this.#closing = this.#drain();\n    return this.#closing;',
      },
    ],
    check: { test: 'tests/chat-server.test.ts', name: 'second close waits' },
  },
  {
    label: 'm21 a zero-arity compound re-enters as an atom',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: '        if (term.args.length === 0) {\n          throw new DecodeError(\n            `a zero-arity compound cannot re-enter the engine (${term.functor})`,\n          );\n        }\n',
        new: '',
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'zero-arity compound' },
  },
  {
    label: 'm15 claims:check reads the first line of each Artifacts bullet alone',
    edits: [
      {
        path: 'tools/claims-sweep.mjs',
        old: "  for (const unit of units(artifacts?.[1] ?? '')) {\n    if (unit.text.startsWith('- ')) {\n      rows.push({\n        source: 'spec',\n        at: '.agent/spec.md Artifacts',\n        hash: digest(unit.text),\n        claim: cell(unit.text),",
        new: "  for (const line of (artifacts?.[1] ?? '').split('\\n')) {\n    if (line.trim().startsWith('- ')) {\n      rows.push({\n        source: 'spec',\n        at: '.agent/spec.md Artifacts',\n        hash: digest(line.trim()),\n        claim: cell(line.trim()),",
      },
    ],
    check: ['node', 'tools/claims-sweep.mjs'],
  },
  {
    label: 'inv proof-comparison: the decoder reads a comparison as a negation',
    edits: [
      {
        path: 'src/engine/session.ts',
        old: "steps.push({ kind: 'comparison', goal: this.#display(engine, display(goal), late) });",
        new: "steps.push({ kind: 'negation', goal: this.#display(engine, display(goal), late) });",
      },
    ],
    check: { test: 'tests/proof-comparison.test.ts', name: 'K5' },
  },
  {
    label: 'm14 claims:check reads rules frontmatter as prose',
    edits: [{ path: 'tools/claims-sweep.mjs', old: '    if (index < body) return;\n', new: '' }],
    check: ['node', 'tools/claims-sweep.mjs'],
  },
  {
    label: 'n13 a dict spelling a compound with a string name takes the first arm',
    edits: [
      {
        path: 'src/engine/terms.ts',
        old: "if (value.$t === 't' && typeof value.functor === 'string' && wrapperCompound(value)) {",
        new: "if (value.$t === 't' && typeof value.functor === 'string') {",
      },
    ],
    check: { test: 'tests/engine-term-identity.test.ts', name: 'string name' },
  },
  {
    label: 'n17 the repeated-index control repeats a line the real queue lacks',
    edits: [
      {
        path: 'tools/claims-sweep.mjs',
        old: "  const indexed = rewriteIndex(queue.replace('\\n## Index — ', `\\n${plantedRow}\\n## Index — `));\n",
        new: '  const indexed = queue;\n',
      },
    ],
    check: ['node', 'tools/claims-sweep.mjs'],
  },
  {
    label: 'mv5 chromiumfish resolver scans one level',
    edits: [
      {
        path: 'tools/browser.mjs',
        old: '    for (const dir of [root, ...sets.map((set) => join(root, set))]) {',
        new: '    for (const dir of [root]) {',
      },
    ],
    check: { test: 'tests/chromiumfish-resolve.test.ts', name: 'pnpm 11' },
  },
  {
    label: 'n20-close C2-1 ci:gate trusts the run record over a failed watch',
    edits: [
      {
        path: 'tools/ci-gate.mjs',
        old: 'if (watch.error !== undefined || watch.status === null) {',
        new: 'if (false) {',
      },
      {
        path: 'tools/ci-gate.mjs',
        old: "if (watch.status !== 0 || conclusion !== 'success' || jobs.length === 0 || red.length > 0) {",
        new: "if (conclusion !== 'success' || red.length > 0) {",
      },
    ],
    check: { test: 'tests/ci-gate.test.ts', name: 'killed watch' },
  },
  {
    label: 'n20-close G1-1 shell:check discovery misses ash scripts',
    edits: [
      {
        path: 'tools/shell-check.mjs',
        old: 'return /^#!.*[/ ](?:ba|da|k|a)?sh\\b/u.test(head);',
        new: 'return /^#!.*[/ ](?:ba|da|k)?sh\\b/u.test(head);',
      },
    ],
    check: ['pnpm', 'shell:check'],
  },
];
