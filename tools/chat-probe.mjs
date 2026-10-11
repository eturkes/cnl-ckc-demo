#!/usr/bin/env node
// `pnpm chat:probe` — live model behaviour on a fixed question set (`.agent/contracts/chat-c7.md`
// L2), reported and never graded: the model has no determinism control, so a gate on its
// wording would grade the weather. Start `pnpm chat:dev` and `pnpm dev` first. Prints one JSON
// report: per question, the turn's state, every part's label, every card and source, and time.

import { ask, openChat } from './chat-lane.mjs';
import { failWith, launch } from './browser.mjs';

/** `expect` = the label the question should earn somewhere in its answer; reported, not graded. */
const QUESTIONS = [
  {
    id: 'kb-acute',
    expect: 'kb',
    question: 'What does the guideline say about nonopioid therapy for acute pain?',
  },
  {
    id: 'kb-negative',
    expect: 'kb',
    question: 'Which actions does the knowledge base tell clinicians not to take?',
  },
  {
    id: 'kb-passage',
    expect: 'kb',
    question: 'Quote the guideline passage on immediate-release opioids.',
  },
  {
    id: 'web-date',
    expect: 'web',
    question: 'When did CDC publish the opioid prescribing guideline, and what did it replace?',
  },
  {
    id: 'model-general',
    expect: 'model',
    question: 'What is the difference between acute and chronic pain?',
  },
  { id: 'off-topic', expect: 'model', question: 'What is the capital of Japan?' },
];

/** @type {(message: string) => never} */
const fail = failWith('chat:probe');

const browser = await launch(fail);
/** @type {Record<string, unknown>[]} */
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openChat(page);
  for (const { id, expect, question } of QUESTIONS) {
    const turn = await ask(page, question);
    const labels = turn.segments.map(({ label }) => label);
    report.push({ id, question, expect, met: labels.includes(expect), ...turn });
  }
  if (errors.length > 0) report.push({ pageErrors: errors });
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
const met = report.filter((row) => row['met'] === true).length;
process.stderr.write(
  `chat:probe — ${String(met)}/${String(QUESTIONS.length)} questions earned their expected label; ` +
    'reported, never gated\n',
);
