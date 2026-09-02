import axe from 'axe-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController } from '../src/demo/DemoController.svelte.js';
import { QUESTION_IDS } from '../src/questions/catalog.js';

const ID = QUESTION_IDS[0];
const CONTRACT = { schemaVersion: 1, documents: 337 };
const solution = {
  bindings: { A: { kind: 'atom', value: 'binding-poison' } },
  display: { A: 'review-display' },
};
const answer = {
  kind: 'answer',
  id: ID,
  serialized: 'review-serialized',
  solutions: [solution],
};

class ReviewEngine {
  boot() {
    return new Promise(() => undefined);
  }

  ask() {
    return new Promise(() => undefined);
  }

  dispose() {}
}

let target;
let app;
let controller;

const setState = (state) => {
  controller.state = state;
  flushSync();
};

beforeEach(() => {
  target = document.body.appendChild(document.createElement('div'));
  controller = new DemoController(new ReviewEngine());
  app = mount(App, { target, props: { controller } });
  flushSync();
});

afterEach(async () => {
  await unmount(app);
  controller.dispose();
  target.remove();
});

describe('M1.u6 review probes', () => {
  it('L23 keeps one answer region mounted with exact busy state in all ten states', () => {
    const states = [
      { kind: 'booting' },
      { kind: 'boot-error', error: { code: 'boot', message: 'review boot error' } },
      { kind: 'idle', contract: CONTRACT },
      { kind: 'running', id: ID },
      { kind: 'cancelling', id: ID },
      { kind: 'settled', id: ID, result: answer },
      { kind: 'settled', id: ID, result: { kind: 'failure', id: ID, serialized: 'no' } },
      {
        kind: 'settled',
        id: ID,
        result: {
          kind: 'limit',
          id: ID,
          limit: 'depth',
          serialized: 'partial',
          solutions: [],
        },
      },
      {
        kind: 'settled',
        id: ID,
        result: { kind: 'cancelled', id: ID, serialized: 'cancelled', solutions: [] },
      },
      {
        kind: 'settled',
        id: ID,
        result: { kind: 'error', id: ID, error: { code: 'worker', message: 'review error' } },
      },
    ];

    for (const state of states) {
      setState(state);
      const regions = target.querySelectorAll('section[aria-busy]');
      expect(regions, state.kind).toHaveLength(1);
      expect(regions[0]?.getAttribute('aria-busy'), state.kind).toBe(
        state.kind === 'running' || state.kind === 'cancelling' ? 'true' : 'false',
      );
    }
  });

  it('L24 finds no axe defect with either disclosure open or closed', async () => {
    controller.solutionIndex = 0;
    setState({ kind: 'settled', id: ID, result: answer });
    const about = target.querySelector('details.about');
    const canonical = target.querySelector('details.canonical');
    expect(about).toBeInstanceOf(HTMLDetailsElement);
    expect(canonical).toBeInstanceOf(HTMLDetailsElement);
    if (!(about instanceof HTMLDetailsElement) || !(canonical instanceof HTMLDetailsElement))
      return;

    const incomplete = new Set();
    for (const [name, aboutOpen, canonicalOpen] of [
      ['closed', false, false],
      ['about-open', true, false],
      ['canonical-open', false, true],
      ['both-open', true, true],
    ]) {
      about.open = aboutOpen;
      canonical.open = canonicalOpen;
      flushSync();
      const scan = await axe.run(target);
      expect(
        scan.violations.map(({ id }) => id),
        name,
      ).toEqual([]);
      for (const { id } of scan.incomplete) incomplete.add(id);
      expect(
        scan.incomplete.map(({ id }) => id).filter((id) => id !== 'color-contrast'),
        name,
      ).toEqual([]);
    }
    console.log(`L24 incomplete ids: ${[...incomplete].sort().join(', ') || 'none'}`);
  });
});
