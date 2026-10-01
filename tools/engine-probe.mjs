#!/usr/bin/env node
// `pnpm engine:probe` — the engine's lifecycle claims, re-derived in a real browser.
//
// Every scenario drives the shipped `EngineClient` and its module worker from a Vite dev page,
// in chromiumfish, and is graded here rather than printed for a reader:
//   R38  the JS answer cap and deadline terminate a goal Prolog's own limits never bound;
//   R39  a worker stuck in one synchronous step is ended by the main-thread deadline, with the
//        main thread free throughout;
//   R41  five reset cycles: each kills a hostile loop, drops consulted state and boots an
//        engine that reports the manifest's corpus;
//   R42  a failing runtime consult poisons its engine, and a reset clears the residue;
//   R45  a runaway `assertz` aborts the runtime and the client keeps the dead engine until a
//        reset — today's defect, pinned until the abort is classified.
// Outside `pnpm gate`: it needs a real browser. Vite runs in process, so nothing outlives it.

import { createServer } from 'vite';

import { failWith, launch } from './browser.mjs';
import { loadManifest, ROOT } from './kb/paths.mjs';

/** @type {(message: string) => never} */
const fail = failWith('engine:probe');

const documents = loadManifest()?.contract.documents;
if (documents === undefined) fail('no build manifest; run pnpm kb:build');
const corpus = String(documents);

const PRELUDE = `
  const { EngineClient } = await import('/src/engine/client.ts');
  const { BUDGET_MAX } = await import('/src/engine/budget.ts');
  const DOCS = 'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).';`;

/** @param {string} body @returns {string} an async page expression returning `body`'s result */
const scenario = (body) => `(async () => {${PRELUDE}\n${body}\n})()`;

const R38 = scenario(`
  const client = new EngineClient();
  try {
    await client.boot();
    const capped = await client.query('repeat.', { ...BUDGET_MAX, wallClockMs: 60000, answerCap: 50 });
    const t0 = performance.now();
    const deadlined = await client.query('repeat.', { ...BUDGET_MAX, wallClockMs: 300 });
    return {
      capped: { kind: capped.kind, limit: capped.limit, kept: capped.solutions.length },
      deadlined: { kind: deadlined.kind, limit: deadlined.limit, kept: deadlined.solutions.length },
      wallMs: performance.now() - t0,
    };
  } finally { client.dispose(); }`);

const R39 = scenario(`
  const client = new EngineClient();
  try {
    await client.boot();
    const ticks = [];
    const t0 = performance.now();
    const beat = setInterval(() => ticks.push(performance.now() - t0), 25);
    const outcome = await client.query('between(1,400000000,_),fail.', { ...BUDGET_MAX, wallClockMs: 500 });
    const settledAt = performance.now() - t0;
    clearInterval(beat);
    const rebooted = await client.reset('engine probe R39');
    return {
      kind: outcome.kind, limit: outcome.limit, settledAt,
      ticks: ticks.filter((t) => t < settledAt).length,
      documents: rebooted.kind === 'booted' ? rebooted.contract.documents : -1,
    };
  } finally { client.dispose(); }`);

/** @param {number} cycles @param {boolean} reset whether each cycle actually resets */
const R41 = (cycles, reset) =>
  scenario(`
  const budget = { ...BUDGET_MAX, wallClockMs: 30000, answerCap: 100 };
  const client = new EngineClient();
  try {
    await client.boot();
    const rows = [];
    for (let i = 0; i < ${String(cycles)}; i += 1) {
      const tag = 'probe_overlay_' + i;
      const consulted = await client.consult(':- dynamic(' + tag + '/1).\\n' + tag + '(present).\\n');
      const before = await client.query(tag + '(V).', budget);
      const hostile = client.query('between(1,400000000,_),fail.', budget);
      await new Promise((r) => setTimeout(r, 50));
      const t0 = performance.now();
      const booted = ${reset ? "await client.reset('engine probe R41')" : "{ kind: 'booted', contract: { documents: -1 } }"};
      const restartMs = performance.now() - t0;
      ${reset ? 'await hostile;' : ''}
      const after = await client.query('catch(' + tag + '(_),_,fail).', budget);
      const docs = await client.query(DOCS, budget);
      rows.push({
        consulted: consulted.kind, before: before.solutions?.[0]?.display?.V,
        reset: booted.kind, restartMs, after: after.kind,
        documents: docs.solutions?.[0]?.display?.N,
      });
    }
    return rows;
  } finally { client.dispose(); }`);

const R42 = scenario(`
  const budget = { ...BUDGET_MAX, wallClockMs: 30000, answerCap: 100 };
  const run = async (source, probe) => {
    const client = new EngineClient();
    try {
      await client.boot();
      const consulted = await client.consult(source);
      const afterwards = await client.query('true.', budget);
      const booted = await client.reset('engine probe R42');
      const residue = await client.query('catch(' + probe + '(_),_,fail).', budget);
      return { consulted: consulted.error?.code, afterwards: afterwards.error?.code,
               reset: booted.kind, residue: residue.kind };
    } finally { client.dispose(); }
  };
  return {
    syntaxError: await run(':- dynamic(probe_before/1).\\nprobe_before(x).\\nprobe_broken(.\\n', 'probe_before'),
    failingDirective: await run(':- dynamic(probe_dir/1).\\nprobe_dir(x).\\n:- fail.\\n', 'probe_dir'),
  };`);

const R45 = scenario(`
  const small = { ...BUDGET_MAX, wallClockMs: 30000, answerCap: 10 };
  const client = new EngineClient();
  try {
    await client.boot();
    await client.consult(':- dynamic(probe_hog/1).\\n');
    const t0 = performance.now();
    const runaway = await client.query('between(1,100000000,I),assertz(probe_hog(I)),fail.',
      { ...BUDGET_MAX, wallClockMs: 240000, answerCap: 10 });
    const elapsedMs = performance.now() - t0;
    const next = await client.query(DOCS, small);
    const booted = await client.reset('engine probe R45');
    const recovered = await client.query(DOCS, small);
    return {
      runaway: { kind: runaway.kind, limit: runaway.limit, message: runaway.error?.message?.slice(0, 40) },
      elapsedMs,
      next: { kind: next.kind, limit: next.limit, message: next.error?.message?.slice(0, 40) },
      reset: booted.kind, recovered: recovered.solutions?.[0]?.display?.N,
    };
  } finally { client.dispose(); }`);

/** @typedef {Record<string, unknown>} Row */

/** @param {unknown} value @returns {Row} */
const row = (value) => /** @type {Row} */ (value);

/** @param {Row} result @returns {string[]} */
const gradeR38 = (result) => {
  const capped = row(result.capped);
  const deadlined = row(result.deadlined);
  /** @type {string[]} */
  const failures = [];
  if (capped.kind !== 'limit' || capped.limit !== 'answer-cap' || capped.kept !== 50) {
    failures.push(`R38 cap: ${JSON.stringify(capped)}, expected answer-cap keeping 50`);
  }
  if (deadlined.kind !== 'limit' || deadlined.limit !== 'wall-clock') {
    failures.push(`R38 deadline: ${JSON.stringify(deadlined)}, expected a wall-clock limit`);
  }
  return failures;
};

/** @param {Row} result @returns {string[]} */
const gradeR39 = (result) => {
  /** @type {string[]} */
  const failures = [];
  const settledAt = Number(result.settledAt);
  if (result.kind !== 'limit' || result.limit !== 'wall-clock') {
    failures.push(
      `R39 settled ${String(result.kind)}/${String(result.limit)}, expected wall-clock`,
    );
  }
  // The soft check cannot run inside the step, so only the hard deadline (500 + 500 ms) ends it.
  if (settledAt < 1000 || settledAt > 4000)
    failures.push(`R39 settled at ${settledAt.toFixed(0)} ms`);
  // A 25 ms main-thread interval kept firing while the worker was stuck.
  if (Number(result.ticks) < settledAt / 25 / 2) {
    failures.push(
      `R39 main thread ticked ${String(result.ticks)} times in ${settledAt.toFixed(0)} ms`,
    );
  }
  if (String(result.documents) !== corpus)
    failures.push(`R39 rebooted ${String(result.documents)} documents`);
  return failures;
};

/** @param {unknown} result @returns {string[]} */
const gradeR41 = (result) => {
  const rows = /** @type {Row[]} */ (result);
  if (rows.length === 0) return ['R41 ran no cycle'];
  return rows.flatMap((cycle, index) => {
    const at = `R41 cycle ${String(index)}`;
    /** @type {string[]} */
    const failures = [];
    if (cycle.consulted !== 'consulted' || cycle.before !== 'present') {
      failures.push(`${at}: overlay never loaded (${JSON.stringify(cycle)})`);
    }
    if (cycle.reset !== 'booted') failures.push(`${at}: reset ${String(cycle.reset)}`);
    if (cycle.after !== 'failure') failures.push(`${at}: consulted overlay survived the reset`);
    if (cycle.documents !== corpus)
      failures.push(`${at}: replacement reports ${String(cycle.documents)} documents`);
    return failures;
  });
};

/** @param {Row} result @returns {string[]} */
const gradeR42 = (result) =>
  ['syntaxError', 'failingDirective'].flatMap((name) => {
    const run = row(result[name]);
    /** @type {string[]} */
    const failures = [];
    if (run.consulted !== 'consult')
      failures.push(`R42 ${name}: consult reported ${String(run.consulted)}`);
    if (run.afterwards !== 'consult')
      failures.push(`R42 ${name}: engine served after a failed load`);
    if (run.reset !== 'booted' || run.residue !== 'failure') {
      failures.push(`R42 ${name}: reset ${String(run.reset)}, residue ${String(run.residue)}`);
    }
    return failures;
  });

/** @param {Row} result @returns {string[]} */
const gradeR45 = (result) => {
  const runaway = row(result.runaway);
  const next = row(result.next);
  /** @param {Row} outcome @returns {boolean} the two ways a dead engine answers */
  const dead = (outcome) =>
    (outcome.kind === 'error' && String(outcome.message).startsWith('Aborted()')) ||
    (outcome.kind === 'limit' && outcome.limit === 'heap');
  /** @type {string[]} */
  const failures = [];
  if (!(runaway.kind === 'error' && String(runaway.message).startsWith('Aborted()'))) {
    failures.push(`R45 runaway: ${JSON.stringify(runaway)}, expected the runtime to abort`);
  }
  if (!dead(next))
    failures.push(`R45 next query answered on the aborted engine: ${JSON.stringify(next)}`);
  if (result.reset !== 'booted' || result.recovered !== corpus) {
    failures.push(
      `R45 reset ${String(result.reset)}, recovered ${String(result.recovered)} documents`,
    );
  }
  return failures;
};

const server = await createServer({
  configFile: `${ROOT}/vite.config.ts`,
  clearScreen: false,
  logLevel: 'silent',
  server: { host: '127.0.0.1' },
});
/** @type {import('./browser.mjs').Browser | undefined} */
let browser;
/** @type {string | undefined} */
let thrown;
try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) fail('vite exposed no local URL');
  browser = await launch(fail);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  // Vite's dependency optimizer reloads the page once on a cold start; the app reaching its own
  // ready state is what says that reload is over.
  await page.waitForSelector('[data-engine="ready"]', { timeout: 60_000 });
  /** @param {string} expression @returns {Promise<Row>} */
  const run = async (expression) => row(await page.evaluate(expression));

  // Control: R41's grader over a real browser run whose cycle skips the reset, so the
  // consulted overlay survives — a grader that stopped reading `after` would pass it.
  const control = gradeR41(await run(R41(1, false)));
  if (!control.some((line) => line.includes('consulted overlay survived the reset'))) {
    fail(`control did not fire: a cycle without its reset graded ${JSON.stringify(control)}`);
  }

  const r38 = await run(R38);
  const r39 = await run(R39);
  const r41 = await run(R41(5, true));
  const r42 = await run(R42);
  const r45 = await run(R45);
  const failures = [
    ...gradeR38(r38),
    ...gradeR39(r39),
    ...gradeR41(r41),
    ...gradeR42(r42),
    ...gradeR45(r45),
  ];
  if (failures.length > 0) fail(failures.join('; '));
  const restarts = /** @type {Row[]} */ (/** @type {unknown} */ (r41))
    .map((cycle) => Number(cycle.restartMs))
    .sort((a, b) => a - b);
  console.log(
    `engine:probe ok — R38 cap + deadline end an unbounded goal; R39 a stuck worker ended at ` +
      `${Number(r39.settledAt).toFixed(0)} ms with the main thread ticking ${String(r39.ticks)} times; ` +
      `R41 ${String(restarts.length)} resets ${restarts[0]?.toFixed(0) ?? '?'}–` +
      `${restarts.at(-1)?.toFixed(0) ?? '?'} ms, each replacement at ${corpus} documents; R42 two ` +
      `failing loads poisoned then cleared; R45 runaway aborted after ` +
      `${Number(r45.elapsedMs).toFixed(0)} ms, next query dead until reset; ` +
      `control: a cycle without its reset`,
  );
} catch (cause) {
  thrown =
    cause instanceof Error ? `${cause.name}: ${cause.message.split('\n')[0]}` : String(cause);
} finally {
  await browser?.close();
  await server.close();
}
if (thrown !== undefined) fail(thrown);
