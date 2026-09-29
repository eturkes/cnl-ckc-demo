// Red witnesses against e8ab4fa: U2, R-CLM, R-CONF.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EN } from '../src/i18n/en.js';
import { JA } from '../src/i18n/ja.js';
import { locale } from '../src/i18n/locale.svelte.js';
import { IntakeController } from '../src/intake/IntakeController.svelte.js';
import IntakePanel from '../src/intake/IntakePanel.svelte';
import type { JudgmentResult } from '../src/intake/judgment.js';
import { derived, judgment, turn, UI_VOCABULARY } from './intake-ui-support.js';

let target: HTMLElement;
let app: ReturnType<typeof mount> | undefined;
let intake: IntakeController | undefined;

beforeEach(() => {
  locale.set('en');
  target = document.body.appendChild(document.createElement('div'));
});
afterEach(async () => {
  if (app !== undefined) await unmount(app);
  intake?.dispose();
  target.remove();
  locale.set('en');
  localStorage.clear();
});

const show = async (
  value: JudgmentResult,
  reveal: 'missing' | 'unavailable' = 'missing',
  description = 'gap-sentinel',
): Promise<void> => {
  intake = new IntakeController({
    vocabulary: UI_VOCABULARY,
    client: { judge: () => Promise.resolve({ kind: 'judged', judgment: value }) },
    host: { derive: () => Promise.resolve(derived(['doc-alpha:1', 'doc-beta:2'])) },
  });
  app = mount(IntakePanel, {
    target,
    props: { intake, onReveal: () => Promise.resolve(reveal) },
  });
  await intake.submit(description);
  flushSync();
};

const noMatch = () => judgment({ conditions: { c01: 0, c02: 0 }, sections: { s1: 0 } });

describe('review: intake claims track the actual judgment and selection', () => {
  it.each(['en', 'ja'] as const)(
    'R-CLM %s: a true trigger rejected by pain does not mean no condition was met',
    async (language) => {
      locale.set(language);
      await show(judgment({ conditions: { c01: 0, c02: 1 }, sections: { s1: 0 } }));
      expect(intake!.state.kind).toBe('no-match');
      // c02 is true, but its only rule names chronic pain and judgment chooses acute.
      const falseClaim =
        language === 'en' ? 'meets none of the conditions' : 'どの条件にも該当しない';
      expect(target.textContent).not.toContain(falseClaim);
    },
  );

  it.each(['en', 'ja'] as const)(
    'R-CLM %s: zero gaps plus unjudged overflow does not establish universal coverage',
    async (language) => {
      locale.set(language);
      await show({ ...noMatch(), terms: [], overflow: 1 }, 'missing', 'x'.repeat(81));
      expect(target.querySelector('[data-intake-overflow]')).not.toBeNull();
      const falseClaim =
        language === 'en' ? 'every phrase to be covered' : 'すべての語句が知識ベースで扱われている';
      expect(target.textContent).not.toContain(falseClaim);
    },
  );

  it('U2: no-match makes the gap account its headline', async () => {
    await show(noMatch());
    expect(target.querySelector('[data-intake-outcome="no-match"]')?.textContent).toMatch(
      /phrase|vocabulary|gap/iu,
    );
  });
});

describe('review: reveal notes follow the live locale', () => {
  it.each(['missing', 'unavailable'] as const)(
    'R-CONF: an existing %s note translates when the locale changes',
    async (result) => {
      await show(judgment(), result);
      target.querySelector<HTMLButtonElement>('[data-intake-reveal]')!.click();
      await turn();
      flushSync();
      const english =
        result === 'missing' ? EN.TEXT.intakeRevealMissing() : EN.TEXT.intakeRevealUnavailable();
      expect(target.querySelector('[data-intake-reveal-note]')?.textContent).toBe(english);
      locale.set('ja');
      flushSync();
      expect(target.querySelector('[data-intake-reveal]')?.textContent?.trim()).toBe(
        JA.LABELS.intakeReveal,
      );
      const japanese =
        result === 'missing' ? JA.TEXT.intakeRevealMissing() : JA.TEXT.intakeRevealUnavailable();
      expect(target.querySelector('[data-intake-reveal-note]')?.textContent).toBe(japanese);
    },
  );
});
