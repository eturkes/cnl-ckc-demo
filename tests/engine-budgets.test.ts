// Red suite for M1.u3, written diff-blind against `.scratch/contract-m1u3.md`.
// Every case names the contract predicate it binds to. A case that passes without
// the real engine doing the work is a defect, not a green.

import { describe, expect, it } from 'vitest';

describe('M1.u3 budgets, failure modes, cancellation', () => {
  it('P1.1 — query without a budget spec is unreachable from the public API', () => {
    expect.fail('unimplemented: P1.1');
  });

  it('P1.2 — zero, negative, fractional, NaN, Infinity, missing and over-max budgets each fail typed', () => {
    expect.fail('unimplemented: P1.2');
  });

  it('P1.3 — the worker revalidates a budget the client would have accepted', () => {
    expect.fail('unimplemented: P1.3');
  });

  it('P1.4 — answer cap stops the real 7-solution goal at cap 1', () => {
    expect.fail('unimplemented: P1.4');
  });

  it('P2.1 — stack exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.1');
  });

  it('P2.2 — depth exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.2');
  });

  it('P2.3 — inference exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.3');
  });

  it('P2.4 — wall-clock expiry surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.4');
  });

  it('P2.5 — answer cap surfaces its own state, distinct from an exhausted run', () => {
    expect.fail('unimplemented: P2.5');
  });

  it('P2.6 — cancellation surfaces its own state, distinct from every limit', () => {
    expect.fail('unimplemented: P2.6');
  });

  it('P2.7 — heap exhaustion surfaces its own terminal state', () => {
    expect.fail('unimplemented: P2.7');
  });

  it('P2.8 — a limit is classified from term structure, not from message text', () => {
    expect.fail('unimplemented: P2.8');
  });

  it('P3.1 — the stack flag is restored on success, failure, limit, exception and cancel', () => {
    expect.fail('unimplemented: P3.1');
  });

  it('P3.2 — depth and inference yield early solutions before terminating', () => {
    expect.fail('unimplemented: P3.2');
  });

  it('P3.3 — the budget bounds display rendering as well as solving', () => {
    expect.fail('unimplemented: P3.3');
  });

  it('P3.4 — the engine still reports 337 documents and 7 answers after every trip', () => {
    expect.fail('unimplemented: P3.4');
  });

  it('P3.5 — a repeat-shaped goal terminates through the cap or the deadline', () => {
    expect.fail('unimplemented: P3.5');
  });

  it('P3.6 — wall-clock fires soft in the worker and hard on the main thread', () => {
    expect.fail('unimplemented: P3.6');
  });

  it('P4.1 — a cancel message is acted on while a multi-solution query runs', () => {
    expect.fail('unimplemented: P4.1');
  });

  it('P4.2 — cooperative cancel settles only its target id', () => {
    expect.fail('unimplemented: P4.2');
  });

  it('P4.3 — the engine stays usable after a cooperative cancel', () => {
    expect.fail('unimplemented: P4.3');
  });

  it('P4.4 — hard cancel re-verifies the contract from the rebooted engine', () => {
    expect.fail('unimplemented: P4.4');
  });

  it('P4.5 — hard cancel drops a dynamic overlay and still reports 337 documents', () => {
    expect.fail('unimplemented: P4.5');
  });

  it('P4.6 — every in-flight request settles once, with no unhandled rejection', () => {
    expect.fail('unimplemented: P4.6');
  });

  it('P4.7 — a request issued during respawn settles typed', () => {
    expect.fail('unimplemented: P4.7');
  });

  it('P4.8 — a dead-generation response cannot settle a live request', () => {
    expect.fail('unimplemented: P4.8');
  });

  it('P4.9 — concurrent hard cancels produce one termination and one respawn', () => {
    expect.fail('unimplemented: P4.9');
  });

  it('P4.10 — a settled request leaves no armed timer', () => {
    expect.fail('unimplemented: P4.10');
  });

  it('P4.11 — dispose stays terminal and hard cancel is a separate lifecycle', () => {
    expect.fail('unimplemented: P4.11');
  });

  it('P5.1 — a malformed goal fails typed and never executes', () => {
    expect.fail('unimplemented: P5.1');
  });

  it('P5.2 — an honest zero-solution goal stays failure', () => {
    expect.fail('unimplemented: P5.2');
  });

  it('P5.3 — consult stderr is drained and any ERROR line is fatal', () => {
    expect.fail('unimplemented: P5.3');
  });

  it('P5.4 — an engine that emitted consult ERROR is discarded, not returned', () => {
    expect.fail('unimplemented: P5.4');
  });

  it('P6.2 — no unbudgeted query surface is exported', () => {
    expect.fail('unimplemented: P6.2');
  });

  it('P6.5 — terms.ts decode and encode behavior is unchanged', () => {
    expect.fail('unimplemented: P6.5');
  });

});
