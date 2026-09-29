// u16g replay (`.agent/contracts/m5u16.md` P3–P5): the recorded live judgments, re-graded on
// every gate run through the real builder, parser, selector and engine. Live accuracy is
// reported in `tests/intake/report.json`, never gated; what the gate holds is that the report
// re-derives and that the forced-arm control still fires.
// Regenerate after `pnpm intake:probe`: INTAKE_REPORT_WRITE=1 pnpm exec vitest run
// tests/intake-replay.test.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { EngineSession } from '../src/engine/session.js';
import { IntakeService } from '../src/intake/service.js';
import { INTAKE_VOCABULARY } from '../src/intake/vocabulary.js';

import { ROOT } from './clinical-test-support.js';
import { loadIntakeImage } from './intake-backend-support.js';
import { deriveReport, type GoldCase, type Replay, type Report } from './intake-report.js';

const read = (name: string): unknown =>
  JSON.parse(readFileSync(join(ROOT, 'tests/intake', name), 'utf8'));
const gold = (read('gold.json') as { cases: GoldCase[] }).cases;
const replay = read('replay.json') as Replay;
const REPORT = join(ROOT, 'tests/intake/report.json');

let service: IntakeService;
let report: Report;

beforeAll(async () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'kb/generated/kb-manifest.json'), 'utf8'),
  ) as { contract: { schemaVersion: number; documents: number } };
  const session = new EngineSession({ loadImage: loadIntakeImage, expected: manifest.contract });
  await session.boot(new Uint8Array(readFileSync(join(ROOT, 'kb/generated/kb.pvm'))));
  service = new IntakeService({ query: (goal, budget) => session.solve(goal, budget) });
  report = await deriveReport({
    vocabulary: INTAKE_VOCABULARY,
    gold,
    replay,
    derive: (ids) => service.derive(ids),
  });
  if (process.env.INTAKE_REPORT_WRITE === '1') {
    writeFileSync(REPORT, `${JSON.stringify(report, undefined, 2)}\n`);
  }
}, 300_000);

describe('intake replay', () => {
  it('P3 every gold case has its baseline arm and every gold-refused case its forced arm', () => {
    expect(replay.cases.map(({ id }) => id)).toEqual(gold.map(({ id }) => id));
    expect(replay.cases.filter(({ forced }) => forced !== undefined).map(({ id }) => id)).toEqual(
      gold.filter(({ outcome }) => outcome === 'refused').map(({ id }) => id),
    );
    expect(report.cases).toHaveLength(gold.length);
  });

  it('P3 a recorded request the rebuilt one does not match is refused by case', async () => {
    const broken = structuredClone(replay);
    const [first] = broken.cases;
    if (first === undefined) throw new Error('replay holds no case');
    first.baseline.request = '0'.repeat(64);
    await expect(
      deriveReport({
        vocabulary: INTAKE_VOCABULARY,
        gold,
        replay: broken,
        derive: (ids) => service.derive(ids),
      }),
    ).rejects.toThrow(`${first.id}: recorded request does not match the rebuilt one`);
  });

  it('P4 the committed report re-derives from gold + replay through the real pipeline', () => {
    expect(report).toEqual(JSON.parse(readFileSync(REPORT, 'utf8')));
  });

  it('P5 the forced arm fires: a hatch refusal answers with a derived rule once the hatch is gone', () => {
    expect(report.summary.forcedFired.length).toBeGreaterThan(0);
  });
});
