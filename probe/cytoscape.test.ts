import cytoscape, { type ElementDefinition } from 'cytoscape';
import { describe, expect, it } from 'vitest';

const elements: ElementDefinition[] = [
  { data: { id: 'a', kind: 'noun' }, position: { x: 0, y: 0 } },
  { data: { id: 'b', kind: 'verb' }, position: { x: 10, y: 0 } },
  { data: { id: 'c', kind: 'noun' }, position: { x: 20, y: 0 } },
  { data: { id: 'd', kind: 'document' }, position: { x: 0, y: 10 } },
  { data: { id: 'ab', source: 'a', target: 'b', predicate: 'acts' } },
  { data: { id: 'bc', source: 'b', target: 'c', predicate: 'links' } },
  { data: { id: 'ad', source: 'a', target: 'd', predicate: 'sourced-in' } },
];
const ids = (collection: cytoscape.CollectionReturnValue) => collection.map((element) => element.id()).sort();

describe('headless graph model seam', () => {
  it('asserts derivation, selectors, traversal, paths, and positions without canvas', () => {
    const cy = cytoscape({ headless: true, styleEnabled: false, elements, layout: { name: 'preset' } });
    expect(cy.container()).toBeNull();
    expect(ids(cy.nodes('[kind = "noun"]'))).toEqual(['a', 'c']);
    expect(ids(cy.$('#a').closedNeighborhood().nodes())).toEqual(['a', 'b', 'd']);
    expect(cy.elements().dijkstra({ root: '#a', directed: true }).pathTo(cy.$('#c')).map((el) => el.id())).toEqual([
      'a', 'ab', 'b', 'bc', 'c',
    ]);
    expect(cy.$('#c').position()).toEqual({ x: 20, y: 0 });
    expect(() => cy.png()).toThrow(/headless instance can not render images/i);
    cy.destroy();
    expect(cy.destroyed()).toBe(true);
  });
});
