import { readFileSync } from 'node:fs';

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../src/App.svelte';
import { DemoController, type DemoEngine } from '../src/demo/DemoController.svelte.js';
import type { BootOutcome } from '../src/engine/client.js';
import { locale } from '../src/i18n/locale.svelte.js';

class PresentationEngine implements DemoEngine {
  boot(): Promise<BootOutcome> {
    return Promise.resolve({ kind: 'booted', contract: { schemaVersion: 1, documents: 337 } });
  }

  ask(): Promise<never> {
    throw new Error('presentation cases never request an answer');
  }

  dispose(): void {}
}

let host: HTMLElement;
let app: Record<string, unknown> | undefined;

const text = (element: Element): string => element.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
const element = <T extends HTMLElement>(selector: string): T => {
  const found = host.querySelector<T>(selector);
  if (found === null) throw new Error(`presentation surface missing: ${selector}`);
  return found;
};

beforeEach(async () => {
  locale.set('en');
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  app = mount(App, {
    target: host,
    props: { controller: new DemoController(new PresentationEngine()) },
  });
  flushSync();
  await Promise.resolve();
  flushSync();
});

afterEach(async () => {
  if (app !== undefined) await unmount(app);
  app = undefined;
  host.remove();
  locale.set('en');
  localStorage.clear();
});

describe('m1u7 framing and composition contract', () => {
  // C1:106–107; the accepted redesign replaces D7, not the scaffold ban.
  it('C1 keeps milestone and scaffold identifiers out of the rendered frame', () => {
    expect(text(host)).not.toMatch(/\b(?:M[1-5]|milestone|scaffold|TODO|coming soon)\b/iu);
    expect(text(host)).not.toMatch(/\bM[1-5]u\d+\b/iu);
  });

  // A1:124–125 + D5:49–53: attribution stays outside every disclosure.
  it('A1 attributes the source material to CDC in the visible footer', () => {
    const footer = element('footer');
    expect(footer.closest('details')).toBeNull();
    const visible = footer.cloneNode(true) as HTMLElement;
    for (const disclosure of visible.querySelectorAll('details')) disclosure.remove();
    expect(text(visible)).toMatch(
      /(?:material|content) (?:was )?developed by (?:the )?(?:CDC|Centers for Disease Control and Prevention)|(?:CDC|Centers for Disease Control and Prevention) developed (?:the )?(?:source )?(?:material|content)/iu,
    );
  });

  // A2:126–127: a closed disclosure cannot carry the required nonendorsement.
  it('A2 keeps CDC nonendorsement outside every disclosure', () => {
    const footer = element('footer');
    expect(footer.closest('details')).toBeNull();
    const visible = footer.cloneNode(true) as HTMLElement;
    for (const disclosure of visible.querySelectorAll('details')) disclosure.remove();
    expect(text(visible)).toMatch(/\b(?:CDC|Centers for Disease Control and Prevention)\b/u);
    expect(text(visible)).toMatch(
      /does not (?:imply )?endorse(?:ment)?|\bno\b.{0,30}\bendorsement\b/iu,
    );
  });

  // A3:128–129: the agency offers the material without a charge.
  it('A3 states free availability from the agency in the footer', () => {
    const footer = element('footer');
    expect(text(footer)).toMatch(
      /at no charge|free of charge|free (?:on|from|at)|available free/iu,
    );
    expect(text(footer)).toMatch(
      /(?:agency|CDC|Centers for Disease Control and Prevention).{0,30}website/iu,
    );
  });

  // A4:130–132: distinguish the executable projection from unchanged guideline text.
  it('A4 explains the compiled projection in the About disclosure', () => {
    const about = text(element('details.about'));
    expect(about).toMatch(/\bproject(?:ed|ion)\b/iu);
    expect(about).toMatch(/\b(?:compiled|Prolog)\b/u);
    expect(about).toMatch(/\b(?:source|guideline)\b/iu);
  });

  // A5:133–135: all label alternatives belong to the explanation, not only unreviewed.
  it('A5 explains the unreviewed label within its full adjudication vocabulary', () => {
    const about = text(element('details.about'));
    expect(about).toMatch(/337 compiled documents/iu);
    for (const label of ['unreviewed', 'approved', 'rejected', 'contested', 'stale']) {
      expect(about, `missing adjudication label ${label}`).toContain(label);
    }
  });

  // A6:136–137: the built-in catalog stays fixed alongside u16's free-text intake.
  it('A6 states the fixed catalog and non-clinical limitation', () => {
    const about = text(element('details.about'));
    expect(about).toMatch(/question list is fixed/iu);
    expect(about).toMatch(
      /not (?:for|intended for) clinical use|not a clinical tool|do not use [^.]*clinical decisions/iu,
    );
  });

  // A7:138–139: presentation:check already grades licence bytes; this grades their links.
  it('A7 links every contracted font licence from the disclosure', () => {
    const links = [...element('details.about').querySelectorAll<HTMLAnchorElement>('a')];
    for (const family of ['atkinson-hyperlegible-next', 'atkinson-hyperlegible-mono', 'literata']) {
      const matches = links.filter((link) =>
        new URL(link.href).pathname.endsWith(`/licenses/${family}.txt`),
      );
      expect(matches, `${family} OFL link`).toHaveLength(1);
      expect(matches[0]?.textContent?.trim()).not.toBe('');
    }
  });

  // R3:149–150: grade only rules whose selector matches the page, not an unrelated button.
  it('R3 makes the page padding viewport-dependent', () => {
    const page = element('main');
    const source = readFileSync(`${process.cwd()}/src/App.svelte`, 'utf8');
    const css = /<style>([\s\S]*)<\/style>/u.exec(source)?.[1];
    expect(css).toBeDefined();
    const paddings = [...(css ?? '').matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap((match) => {
      const selectors = (match[1] ?? '').split(',').map((selector) => selector.trim());
      const matches = selectors.some((selector) => {
        try {
          return page.matches(selector);
        } catch {
          return false;
        }
      });
      return matches
        ? [...(match[2] ?? '').matchAll(/\bpadding(?:-inline|-block)?\s*:\s*([^;]+);/gu)].map(
            (declaration) => declaration[1] ?? '',
          )
        : [];
    });
    expect(paddings.length).toBeGreaterThan(0);
    expect(paddings).not.toContain('4rem 1.5rem');
    expect(paddings.some((value) => /\b[\d.]+v[wh]\b/u.test(value))).toBe(true);
  });
});
