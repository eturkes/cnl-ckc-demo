// The text the model reads for one `prolog_query` call (`.agent/contracts/chat-c4.md` D2).
//
// Built from the engine's own `display` strings and nothing else, so what the model quotes as a
// KB result is what the engine rendered. The bridge prefixes the call id (`chat-c3.md`).

import type { QueryOutcome } from '../engine/client.js';
import type { PlSolution } from '../engine/protocol.js';

/** Characters of solution text one call hands the model; ~2000 tokens. */
export const TOOL_RESULT_MAX = 8000;

export interface ToolResult {
  text: string;
  /** The goal ran: `solutions`, `failure` or `limit`. Only such a call can back a `kb` label. */
  ok: boolean;
  shown: number;
  total: number;
}

const line = (solution: PlSolution): string => {
  const pairs = Object.entries(solution.display).map(([name, value]) => `${name} = ${value}`);
  return pairs.length === 0 ? 'true' : pairs.join(', ');
};

const listing = (head: string, solutions: readonly PlSolution[]): Omit<ToolResult, 'ok'> => {
  const lines = [head];
  let used = head.length;
  let shown = 0;
  for (const solution of solutions) {
    const next = line(solution);
    // The closing note needs room too, so a cut always leaves space to say how much was cut.
    if (used + 1 + next.length > TOOL_RESULT_MAX - 64) {
      // A first solution longer than the cap would leave the model nothing; it is cut instead,
      // and says so where it was cut.
      if (shown === 0) {
        const room = TOOL_RESULT_MAX - 128 - used;
        lines.push(
          `${next.slice(0, room)} … [cut at ${String(room)} of ${String(next.length)} characters]`,
        );
        shown = 1;
      }
      break;
    }
    lines.push(next);
    used += 1 + next.length;
    shown += 1;
  }
  const left = solutions.length - shown;
  if (left > 0) lines.push(`… ${String(left)} more solution(s) not shown`);
  return { text: lines.join('\n'), shown, total: solutions.length };
};

export function toolResult(outcome: QueryOutcome): ToolResult {
  switch (outcome.kind) {
    case 'solutions':
      return {
        ok: true,
        ...listing(`solutions: ${String(outcome.solutions.length)}`, outcome.solutions),
      };
    case 'failure':
      return { ok: true, text: 'failure: the goal has no solutions', shown: 0, total: 0 };
    case 'limit':
      return {
        ok: true,
        ...listing(
          `stopped at the ${outcome.limit} limit after ${String(outcome.solutions.length)} solution(s)`,
          outcome.solutions,
        ),
      };
    case 'cancelled':
      return { ok: false, text: 'cancelled before the goal finished', shown: 0, total: 0 };
    case 'error': {
      const { code, message } = outcome.error;
      const text = code === 'guard' ? `refused: ${message}` : `error (${code}): ${message}`;
      return { ok: false, text: text.slice(0, TOOL_RESULT_MAX), shown: 0, total: 0 };
    }
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
