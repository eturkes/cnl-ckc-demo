// The u16g report (`.agent/contracts/m5u16.md` P3–P6): frozen gold + recorded judgments →
// per-case verdicts, through the REAL request builder, parser, selector and engine. One
// module so the gate suite that grades `report.json` and the probe run that writes it cannot
// derive two different reports.

import { createHash } from 'node:crypto';

import { parseJudgment } from '../src/intake/judgment.js';
import { buildRequest, type JudgmentRequest } from '../src/intake/request.js';
import { select } from '../src/intake/select.js';
import type { IntakeDerivation } from '../src/intake/service.js';
import type { IntakeVocabulary } from '../src/intake/vocabulary.js';

export type Outcome = 'answered' | 'no-match' | 'refused';

export interface GoldCase {
  id: string;
  description: string;
  outcome: Outcome;
  pain: string;
  ruleIds: string[];
  gapSpans: string[];
}

export interface RecordedArm {
  /** sha256 of the request body exactly as posted. */
  request: string;
  response: unknown;
}

export interface Replay {
  schemaVersion: 1;
  model: string;
  vocabulary: string;
  cases: { id: string; baseline: RecordedArm; forced?: RecordedArm }[];
}

type SpanVerdict = 'found' | 'discovery' | 'judgment' | 'suppressed';

export interface ArmVerdict {
  outcome: Outcome;
  pain: string | null;
  selected: string[];
  derived: string[];
  gaps: string[];
  overflow: number;
}

export interface CaseVerdict {
  id: string;
  gold: { outcome: Outcome; pain: string; ruleIds: string[] };
  baseline: ArmVerdict;
  outcomeMatch: boolean;
  /** Over the DERIVED set, which is what the page shows; `null` where the ratio is 0/0. */
  precision: number | null;
  recall: number | null;
  spans: { text: string; verdict: SpanVerdict }[];
  forced?: ArmVerdict;
}

export interface Report {
  schemaVersion: 1;
  model: string;
  vocabulary: string;
  cases: CaseVerdict[];
  summary: {
    byOutcome: Record<Outcome, { n: number; matched: number }>;
    rules: { gold: number; derived: number; truePositive: number };
    spans: Record<SpanVerdict, number> & { n: number };
    forcedFired: string[];
  };
}

export const requestDigest = (request: JudgmentRequest): string =>
  createHash('sha256').update(JSON.stringify(request)).digest('hex');

const ratio = (hit: number, of: number): number | null =>
  of === 0 ? null : Math.round((hit / of) * 1e4) / 1e4;

const arm = async (
  vocabulary: IntakeVocabulary,
  gold: GoldCase,
  recorded: RecordedArm,
  hatch: boolean,
  derive: (ruleIds: readonly string[]) => Promise<IntakeDerivation>,
) => {
  const built = buildRequest(vocabulary, gold.description, { hatch });
  if (requestDigest(built.request) !== recorded.request) {
    throw new Error(
      `${gold.id}: recorded request does not match the rebuilt one (hatch ${String(hatch)})`,
    );
  }
  const judgment = parseJudgment(recorded.response, built);
  const outcome = select(vocabulary, judgment);
  const selected = outcome.kind === 'answered' ? outcome.matches.map(({ ruleId }) => ruleId) : [];
  let derived: string[] = [];
  if (selected.length > 0) {
    const result = await derive(selected);
    if (result.kind !== 'derived')
      throw new Error(`${gold.id}: derivation rejected an artifact id`);
    derived = result.rules.filter(({ status }) => status === 'derived').map(({ ruleId }) => ruleId);
  }
  const verdict: ArmVerdict = {
    outcome: outcome.kind,
    pain: outcome.kind === 'refused' ? null : outcome.pain,
    selected,
    derived,
    gaps: outcome.kind === 'refused' ? [] : outcome.gaps.map(({ text }) => text),
    overflow: judgment.overflow,
  };
  return { verdict, judgment, outcome };
};

export const deriveReport = async (options: {
  vocabulary: IntakeVocabulary;
  gold: readonly GoldCase[];
  replay: Replay;
  derive: (ruleIds: readonly string[]) => Promise<IntakeDerivation>;
}): Promise<Report> => {
  const { vocabulary, gold, replay, derive } = options;
  if (replay.vocabulary !== vocabulary.digest) {
    throw new Error(
      'replay was recorded against another intake vocabulary — rerun pnpm intake:probe',
    );
  }
  const cases: CaseVerdict[] = [];
  for (const item of gold) {
    const recorded = replay.cases.find(({ id }) => id === item.id);
    if (recorded === undefined) throw new Error(`${item.id}: no recorded baseline`);
    const base = await arm(vocabulary, item, recorded.baseline, true, derive);
    const golden = new Set(item.ruleIds);
    const truePositive = base.verdict.derived.filter((id) => golden.has(id)).length;
    const shown = base.outcome.kind === 'refused' ? [] : base.outcome.gaps;
    const spans = item.gapSpans.map((text) => {
      // Every occurrence counts: repeated text may fall in chunks the model scored differently.
      const at: number[] = [];
      for (let start = item.description.indexOf(text); start >= 0;) {
        at.push(start);
        start = item.description.indexOf(text, start + 1);
      }
      if (at.length === 0)
        throw new Error(`${item.id}: gold span "${text}" is not in the description`);
      const overlaps = (term: { start: number; end: number }) =>
        at.some((start) => term.start < start + text.length && start < term.end);
      let verdict: SpanVerdict;
      if (shown.some(overlaps)) verdict = 'found';
      else if (!base.judgment.terms.some(overlaps)) verdict = 'discovery';
      else if (base.judgment.terms.some((term) => overlaps(term) && term.value >= 0.5))
        verdict = 'suppressed';
      else verdict = 'judgment';
      return { text, verdict };
    });
    const verdict: CaseVerdict = {
      id: item.id,
      gold: { outcome: item.outcome, pain: item.pain, ruleIds: item.ruleIds },
      baseline: base.verdict,
      outcomeMatch: base.verdict.outcome === item.outcome,
      precision: ratio(truePositive, base.verdict.derived.length),
      recall: ratio(truePositive, item.ruleIds.length),
      spans,
    };
    if (item.outcome === 'refused') {
      if (recorded.forced === undefined)
        throw new Error(`${item.id}: gold-refused case has no forced arm`);
      verdict.forced = (await arm(vocabulary, item, recorded.forced, false, derive)).verdict;
    }
    cases.push(verdict);
  }

  const byOutcome: Report['summary']['byOutcome'] = {
    answered: { n: 0, matched: 0 },
    'no-match': { n: 0, matched: 0 },
    refused: { n: 0, matched: 0 },
  };
  const spans = { n: 0, found: 0, discovery: 0, judgment: 0, suppressed: 0 };
  const rules = { gold: 0, derived: 0, truePositive: 0 };
  for (const verdict of cases) {
    const bucket = byOutcome[verdict.gold.outcome];
    bucket.n += 1;
    if (verdict.outcomeMatch) bucket.matched += 1;
    const golden = new Set(verdict.gold.ruleIds);
    rules.gold += golden.size;
    rules.derived += verdict.baseline.derived.length;
    rules.truePositive += verdict.baseline.derived.filter((id) => golden.has(id)).length;
    for (const span of verdict.spans) {
      spans.n += 1;
      spans[span.verdict] += 1;
    }
  }
  return {
    schemaVersion: 1,
    model: replay.model,
    vocabulary: replay.vocabulary,
    cases,
    summary: {
      byOutcome,
      rules,
      spans,
      // P5: refused by the hatch, yet answered with a derived rule once the hatch is gone.
      forcedFired: cases
        .filter(
          ({ baseline, forced }) =>
            baseline.outcome === 'refused' &&
            forced?.outcome === 'answered' &&
            forced.derived.length > 0,
        )
        .map(({ id }) => id),
    },
  };
};
