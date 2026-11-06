#!/usr/bin/env node
// `pnpm chat:live` — the whole chat path in a real browser (`.agent/contracts/chat-c7.md` L1):
// the running Vite page, the local bridge and the live model answer one fixed question. Start
// `pnpm chat:dev` and `pnpm dev` first. It fails unless the answer carries at least one KB part
// whose card holds the goal and at least one engine solution, and the page raised no error.
//
// `CHAT_LIVE_CONTROL=no-kb` is the lane's firing input, and calls no model: Vite and the bridge
// run in process, the bridge relaying `tests/support/fake-codex.mjs`, whose answer cites a KB
// query it never ran. The lane must exit 1 naming `no KB part`.

import { mkdtempSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import { startChatServer } from '../server/chat.mjs';
import { ask, openChat, PAGE } from './chat-lane.mjs';
import { failWith, launch } from './browser.mjs';

const QUESTION =
  'What does the knowledge base recommend before starting opioid therapy for chronic pain?';

/** @type {(message: string) => never} */
const fail = failWith('chat:live');

/** @returns {Promise<number>} a port free at the time of asking */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createNetServer().listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === 'object' && address !== null
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });

/** The page served against a bridge that relays the scripted fake, never the model. */
const controlPage = async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  process.env['FAKE_CODEX_CONFIG'] = JSON.stringify({
    trace: join(mkdtempSync(join(tmpdir(), 'chat-live-control-')), 'trace.ndjson'),
    guide: join(root, 'server', 'chat-guide.md'),
  });
  const port = await freePort();
  const bridge = await startChatServer({
    port: 0,
    origins: [`http://127.0.0.1:${String(port)}`],
    codexHome: mkdtempSync(join(tmpdir(), 'chat-live-codex-')),
    codexCommand: [process.execPath, join(root, 'tests', 'support', 'fake-codex.mjs')],
  });
  const vite = await createServer({
    configFile: join(root, 'vite.config.ts'),
    clearScreen: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      proxy: { '/api/chat': { target: `http://127.0.0.1:${String(bridge.port)}` } },
    },
  });
  await vite.listen();
  return `http://127.0.0.1:${String(port)}/`;
};

const control = process.env['CHAT_LIVE_CONTROL'];
if (control !== undefined && control !== 'no-kb') fail(`unknown control ${control}`);
const url = control === undefined ? PAGE : await controlPage();
const browser = await launch(fail);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openChat(page, url);
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
