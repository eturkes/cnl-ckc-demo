import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProvenanceLadder from '../src/provenance/ProvenanceLadder.svelte';
import { parseEvidenceDocument, type EvidenceDocument } from '../src/provenance/model.js';

import { EVIDENCE_FIXTURE } from './provenance-fixture.js';

const ready = {
  kind: 'ready' as const,
  solution: 0,
  steps: [
    {
      line: 77,
      head: 'guideline_property(example,dose)',
      predicate: 'guideline_property/5',
      document: EVIDENCE_FIXTURE.id,
      sentence: 1,
      children: [],
    },
  ],
};

let host: HTMLElement | undefined;
let dispose: (() => void) | undefined;

const render = async (evidence: EvidenceDocument): Promise<HTMLElement> => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(evidence)))),
  );
  host = document.createElement('div');
  document.body.append(host);
  const app = mount(ProvenanceLadder, { target: host, props: { state: ready } });
  dispose = () => void unmount(app);
  const details = host.querySelector('details.ladder');
  if (!(details instanceof HTMLDetailsElement)) throw new Error('evidence ladder missing');
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  await vi.waitFor(() => expect(host?.querySelector('[data-side="ace"]')).not.toBeNull());
  await tick();
  return host;
};

const activeText = (root: HTMLElement): string[] =>
  [...root.querySelectorAll<HTMLButtonElement>('.aligned-copy button.active')]
    .map((node) => node.textContent ?? '')
    .sort();

afterEach(() => {
  dispose?.();
  dispose = undefined;
  host?.remove();
  host = undefined;
  vi.unstubAllGlobals();
});

describe('expedited claim replay', () => {
  it('demonstrates that the evidence consumer accepts duplicate clauses and page zero', () => {
    const duplicate = structuredClone(EVIDENCE_FIXTURE);
    duplicate.region.page = 0;
    const first = duplicate.clauses[0];
    if (first === undefined) throw new Error('evidence fixture has no clause');
    duplicate.clauses.push(structuredClone(first));
    const parsed = parseEvidenceDocument(duplicate, duplicate.id);
    expect(parsed.region.page).toBe(0);
    expect(parsed.clauses).toHaveLength(2);
  });

  it('replays byte-faithful text and identical pointer/keyboard alignment groups', async () => {
    let root = await render(EVIDENCE_FIXTURE);
    expect(root.querySelector('[data-side="source"]')?.textContent).toBe(
      EVIDENCE_FIXTURE.source.text,
    );
    expect(root.querySelector('[data-side="ace"]')?.textContent).toBe(EVIDENCE_FIXTURE.ace.text);
    root
      .querySelector<HTMLButtonElement>('[data-side="source"] button')
      ?.dispatchEvent(new Event('pointerenter'));
    await tick();
    const pointer = activeText(root);

    dispose?.();
    dispose = undefined;
    root.remove();
    host = undefined;
    root = await render(EVIDENCE_FIXTURE);
    root.querySelector<HTMLButtonElement>('[data-side="ace"] button')?.focus();
    await tick();
    expect(activeText(root)).toEqual(pointer);
    expect(pointer).toEqual(['Dose', 'dose']);
  });
});
