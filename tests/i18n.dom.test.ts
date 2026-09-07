// The Japanese interface, and the three ways it can silently fail.
//
// A locale seam can pass a key-parity check and still ship English, so these
// assertions read RENDERED text, not the catalog. The catalog-shaped claims that
// `pnpm copy:check` already decides — every key present, every value rewritten —
// are deliberately not repeated here.
//
// Payload never translates. `AboutPanel` renders the guideline title and the font
// family names, which are proper names carried through both locales unchanged, so
// it doubles as the check that translation stopped at the interface.

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AboutPanel from '../src/demo/AboutPanel.svelte';
import LanguageToggle from '../src/demo/LanguageToggle.svelte';
import ThemeToggle from '../src/demo/ThemeToggle.svelte';
import { GUIDELINE } from '../src/demo/copy.js';
import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';

const KEY = 'cnl-ckc-lang';

let host: HTMLElement | undefined;
let cleanup: (() => void) | undefined;

const render = <P extends Record<string, unknown>>(
  component: Parameters<typeof mount>[0],
  props: P,
): HTMLElement => {
  host = document.createElement('div');
  document.body.append(host);
  const app = mount(component, { target: host, props });
  flushSync();
  cleanup = () => void unmount(app);
  return host;
};

/** Tear down the current mount early, so one case may render twice. */
const teardown = (): void => {
  cleanup?.();
  cleanup = undefined;
  host?.remove();
  host = undefined;
};

const button = (root: HTMLElement): HTMLButtonElement => {
  const found = root.querySelector('button');
  if (found === null) throw new Error('no toggle button rendered');
  return found;
};

const click = (control: HTMLButtonElement): void => {
  control.click();
  flushSync();
};

// `locale.set` persists, so the reset comes FIRST and the clear undoes its write.
// The other order leaves every case starting from a saved `en`.
beforeEach(() => {
  locale.set('en');
  localStorage.clear();
});

afterEach(() => {
  teardown();
  locale.set('en');
  localStorage.clear();
});

describe('the language toggle', () => {
  it('opens in English and offers Japanese', () => {
    const control = button(render(LanguageToggle, {}));
    expect(control.textContent).toContain(EN.LABELS.languageSwitch);
    expect(control.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the interface, the lang attribute and the document title', () => {
    const control = button(render(LanguageToggle, {}));
    click(control);

    expect(locale.current).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.title).toBe(JA.DESCRIPTIONS.documentTitle);
    // The control now offers the way back, and says so in the language it returns to.
    expect(control.textContent).toContain(JA.LABELS.languageSwitch);
    expect(control.getAttribute('aria-pressed')).toBe('true');
  });

  it('persists the choice and restores it on the next mount', () => {
    const first = button(render(LanguageToggle, {}));
    click(first);
    expect(localStorage.getItem(KEY)).toBe('ja');

    // A fresh page starts with the rune at its default. `locale.set` persists too,
    // so the saved choice — the thing under test — is written back before the
    // second mount reads it.
    teardown();
    locale.set('en');
    localStorage.setItem(KEY, 'ja');

    const second = button(render(LanguageToggle, {}));
    expect(locale.current).toBe('ja');
    expect(second.getAttribute('aria-pressed')).toBe('true');
  });

  // The label is ASCII in both locales on purpose: 日本語 in the header would make
  // an English visitor fetch the 1.3 MB Japanese face to render three characters.
  it('keeps its own label free of the glyphs that would pull the Japanese face', () => {
    // Escaped, never literal: a range written out starts at an ideographic space,
    // which is the `no-irregular-whitespace` no editor can show you. The two ranges
    // are CJK punctuation and the fullwidth forms; the scripts cover the rest.
    const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\uFF00-\uFFEF]/u;
    expect(EN.LABELS.languageSwitch).not.toMatch(cjk);
    expect(JA.LABELS.languageSwitch).not.toMatch(cjk);
  });
});

// WCAG 2.5.3 Label in Name. A speech-input user says the words on the control, so
// an `aria-label` that does not contain them makes the control unsayable. Nothing
// else here would catch it: axe's `label-content-name-mismatch` is experimental and
// off by default, and the sweep in `demo-controller.dom` only ever runs in English.
// Translating an ASCII label is the exact way to breach it — the Japanese toggle
// read `英語` while displaying `English`.
describe('every header toggle', () => {
  /** The words a speech-input user can see, which excludes the decorative glyph. */
  const visibleLabel = (control: HTMLButtonElement): string =>
    [...control.children]
      .filter((child) => child.getAttribute('aria-hidden') !== 'true')
      .map((child) => child.textContent ?? '')
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();

  const toggles = [
    ['language', LanguageToggle],
    ['theme', ThemeToggle],
  ] as const;

  for (const which of ['en', 'ja'] as const) {
    for (const [name, component] of toggles) {
      it(`names the ${name} toggle by what it displays, in ${which}, in both states`, () => {
        locale.set(which);
        const control = button(render(component, {}));
        const namesWhatItShows = (): void => {
          const label = visibleLabel(control);
          expect(label).not.toBe('');
          // Case-insensitive, as the criterion is: `Use the dark theme` names `Dark`.
          expect(control.getAttribute('aria-label')?.toLowerCase()).toContain(label.toLowerCase());
        };

        // Each toggle relabels itself on click, so one reading proves half of it.
        namesWhatItShows();
        click(control);
        namesWhatItShows();
      });
    }
  }
});

describe('a translated surface', () => {
  it('renders Japanese prose once the locale is Japanese', () => {
    locale.set('ja');
    const text = render(AboutPanel, { documents: 337 }).textContent ?? '';

    expect(text).toContain(JA.DESCRIPTIONS.purpose);
    expect(text).toContain(JA.DESCRIPTIONS.unreviewed);
    expect(text).toContain(JA.INSTRUCTIONS.notClinical);
    expect(text).not.toContain(EN.DESCRIPTIONS.purpose);
  });

  it('renders the same surface in English by default', () => {
    const text = render(AboutPanel, { documents: 337 }).textContent ?? '';

    expect(text).toContain(EN.DESCRIPTIONS.purpose);
    expect(text).not.toContain(JA.DESCRIPTIONS.purpose);
  });

  it('leaves payload in the language its source is written in', () => {
    locale.set('ja');
    const text = render(AboutPanel, { documents: 337 }).textContent ?? '';

    // The guideline's own title and the four font family names are proper names.
    expect(text).toContain(GUIDELINE.title);
    expect(text).toContain('Atkinson Hyperlegible Next');
    expect(text).toContain('BIZ UDPGothic');
    // The engine reports the corpus size; the sentence around it is what translates.
    expect(text).toContain(JA.TEXT.engineDocuments(337));
    expect(text).toContain('337');
  });
});
