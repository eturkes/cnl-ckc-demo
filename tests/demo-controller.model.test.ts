// u10b oracle — an independent model of `DemoController`'s state transitions, written
// from `.agent/contracts/m5u10b.md` alone, driven differentially against the real
// controller. The model is the second opinion: it must never import the controller's
// own transition code.

import { describe, expect, it } from 'vitest';

describe('demo controller transition oracle', () => {
  it('O1 model and controller agree on every driven transition sequence', () => {
    expect.fail('unimplemented');
  });

  it('O2 model and controller agree on the state a rejected ask leaves behind', () => {
    expect.fail('unimplemented');
  });

  it('O3 model and controller agree on a run started after a rejected run', () => {
    expect.fail('unimplemented');
  });

  it('O4 model and controller agree on a superseded rejection writing nothing', () => {
    expect.fail('unimplemented');
  });
});
