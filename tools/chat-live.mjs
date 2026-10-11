#!/usr/bin/env node
// `pnpm chat:live` — the whole chat path in a real browser (`.agent/contracts/chat-c7.md` L1):
// the running Vite page, the local bridge and the live model answer one fixed question. Start
// `pnpm chat:dev` and `pnpm dev` first. It fails unless the answer carries at least one KB part
// whose card holds the goal and at least one engine solution, and the page raised no error.

import { ask, openChat } from './chat-lane.mjs';
import { failWith, launch } from './browser.mjs';

const QUESTION =
  'What does the knowledge base recommend before starting opioid therapy for chronic pain?';

/** @type {(message: string) => never} */
const fail = failWith('chat:live');

const browser = await launch(fail);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openChat(page);
  const turn = await ask(page, QUESTION);
  if (turn.state !== 'answered') fail(`the turn ended ${turn.state}: ${turn.alert}`);
  const kb = turn.segments.filter(({ label }) => label === 'kb');
  if (kb.length === 0)
    fail(`no KB part among ${turn.segments.map(({ label }) => label).join(', ')}`);
  for (const segment of kb) {
    for (const tag of segment.tags) {
      const call = tag.split(' ').at(-1) ?? '';
      const card = turn.cards.find((entry) => entry.call === call);
      if (card === undefined) fail(`${tag} names no card in this turn`);
      if (card.goal === '') fail(`${call}'s card shows no goal`);
    }
  }
  if (!turn.cards.some(({ lines }) => lines > 0)) fail('no card holds an engine solution');
  if (errors.length > 0) fail(`page errors: ${errors.join(' | ')}`);
  const labels = Object.entries(
    turn.segments.reduce(
      (count, { label }) => ({ ...count, [label]: (count[label] ?? 0) + 1 }),
      /** @type {Record<string, number>} */ ({}),
    ),
  )
    .map(([label, n]) => `${label} ${String(n)}`)
    .join(', ');
  process.stdout.write(
    `chat:live — answered in ${String(Math.round(turn.ms / 1000))} s: ${labels}; ` +
      `${String(turn.cards.length)} cards, ${String(turn.sources.length)} web sources, 0 page errors\n`,
  );
} finally {
  await browser.close();
}
