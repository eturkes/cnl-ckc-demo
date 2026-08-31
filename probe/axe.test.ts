import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

const ids = (items: axe.Result[]) => items.map(({ id }) => id).sort();

describe('axe-core DOM seam', () => {
  it('accepts a named combobox with a related listbox', async () => {
    document.body.innerHTML = `
      <main>
        <label for="question">Clinical question</label>
        <input id="question" role="combobox" aria-expanded="true" aria-controls="questions" aria-activedescendant="question-a" readonly>
        <ul id="questions" role="listbox" aria-label="Built-in questions">
          <li id="question-a" role="option" aria-selected="true">Which recommendation has category A?</li>
        </ul>
      </main>`;
    expect(ids((await axe.run(document.body)).violations)).toEqual([]);
  });

  it('catches computed DOM violations but cannot decide jsdom contrast', async () => {
    document.body.innerHTML = `<main><button></button><img src="x"><p style="color:#777;background:#777">Unreadable</p></main>`;
    const result = await axe.run(document.body);
    expect(ids(result.violations)).toEqual(expect.arrayContaining(['button-name', 'image-alt']));
    expect(ids(result.violations)).not.toContain('color-contrast');
    expect(ids(result.incomplete)).toContain('color-contrast');
  });
});
