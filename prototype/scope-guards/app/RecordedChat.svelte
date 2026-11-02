<script lang="ts">
  import { onDestroy } from 'svelte';
  import ChatPanel from '../../../src/chat/ChatPanel.svelte';
  import { ChatController } from '../../../src/chat/ChatController.svelte.js';
  import { ReplayChatClient, type RecordedTurn, type ChatClient } from '../../../src/chat/client.js';
  import { DemoController } from '../../../src/demo/DemoController.svelte.js';
  import ThemeToggle from '../../../src/demo/ThemeToggle.svelte';
  import LanguageToggle from '../../../src/demo/LanguageToggle.svelte';
  import type { QueryOutcome } from '../../../src/engine/client.js';
  import recording from './turn.json';

  let {demo,date} = $props();
  const outcomes: QueryOutcome[] = [];
  let replay = new ReplayChatClient([recording as RecordedTurn]);
  const binding = (index: number, name: string): string => {
    const result = outcomes[index];
    if (result?.kind !== 'solutions') throw new Error('No live KB solution; no answer is generated.');
    const value = result.solutions[0]?.bindings[name];
    if (value?.kind === 'atom' || value?.kind === 'string') return value.value;
    return result.solutions[0]?.display[name] ?? '';
  };
  const find = (term: any, functor: string): any => term?.kind === 'compound' ? (term.functor === functor ? term : term.args.map((arg: any) => find(arg,functor)).find(Boolean)) : undefined;
  const answer = (): string => {
    const scope = outcomes[1];
    const condition = scope?.kind === 'solutions' ? scope.solutions[0]?.bindings.Condition : undefined;
    const comparison = find(condition,'guideline_satisfies');
    if (!comparison) throw Error('No live age-bound clause; no scope wording is generated.');
    const [relation,limit,unit] = comparison.args.slice(-3).map((value: any) => String(value.value));
    const doc = binding(0,'Doc');
    const sentence = binding(0,'Sentence');
    const date = binding(0,'Date');
    const iso = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
    // The fixture records wording + calls, never answers. Values come only from this run.
    return JSON.stringify({ segments: [
      { text: `Superseded from ${iso}: ${doc}, sentence ${sentence}. Recorded statement: ${binding(0,'Modality')} ${binding(0,'Verb')} a ${binding(0,'Noun')} ${binding(0,'Prep')} an ${binding(0,'Purpose')}. Replaced by ${binding(0,'Citation')}. ${binding(0,'Url')}`, source:'kb', queries:['q1'], urls:[] },
      { text: `Scope exclusion: patient age ${relation === 'less' ? 'less than' : relation} ${limit} ${unit}${unit === 'year' ? 's' : ''}. Source: ${binding(1,'Doc')}, sentence ${binding(1,'Sentence')}. Guideline: ${binding(1,'Guideline')}. The KB holds ${binding(1,'Count')} scope-exclusion clauses; the matched condition is in the query card. The absence of this exclusion does not establish that a patient belongs to the guideline’s population.`, source:'kb', queries:['q2'], urls:[] },
    ] });
  };
  const client: ChatClient = {
    turn: (message, conversation, onEvent, signal) => { replay = new ReplayChatClient([recording as RecordedTurn]); return replay.turn(message,conversation,(event) => onEvent(event.type === 'answer' ? {...event,text:answer()} : event),signal); },
    result: (...args) => replay.result(...args),
  };
  const chat = new ChatController({ client, host: { runGoal: async (goal, signal) => {
    const result = await demo.runGoal(goal,signal);
    if (result) outcomes.push(result);
    return result;
  } } });
  let started = $state(false);
  async function replayTurn() { outcomes.length = 0; chat.reset(); await chat.submit(recording.message); }
  $effect(() => {
    if (demo.state.kind === 'idle' && !started) {
      started = true;
      void chat.submit(recording.message);
    }
  });
  onDestroy(() => { chat.dispose(); });
</script>

<section class="recorded-chat"><p class="intro">Recorded chat demonstration. The queries run in this page’s live knowledge base; no model is called. Evaluation date: {date || 'none'}.</p><button type="button" onclick={() => void replayTurn()}>Replay scope question</button><ChatPanel {chat} /></section>

<style>
  .recorded-chat > button { margin:0 0 .75rem; border:1px solid var(--border); border-radius:.25rem; padding:.45rem .65rem; background:transparent; color:var(--action); font:inherit; font-size:.8rem; cursor:pointer; }
  .recorded-chat > button:focus-visible { outline:2px solid var(--focus-ring); outline-offset:3px; }
  header, main { width:min(100% - 2rem, 64rem); margin-inline:auto; }
  header { display:flex; justify-content:space-between; align-items:center; padding:1rem 0; }
  header div { display:flex; gap:.6rem; }
  header a { color:var(--text); text-decoration:none; font-weight:700; }
  main { padding-bottom:3rem; }
  h1 { font-family:var(--font-ui); font-size:1.5rem; margin:.5rem 0; }
  .intro { font-size:.9rem; color:var(--text-muted); line-height:1.5; max-width:65ch; margin-bottom:1.5rem; }
</style>
