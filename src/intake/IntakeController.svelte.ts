// The free-text intake lifecycle (`.agent/contracts/m5u16.md` U2–U4, D5): one description
// becomes one judgment, one deterministic selection and — when rules match — one derivation
// through the demo's engine queue. Every recommendation a row shows is the engine's
// derivation; the judgment only chose which rule ids to derive.

import type { JudgmentClient, JudgmentOutcome } from './client.js';
import type { PainOption } from './request.js';
import { select, type Gap, type Match } from './select.js';
import type { DerivedRule, IntakeDerivation } from './service.js';
import { INTAKE_VOCABULARY, type IntakeRule, type IntakeVocabulary } from './vocabulary.js';

export interface IntakeRow {
  match: Match;
  rule: IntakeRule;
  result: DerivedRule;
}

export type IntakeFailure = 'rate-limited' | 'stale' | 'server' | 'network' | 'invalid' | 'engine';

export type IntakeState =
  | { kind: 'idle' }
  | { kind: 'judging'; description: string }
  | { kind: 'deriving'; description: string }
  | { kind: 'refused'; description: string }
  | { kind: 'no-match'; description: string; gaps: readonly Gap[]; overflow: number }
  | {
      kind: 'answered';
      description: string;
      pain: PainOption;
      rows: readonly IntakeRow[];
      gaps: readonly Gap[];
      overflow: number;
    }
  | { kind: 'failed'; description: string; reason: IntakeFailure };

/** The demo's engine queue, seen from intake: derive by rule id, nothing else. */
export interface IntakeHost {
  derive(ruleIds: readonly unknown[], signal?: AbortSignal): Promise<IntakeDerivation> | undefined;
}

const isAbort = (cause: unknown): boolean =>
  cause instanceof DOMException && cause.name === 'AbortError';

export class IntakeController {
  state = $state.raw<IntakeState>({ kind: 'idle' });

  readonly vocabulary: IntakeVocabulary;
  readonly #host: IntakeHost;
  readonly #client: JudgmentClient;
  /** The run token: only the holder may write state, and a newer submission replaces it. */
  #run: AbortController | undefined;
  #disposed = false;

  constructor(options: {
    host: IntakeHost;
    client: JudgmentClient;
    vocabulary?: IntakeVocabulary;
  }) {
    this.#host = options.host;
    this.#client = options.client;
    this.vocabulary = options.vocabulary ?? INTAKE_VOCABULARY;
  }

  get busy(): boolean {
    return this.state.kind === 'judging' || this.state.kind === 'deriving';
  }

  async submit(input: string): Promise<void> {
    const description = input.trim();
    if (description === '' || this.#disposed) return;
    this.#run?.abort();
    const run = new AbortController();
    this.#run = run;
    const owns = (): boolean => this.#run === run && !run.signal.aborted;
    const land = (next: IntakeState): void => {
      if (!owns()) return;
      this.#run = undefined;
      this.state = next;
    };
    const failed = (reason: IntakeFailure): void => {
      land({ kind: 'failed', description, reason });
    };

    this.state = { kind: 'judging', description };
    let judged: JudgmentOutcome;
    try {
      judged = await this.#client.judge(description, run.signal);
    } catch (cause) {
      // An abort belongs to whoever aborted it, so it lands nothing.
      if (!isAbort(cause)) failed('network');
      return;
    }
    if (!owns()) return;
    if (judged.kind === 'unavailable') {
      failed(judged.reason);
      return;
    }

    const outcome = select(this.vocabulary, judged.judgment);
    if (outcome.kind === 'refused') {
      land({ kind: 'refused', description });
      return;
    }
    if (outcome.kind === 'no-match') {
      land({ kind: 'no-match', description, gaps: outcome.gaps, overflow: outcome.overflow });
      return;
    }

    this.state = { kind: 'deriving', description };
    let derivation: IntakeDerivation | undefined;
    try {
      derivation = await this.#host.derive(
        outcome.matches.map(({ ruleId }) => ruleId),
        run.signal,
      );
    } catch (cause) {
      if (isAbort(cause)) return;
      derivation = undefined;
    }
    if (derivation?.kind !== 'derived') {
      failed('engine');
      return;
    }
    const rows: IntakeRow[] = [];
    for (const match of outcome.matches) {
      const rule = this.vocabulary.rules.find(({ id }) => id === match.ruleId);
      const result = derivation.rules.find(({ ruleId }) => ruleId === match.ruleId);
      if (rule === undefined || result === undefined) {
        failed('engine');
        return;
      }
      rows.push({ match, rule, result });
    }
    land({
      kind: 'answered',
      description,
      pain: outcome.pain,
      rows,
      gaps: outcome.gaps,
      overflow: outcome.overflow,
    });
  }

  cancel(): void {
    if (!this.busy) return;
    this.#run?.abort();
    this.#run = undefined;
    this.state = { kind: 'idle' };
  }

  retry(): Promise<void> {
    return this.state.kind === 'failed' ? this.submit(this.state.description) : Promise.resolve();
  }

  dispose(): void {
    this.#disposed = true;
    this.#run?.abort();
    this.#run = undefined;
  }
}
