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

import { mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import AboutPanel from '../src/demo/AboutPanel.svelte';
import LanguageToggle from '../src/demo/LanguageToggle.svelte';
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
  cleanup = () => void unmount(app);
  return host;
};

const button = (root: HTMLElement): HTMLButtonElement => {
  const found = root.querySelector('button');
  if (found === null) throw new Error('no toggle button rendered');
  return found;
};

beforeEach(() => {
  localStorage.clear();
  locale.set('en');
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  host?.remove();
  host = undefined;
  localStorage.clear();
  locale.set('en');
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
    control.click();

    expect(locale.current).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.title).toBe(JA.DESCRIPTIONS.documentTitle);
    // The control now offers the way back, and says so in the language it returns to.
    expect(control.textContent).toContain(JA.LABELS.languageSwitch);
    expect(control.getAttribute('aria-pressed')).toBe('true');
  });

  it('persists the choice and restores it on the next mount', () => {
    const first = button(render(LanguageToggle, {}));
    first.click();
    expect(localStorage.getItem(KEY)).toBe('ja');

    cleanup?.();
    host?.remove();
    locale.set('en');

    const second = button(render(LanguageToggle, {}));
    expect(locale.current).toBe('ja');
    expect(second.getAttribute('aria-pressed')).toBe('true');
  });

  // The label is ASCII in both locales on purpose: 日本語 in the header would make
  // an English visitor fetch the 1.3 MB Japanese face to render three characters.
  it('keeps its own label free of the glyphs that would pull the Japanese face', () => {
    const cjk = /[　-ヿ㐀-䶿一-鿿＀-￯]/u;
    expect(EN.LABELS.languageSwitch).not.toMatch(cjk);
    expect(JA.LABELS.languageSwitch).not.toMatch(cjk);
  });
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
