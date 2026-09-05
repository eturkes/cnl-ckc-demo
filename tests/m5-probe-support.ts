import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUDGET_MAX } from '../src/engine/budget.js';
import { EngineSession, type Engine, type ImageLoader } from '../src/engine/session.js';
import type { PlSolution } from '../src/engine/protocol.js';
import { verifyBag } from '../tools/kb/bag.mjs';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const readGenerated = (name: string): Buffer =>
  readFileSync(join(ROOT, 'kb/generated', name));
export const bagFiles = (): Map<string, Uint8Array> => {
  const kb = join(ROOT, 'kb');
  const archive = readdirSync(kb).find((name) => name.endsWith('.tar.gz'));
  if (archive === undefined) throw new Error('vendored bag missing');
  return verifyBag(readFileSync(join(kb, archive))).files;
};

const require = createRequire(import.meta.url);
export const boot = async (image?: Uint8Array): Promise<EngineSession> => {
  const manifest = JSON.parse(readGenerated('kb-manifest.json').toString('utf8')) as {
    contract: { schemaVersion: number; documents: number };
  };
  const diagnostics: string[] = [];
  const loadImage: ImageLoader = async (image) => {
    const factory = require('swipl-wasm/dist/loadImageDefault.js') as
      | ((image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine>)
      | { default: (image: Uint8Array) => (options?: Record<string, unknown>) => Promise<Engine> };
    const load = typeof factory === 'function' ? factory : factory.default;
    return load(image)({ printErr: (line: string) => diagnostics.push(line) });
  };
  const session = new EngineSession({
    loadImage,
    expected: manifest.contract,
    drain: () => diagnostics.splice(0),
  });
  await session.boot(image ?? new Uint8Array(readGenerated('kb.pvm')));
  return session;
};

export const solve = async (session: EngineSession, goal: string): Promise<PlSolution[]> => {
  const result = await session.solve(goal, BUDGET_MAX);
  if (result.kind !== 'solutions' && result.kind !== 'failure') {
    throw new Error(`${goal}: ${JSON.stringify(result)}`);
  }
  return result.kind === 'solutions' ? result.solutions : [];
};

export const bagText = (files: Map<string, Uint8Array>, suffix: string): string => {
  const matches = [...files.keys()].filter((path) => path.endsWith(suffix));
  if (matches.length !== 1) throw new Error(`expected one ${suffix}; got ${matches.length}`);
  return Buffer.from(files.get(matches[0] as string) as Uint8Array).toString('utf8');
};
