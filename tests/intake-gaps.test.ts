import { describe, expect, it } from 'vitest';

import { extractCandidates } from '../src/intake/chunker.js';
import { parseJudgment } from '../src/intake/judgment.js';
import { buildRequest } from '../src/intake/request.js';
import { select } from '../src/intake/select.js';
import {
  description,
  PAINS,
  pick,
  random,
  response,
  vocabulary,
} from './intake-oracle/fixtures.js';

const VALUES = [0, 0.5 - Number.EPSILON / 2, 0.5, 0.5 + Number.EPSILON / 2, 1];

describe('S2 gap terms stay inside user candidates', () => {
  it('holds over 750 seeded descriptions and accepted judgments, including all three outcomes', () => {
    const next = random(0x16c003);
    const outcomes = new Set<string>();
    let gaps = 0;
    let overflows = 0;
    for (let iteration = 0; iteration < 750; iteration++) {
      const text = description(next);
      const vocab = vocabulary();
      const built = buildRequest(vocab, text, { hatch: iteration % 2 === 0 });
      const pain = pick(next, iteration % 2 === 0 ? PAINS : PAINS.slice(0, 4));
      const raw = response(built, pain);
      for (const [id, question] of Object.entries(built.request.questions)) {
        if (question.type === 'noul') raw.answers[id] = { type: 'noul', noul: pick(next, VALUES) };
      }
      raw.gaps = [
        { text: `fabricated-${String(iteration)}`, start: -1, end: text.length + 1, value: 1 },
      ];
      const parsed = parseJudgment(raw, built);
      const result = select(vocab, parsed);
      outcomes.add(result.kind);
      if (result.kind === 'refused') {
        expect(result).toEqual({ kind: 'refused' });
        continue;
      }
      const candidates = extractCandidates(text);
      expect(result.overflow).toBe(candidates.overflow);
      if (result.overflow > 0) overflows++;
      expect(result.gaps).toEqual(parsed.terms.filter(({ value }) => value >= 0.5));
      for (const gap of result.gaps) {
        gaps++;
        const candidate = { text: gap.text, start: gap.start, end: gap.end };
        expect(
          candidates.candidates,
          `seed 0x16c003 iteration ${String(iteration)}`,
        ).toContainEqual(candidate);
        expect(text.slice(gap.start, gap.end)).toBe(gap.text);
        expect(gap.value).toBeGreaterThanOrEqual(0.5);
      }
    }
    expect([...outcomes].sort()).toEqual(['answered', 'no-match', 'refused']);
    expect(gaps).toBeGreaterThan(0);
    expect(overflows).toBeGreaterThan(0);
  });
});
