// The mutant table `pnpm mutate` runs: each entry restores one fixed defect's pre-fix behaviour
// and names the check that closes it, which must go red. A green row is a fix nothing binds.
//
// `check` is a vitest file plus a `-t` name filter, or a whole command for a defect a gate step
// closes. Every `old` must occur exactly once in its file; a stale anchor stops the run.

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
];
