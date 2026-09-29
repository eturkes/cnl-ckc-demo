// Live probe run (`.agent/contracts/m5u16.md` P1–P6). Keyed and networked, so it runs outside
// the gate: `pnpm intake:probe`. Each frozen gold description becomes the exact request the
// Worker would send, one recorded response per arm — `baseline`, plus `forced` (`hatch: false`)
// for every gold-refused case, a transient status retried up to 3 attempts — and the raw
// responses land in `tests/intake/replay.json`. The report is
// then re-derived through the real pipeline by the same module the gate grades it with.
//
// The request goes over plain HTTPS to the endpoint the SDK posts to: the SDK stays in
// `worker/` alone (ESLint), and the probe measures the model, not the Worker.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createServer, createServerModuleRunner } from 'vite';

import { ROOT } from './kb/paths.mjs';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const KEY_FILE = join(homedir(), '.config/typesafe/key');
const REPLAY = join(ROOT, 'tests/intake/replay.json');
const ATTEMPTS = 3;
const PARALLEL = 3;

/** @returns {string} */
const readKey = () => {
  const key =
    process.env.TYPESAFE_API_KEY ?? (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '');
  if (key.trim() === '') throw new Error(`intake:probe: no key in TYPESAFE_API_KEY or ${KEY_FILE}`);
  return key.trim();
};

/** @param {string} key @param {unknown} request @returns {Promise<unknown>} */
const post = async (key, request) => {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(60_000),
    });
    if (response.ok) {
      /** @type {unknown} */
      const body = await response.json();
      return body;
    }
    // The body is discarded, never printed: an upstream error may echo the request.
    await response.body?.cancel();
    if (attempt >= ATTEMPTS || ![408, 429, 500, 502, 503, 529].includes(response.status)) {
      throw new Error(
        `intake:probe: upstream ${String(response.status)} after ${String(attempt)} attempts`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
  }
};

const main = async () => {
  const key = readKey();
  const server = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
  try {
    // The runner types every module `any`; these are the shipped builder + vocabulary.
    /** @type {typeof import('../src/intake/request.ts')} */
    const { buildRequest, JEV_MODEL } = await runner.import('/src/intake/request.ts');
    /** @type {typeof import('../src/intake/vocabulary.ts')} */
    const { INTAKE_VOCABULARY } = await runner.import('/src/intake/vocabulary.ts');
    /** @type {unknown} */
    const raw = JSON.parse(readFileSync(join(ROOT, 'tests/intake/gold.json'), 'utf8'));
    const gold = /** @type {{ cases: { id: string, description: string, outcome: string }[] }} */ (
      raw
    ).cases;

    /** @type {{ id: string, hatch: boolean }[]} */
    const jobs = gold.flatMap(({ id, outcome }) => [
      { id, hatch: true },
      ...(outcome === 'refused' ? [{ id, hatch: false }] : []),
    ]);
    /** @type {Map<string, { request: string, response: unknown }>} */
    const recorded = new Map();
    let next = 0;
    const worker = async () => {
      for (let job = jobs[next++]; job !== undefined; job = jobs[next++]) {
        const item = gold.find(({ id }) => id === job.id);
        if (item === undefined) throw new Error(`intake:probe: no gold case ${job.id}`);
        const { request } = buildRequest(INTAKE_VOCABULARY, item.description, { hatch: job.hatch });
        const response = await post(key, request);
        recorded.set(`${job.id}:${String(job.hatch)}`, {
          request: createHash('sha256').update(JSON.stringify(request)).digest('hex'),
          response,
        });
        process.stdout.write(`${job.id} ${job.hatch ? 'baseline' : 'forced'} recorded\n`);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    const replay = {
      schemaVersion: 1,
      model: JEV_MODEL,
      vocabulary: INTAKE_VOCABULARY.digest,
      cases: gold.map(({ id, outcome }) => ({
        id,
        baseline: recorded.get(`${id}:true`),
        ...(outcome === 'refused' ? { forced: recorded.get(`${id}:false`) } : {}),
      })),
    };
    writeFileSync(REPLAY, `${JSON.stringify(replay, undefined, 2)}\n`);
    process.stdout.write(
      `intake:probe — ${String(jobs.length)} calls recorded to tests/intake/replay.json\n`,
    );
  } finally {
    await runner.close();
    await server.close();
  }
};

await main();
