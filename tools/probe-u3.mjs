#!/usr/bin/env node
// Real-browser probe for the u3 guarantee-versus-claim rows R38, R39, R41, R42, R45.
//
// Structure is `tools/smoke.mjs`: build, copy under a nested static path, serve with
// a request log, drive chromiumfish. The page is the review-only `probe.html` entry,
// which bundles the shipped `EngineClient` and — through its `new URL('./worker.ts')`
// spawn — the shipped module worker and hashed PVM fetch. Every claim below is
// therefore driven against built output in a real browser.
//
// Run one scenario at a time: `node tools/probe-u3.mjs R41`.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT } from './kb/paths.mjs';

const NESTED = 'some/nested';
const OUT = 'dist-probe';
/** @type {Record<string, string>} */
const TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

const resolveGlobal = (pkg) => {
  const globals = join(process.env.PNPM_HOME ?? join(homedir(), '.local/share/pnpm'), 'global');
  for (const dir of readdirSync(globals).sort((a, b) => Number(b) - Number(a))) {
    const entry = join(globals, dir, 'node_modules', pkg);
    if (existsSync(entry)) return pathToFileURL(entry).href;
  }
  throw new Error(`${pkg} missing from ${globals}`);
};

const serve = (root, log) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = normalize(decodeURI((request.url ?? '/').split('?')[0] ?? '/'));
      const file = join(root, path.endsWith('/') ? `${path}probe.html` : path);
      const ok = file.startsWith(root) && existsSync(file);
      log.push({ path, status: ok ? 200 : 404 });
      if (!ok) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: address.port, close: () => server.close() });
    });
  });

const scenario = process.argv[2] ?? 'ALL';

execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.probe.config.ts'], {
  cwd: ROOT,
  stdio: 'pipe',
});

const root = await mkdtemp(join(tmpdir(), 'cnl-ckc-u3probe-'));
const log = [];
const server = await serve(root, log);
const url = `http://127.0.0.1:${server.port}/${NESTED}/`;
let browser;
const out = (label, value) => console.log(`${label}: ${JSON.stringify(value)}`);

try {
  await cp(join(ROOT, OUT), join(root, NESTED), { recursive: true });
  const launcher = await import(`${resolveGlobal('chromiumfish')}/dist/index.js`);
  browser = await launcher.ChromiumFish({ headless: true });
  const page = await browser.newPage();

  /** Worker-target lifecycle straight off CDP, which is what R41 asks to observe. */
  const workerEvents = [];
  page.on('worker', (worker) => {
    workerEvents.push({ at: Date.now(), event: 'created', url: worker.url().split('/').pop() });
    worker.on('close', () =>
      workerEvents.push({ at: Date.now(), event: 'closed', url: worker.url().split('/').pop() }),
    );
  });
  page.on('pageerror', (error) => console.error(`pageerror: ${error.message}`));

  await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  // The probe page renders nothing, so an empty body is never "visible".
  await page.waitForSelector('body[data-probe="ready"]', { state: 'attached', timeout: 45_000 });

  if (scenario === 'R38' || scenario === 'ALL') {
    out(
      'R38',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const client = new EngineClient();
        const booted = await client.boot();
        const capped = await client.query('repeat.', {
          ...BUDGET_MAX,
          wallClockMs: 60_000,
          answerCap: 50,
        });
        const t0 = performance.now();
        const deadlined = await client.query('repeat.', {
          ...BUDGET_MAX,
          wallClockMs: 1500,
          answerCap: BUDGET_MAX.answerCap,
        });
        const wallMs = performance.now() - t0;
        // Response size is the memory claim: an unbounded accumulation shows up here.
        const bytes = JSON.stringify(deadlined).length;
        client.dispose();
        return {
          booted: booted.kind === 'booted' ? booted.contract : booted,
          capped: { kind: capped.kind, limit: capped.limit, solutions: capped.solutions?.length },
          deadlined: {
            kind: deadlined.kind,
            limit: deadlined.limit,
            solutions: deadlined.solutions?.length,
          },
          wallMs: Math.round(wallMs),
          bytes,
        };
      }),
    );
  }

  if (scenario === 'R39' || scenario === 'ALL') {
    out(
      'R39',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const client = new EngineClient();
        await client.boot();
        // One synchronous `next()` that cannot return: the worker's own soft check
        // and its message queue are both unreachable for its whole duration.
        const goal = 'between(1,400000000,_),fail.';
        const ticks = [];
        const t0 = performance.now();
        const beat = setInterval(() => ticks.push(Math.round(performance.now() - t0)), 25);
        const outcome = await client.query(goal, {
          ...BUDGET_MAX,
          wallClockMs: 500,
          answerCap: BUDGET_MAX.answerCap,
        });
        const settledAt = Math.round(performance.now() - t0);
        clearInterval(beat);
        const contract = await client.boot();
        client.dispose();
        return {
          outcome: { kind: outcome.kind, limit: outcome.limit },
          settledAt,
          softDeadlineMs: 500,
          hardDeadlineMs: 1000,
          mainTicksBeforeSettle: ticks.filter((t) => t < settledAt).length,
          firstTick: ticks[0],
          lastTickBeforeSettle: ticks.filter((t) => t < settledAt).at(-1),
          rebooted: contract.kind === 'booted' ? contract.contract : contract,
        };
      }),
    );
  }

  if (scenario === 'R41' || scenario === 'ALL') {
    out(
      'R41',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const budget = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 100 };
        const client = new EngineClient();
        await client.boot();
        const cycles = [];
        for (let i = 0; i < 5; i += 1) {
          const tag = `overlay_${i}`;
          const consulted = await client.consult(
            `:- dynamic(${tag}/1).\n${tag}(present).\n`,
          );
          const before = await client.query(`${tag}(V).`, budget);
          // A hostile loop makes the terminate real work, not a no-op on an idle worker.
          const hostile = client.query('between(1,400000000,_),fail.', {
            ...budget,
            wallClockMs: 30_000,
          });
          await new Promise((r) => setTimeout(r, 50));
          const t0 = performance.now();
          const reset = await client.reset(`R41 cycle ${i}`);
          const restartMs = performance.now() - t0;
          const hostileOutcome = await hostile;
          const after = await client.query(`catch(${tag}(_),_,fail).`, budget);
          const documents = await client.query(
            'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).',
            budget,
          );
          cycles.push({
            consulted: consulted.kind,
            before: before.kind,
            beforeValue: before.solutions?.[0]?.display?.V,
            hostile: hostileOutcome.kind,
            reset: reset.kind,
            contract: reset.contract,
            restartMs: Math.round(restartMs * 100) / 100,
            after: after.kind,
            documents: documents.solutions?.[0]?.display?.N,
          });
        }
        client.dispose();
        return cycles;
      }),
    );
    out('R41-workers', workerEvents.map((e, i) => ({ ...e, at: i === 0 ? 0 : e.at - workerEvents[0].at })));
  }

  if (scenario === 'R42' || scenario === 'ALL') {
    out(
      'R42',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const budget = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 100 };
        const run = async (source, probe) => {
          const client = new EngineClient();
          const booted = await client.boot();
          const clean = await client.consult(':- dynamic(r42_clean/1).\nr42_clean(ok).\n');
          const cleanQuery = await client.query('r42_clean(V).', budget);
          const consulted = await client.consult(source);
          const afterwards = await client.query('true.', budget);
          const reset = await client.reset('R42 recovery');
          const residue = await client.query(`catch(${probe}(_),_,fail).`, budget);
          const cleanResidue = await client.query('catch(r42_clean(_),_,fail).', budget);
          client.dispose();
          return {
            booted: booted.kind,
            clean: clean.kind,
            cleanValue: cleanQuery.solutions?.[0]?.display?.V,
            consulted: consulted.kind,
            consultCode: consulted.error?.code,
            consultMessage: consulted.error?.message?.slice(0, 120),
            afterwards: afterwards.kind,
            afterwardsCode: afterwards.error?.code,
            reset: reset.kind,
            contract: reset.contract,
            residue: residue.kind,
            cleanResidue: cleanResidue.kind,
          };
        };
        return {
          syntaxError: await run(
            ':- dynamic(r42_before/1).\nr42_before(x).\nr42_broken(.\nr42_after(y).\n',
            'r42_before',
          ),
          failingDirective: await run(
            ':- dynamic(r42_dir/1).\nr42_dir(x).\n:- fail.\n',
            'r42_dir',
          ),
        };
      }),
    );
  }

  if (scenario === 'R45' || scenario === 'ALL') {
    out(
      'R45',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const budget = { ...BUDGET_MAX, wallClockMs: 240_000, answerCap: 10 };
        const client = new EngineClient();
        await client.boot();
        await client.consult(':- dynamic(r45_hog/1).\n');
        const t0 = performance.now();
        const outcome = await client.query(
          'between(1,100000000,I),assertz(r45_hog(I)),fail.',
          budget,
        );
        const elapsed = Math.round(performance.now() - t0);
        const reset = outcome.kind === 'limit' ? undefined : await client.reset('R45 recovery');
        const residue = await client.query('catch(r45_hog(_),_,fail).', {
          ...BUDGET_MAX,
          wallClockMs: 30_000,
          answerCap: 10,
        });
        const documents = await client.query(
          'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).',
          { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 10 },
        );
        client.dispose();
        return {
          outcome: {
            kind: outcome.kind,
            limit: outcome.limit,
            code: outcome.error?.code,
            message: outcome.error?.message?.slice(0, 160),
          },
          elapsedMs: elapsed,
          resetAfterwards: reset?.kind,
          residue: residue.kind,
          documents: documents.solutions?.[0]?.display?.N,
        };
      }),
    );
    out('R45-workers', workerEvents.length);
  }

  if (scenario === 'R45b') {
    // Does the client stay usable after the abort if nobody resets it?
    out(
      'R45b',
      await page.evaluate(async () => {
        const { EngineClient, BUDGET_MAX } = window.probe;
        const small = { ...BUDGET_MAX, wallClockMs: 30_000, answerCap: 10 };
        const client = new EngineClient();
        await client.boot();
        await client.consult(':- dynamic(r45_hog/1).\n');
        const outcome = await client.query('between(1,100000000,I),assertz(r45_hog(I)),fail.', {
          ...BUDGET_MAX,
          wallClockMs: 240_000,
          answerCap: 10,
        });
        const after = await client.query(
          'findall(D,guideline_document(D,_,_),Ds),length(Ds,N).',
          small,
        );
        const residue = await client.query('catch(r45_hog(_),_,fail).', small);
        client.dispose();
        return {
          outcome: { kind: outcome.kind, limit: outcome.limit, code: outcome.error?.code },
          afterNoReset: {
            kind: after.kind,
            code: after.error?.code,
            message: after.error?.message?.slice(0, 120),
            documents: after.solutions?.[0]?.display?.N,
          },
          residue: { kind: residue.kind, code: residue.error?.code },
        };
      }),
    );
  }

  const broken = log.filter((e) => e.status !== 200 && e.path.startsWith(`/${NESTED}`));
  out('assets', { served: log.filter((e) => e.status === 200).length, broken: broken.map((e) => e.path) });
} finally {
  await browser?.close();
  server.close();
  await rm(root, { recursive: true, force: true });
}
