// The chat as a reader sees it, read off the running page by the live lanes (`pnpm chat:live`,
// `pnpm chat:probe`). Keyed and networked — they spend the user's ChatGPT subscription through
// `pnpm chat:dev` — so both stay outside every gate and are reported, never graded there.

/** @typedef {import('./browser.mjs').Page} Page */
/**
 * @typedef {object} ChatTurn
 * @property {string} state `answered`, `failed` or `cancelled`
 * @property {string} alert the panel's alert text, `''` when none
 * @property {{ label: string, tags: string[], text: string }[]} segments
 * @property {{ call: string, summary: string, goal: string, lines: number }[]} cards
 * @property {{ url: string, text: string }[]} sources
 * @property {number} ms
 */

export const PAGE = process.env['CHAT_LIVE_URL'] ?? 'http://localhost:5173/';

/** One model turn takes 15–60 s measured (two tool calls + a search ≈ 17 s). */
export const TURN_MS = 240_000;

/** @param {Page} page @param {string} [url] @returns {Promise<void>} */
export const openChat = async (page, url = PAGE) => {
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction(
    "document.querySelector('main')?.dataset.engine === 'ready'",
    undefined,
    {
      timeout: 120_000,
    },
  );
};

/**
 * Ask one question in a fresh conversation and read the settled turn off the DOM.
 *
 * @param {Page} page @param {string} question @returns {Promise<ChatTurn>}
 */
export const ask = async (page, question) => {
  const fresh = page.locator('[data-action="chat-new"]');
  if ((await fresh.count()) > 0 && (await fresh.getAttribute('disabled')) === null)
    await fresh.click();
  await page.locator('textarea#chat-message').fill(question);
  const started = Date.now();
  await page.locator('[data-action="chat-send"]').click();
  await page.waitForFunction(
    '(() => { const turns = document.querySelectorAll(\'[data-chat-role="assistant"]\');' +
      ' const last = turns[turns.length - 1]; return last !== undefined &&' +
      " ['answered', 'failed', 'cancelled'].includes(last.dataset.chatState ?? ''); })()",
    undefined,
    { timeout: TURN_MS },
  );
  const ms = Date.now() - started;
  const turn = /** @type {Omit<ChatTurn, 'ms'>} */ (
    await page.evaluate(`(() => {
      const text = (node) => (node?.textContent ?? '').replace(/\\s+/gu, ' ').trim();
      const turns = document.querySelectorAll('[data-chat-role="assistant"]');
      const last = turns[turns.length - 1];
      return {
        state: last.dataset.chatState,
        alert: text(document.querySelector('[data-chat-alert]')),
        segments: [...last.querySelectorAll('[data-chat-segment]')].map((segment) => ({
          label: segment.dataset.chatSegment,
          tags: [...segment.querySelectorAll('.tag')].map(text),
          text: text(segment.querySelector('.segment-text')),
        })),
        cards: [...last.querySelectorAll('[data-chat-card]')].map((card) => ({
          call: card.dataset.chatCard,
          summary: text(card.querySelector('.card-head .meta')),
          goal: text(card.querySelector('.goal')),
          lines: card.querySelectorAll('.solutions li').length,
        })),
        sources: [...last.querySelectorAll('[data-chat-sources] li a')].map((link) => ({
          url: link.getAttribute('href'),
          text: text(link),
        })),
      };
    })()`)
  );
  return { ...turn, ms };
};
