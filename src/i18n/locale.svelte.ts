// The selected interface language, and the bundle every surface reads through.
//
// One rune holds the locale; `messages` is a getter over it rather than a plain
// export, because exporting the resolved bundle would capture it once and freeze
// the UI in whichever language loaded first. A plain `.ts` consumer that calls
// `messages.current` inside a `$derived` or a template still tracks the signal,
// which is what keeps `describe.ts` locale-aware without becoming a rune module.
//
// Only the interface translates. Questions, ACE renderings, canonical Prolog values
// and engine messages are payload and stay in the language of the knowledge base.

import { EN, type Messages } from './en.js';
import { JA } from './ja.js';

export type Locale = 'en' | 'ja';

const KEY = 'cnl-ckc-lang';
const BUNDLES: Record<Locale, Messages> = { en: EN, ja: JA };

const isLocale = (value: string | null): value is Locale => value === 'en' || value === 'ja';

let current = $state<Locale>('en');

/**
 * `lang` drives screen-reader voice selection and the browser's own font matching,
 * so it has to move with the bundle. `<title>` and the description meta ship in
 * `index.html` in English and are re-authored here for the same reason.
 */
const apply = (next: Locale): void => {
  current = next;
  const { DESCRIPTIONS } = BUNDLES[next];
  document.documentElement.lang = next;
  document.title = DESCRIPTIONS.documentTitle;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', DESCRIPTIONS.documentDescription);
};

export const locale = {
  get current(): Locale {
    return current;
  },
  set(next: Locale): void {
    apply(next);
    localStorage.setItem(KEY, next);
  },
  /** Saved choice wins; otherwise a Japanese browser opens in Japanese. */
  restore(): void {
    const saved = localStorage.getItem(KEY);
    apply(isLocale(saved) ? saved : navigator.language.startsWith('ja') ? 'ja' : 'en');
  },
};

export const messages = {
  get current(): Messages {
    return BUNDLES[current];
  },
};
