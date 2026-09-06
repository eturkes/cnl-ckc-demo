// M5 u1 red suite — the compiled fragment/premise/gate records.
//
// SEED: every case fails until it encodes its ruled row from
// `.agent/contracts/m5u1.md` (predicates P1-P10, design rulings D1-D11, T14 rulings).

import { describe, expect, it } from 'vitest';

const unimplemented = (): never => {
  throw new Error('unimplemented');
};

describe('clinical records', () => {
  it('T1 byte identity: 7 questions, 12 canonical terms, raw contribution order', unimplemented);
  it('T3 total site coverage: 686 lines, equality both ways, ACE↔PL bijection', unimplemented);
  it('T4 site vector equals the reference recipe: keyed {line,head,body}', unimplemented);
  it('T5 one antecedent per sentence, multi-body input throws P5 exactly', unimplemented);
  it('T6 premise decomposition: nested conjunction, NAF, duplicates, ground, true', unimplemented);
  it('T7 skolem sharing: one map per (Doc,S), heads then premises, deterministic', unimplemented);
  it('T8 tokenizing ground map: quoted atoms intact, no cross-sentence sharing', unimplemented);
  it('T9 frozen surfaces: parsed clauses, canonical presentation, passage bytes', unimplemented);
  it('T10 lossless guard fails closed on a non-rebuildable sentence', unimplemented);
  it('T11 determinism: two derivations and a reversed file map agree byte for byte', unimplemented);
  it('T12 budget delta measured and reproducible, no ceiling', unimplemented);
  it('T13 malformed payload fails closed across the pinned fault category', unimplemented);
  it('T14 ruled readings: record order, traversal order, ordinals, fresh anonymous', unimplemented);
});
