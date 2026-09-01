import type { BootOutcome } from '../engine/client.js';
import type { BudgetSpec, EngineContract, EngineError } from '../engine/protocol.js';
import type { QuestionId } from '../questions/catalog.js';
import type { AnswerResult } from '../questions/service.js';

// Compile-only red-suite contract. The shipping `.svelte.ts` takes resolution precedence.
export declare const DEMO_BUDGET: Readonly<BudgetSpec>;

export interface DemoEngine {
  boot(): Promise<BootOutcome>;
  ask(id: unknown, budget: BudgetSpec, signal?: AbortSignal): Promise<AnswerResult>;
  dispose(): void;
}

export declare const createDemoEngine: () => DemoEngine;

export type DemoState =
  | { kind: 'booting' }
  | { kind: 'boot-error'; error: EngineError }
  | { kind: 'idle'; contract: EngineContract }
  | { kind: 'running'; id: QuestionId }
  | { kind: 'cancelling'; id: QuestionId }
  | { kind: 'settled'; id: QuestionId; result: AnswerResult };

export declare class DemoController {
  constructor(engine?: DemoEngine);
  state: DemoState;
  selected: QuestionId | null;
  solutionIndex: number;
  select(id: QuestionId): void;
  run(): Promise<void>;
  cancel(): Promise<void>;
  retry(): Promise<void>;
  selectSolution(index: number): void;
  dispose(): void;
}
