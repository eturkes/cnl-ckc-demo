<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ThemeToggle from '../../../../src/demo/ThemeToggle.svelte';
  import { EngineClient } from '../../../../src/engine/client.js';
  import type { PlSolution, ProofStep } from '../../../../src/engine/protocol.js';
  import type { ProvenanceState, EvidenceDocument } from '../../../../src/provenance/model.js';
  import ProvenanceLadder from '../../../../src/provenance/ProvenanceLadder.svelte';
  import { loadEvidenceDocument } from '../../../../src/provenance/assets.js';
  import { DOC, BUDGET, CLAUSES, RECORDS, goalFor, proofSteps } from './logic.js';

  const client = new EngineClient();
  let date = $state('');
  let evaluated = $state('');
  let busy = $state(true);
  let ready = $state(false);
  let status = $state('Loading the knowledge base…');
  let clauses: PlSolution[] = [];
  let records = $state<PlSolution[]>([]);
  let evidence = $state.raw<EvidenceDocument>();
  let results = $state.raw<{ sentence: number; derived: boolean; goal: string; solutions: PlSolution[]; steps: ProofStep[] }[]>([]);
  let selected = $state(1);
  let provenance = $derived.by((): ProvenanceState => {
    const result = results.find(r => r.sentence === selected);
    if (busy) return { kind: 'loading', solution: 0 };
    return result?.derived ? { kind: 'ready', solution: 0, steps: result.steps } : { kind: 'idle' };
  });
  const value = (s: PlSolution, key: string) => { const t = s.bindings[key]; return t?.kind === 'atom' || t?.kind === 'integer' ? String(t.value) : s.display[key]; };
  async function query(goal: string) {
    const outcome = await client.query(goal, BUDGET);
    if (outcome.kind !== 'solutions' && outcome.kind !== 'failure') throw new Error(`Query did not finish: ${outcome.kind}${outcome.kind === 'error' ? ': ' + outcome.error.message : ''}`);
    return outcome.kind === 'solutions' ? outcome.solutions : [];
  }
  async function run() {
    if (!ready || busy) return;
    busy = true;
    results = [];
    const runDate = date;
    status = 'Evaluating the three historical recommendation contexts…';
    try {
      const next = [];
      for (const clause of clauses) {
        const sentence = Number(value(clause, 'S'));
        const goal = goalFor(clause.bindings.C, clause.bindings.Body, runDate);
        const solutions = await query(goal);
        const proven = solutions.length ? await query(goal) : [];
        if (solutions.length !== proven.length) throw new Error('The repeated proof disagrees with the answer.');
        next.push({ sentence, derived: solutions.length > 0, goal, solutions, steps: proven.length ? proofSteps(proven[0].bindings.Proof) : [] });
      }
      // Positive control before the empty read: records are visible in this same engine.
      const control = await query(RECORDS);
      if (control.length !== 3) throw new Error(`Expected three supersession records; read ${control.length}.`);
      const leaked = await query('guideline_evaluation_date(D)');
      if (leaked.length) throw new Error('The evaluation date leaked into the shared knowledge base.');
      results = next;
      evaluated = runDate;
      selected = 1;
      const count = next.filter(r => r.derived).length;
      status = `${count} of ${next.length} recommendation contexts derived. No date fact remains in the knowledge base.`;
    } catch (error) { status = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  }
  onMount(() => {
    void (async () => {
      try {
        const boot = await client.boot();
        if (boot.kind === 'error') throw new Error(boot.error.message);
        clauses = await query(CLAUSES);
        if (clauses.length !== 3) throw new Error(`Expected three operator clauses; read ${clauses.length}.`);
        records = await query(RECORDS);
        evidence = await loadEvidenceDocument(DOC);
        ready = true;
        busy = false;
        await run();
      } catch (error) { busy = false; status = String(error); }
    })();
  });
  onDestroy(() => client.dispose());
</script>

<header><span>CNL / CKC</span><ThemeToggle /></header>
<main>
  <h1>Evaluate historical recommendations</h1>
  <p class="intro">Do the buprenorphine-waiver recommendations derive for this date?</p>
  <form onsubmit={(e) => { e.preventDefault(); void run(); }}>
    <label for="evaluation-date">Evaluate as of <input id="evaluation-date" type="date" bind:value={date} disabled={busy} aria-describedby="date-note" /></label>
    <button type="submit" disabled={!ready || busy}>Run</button>
    <button type="button" disabled={busy || !date} onclick={() => { date = ''; }}>Clear date</button>
  </form>
  <p id="date-note" class="muted">Optional. A date is a premise of this run only. Empty keeps the knowledge base’s default.</p>
  <section class="answer" aria-label="Evaluation result" aria-busy={busy} data-ready={ready && !busy}>
    <h2>Evaluation result</h2>
    <p role="status" class="status">{status}</p>
    {#if results.length}
      <p class="muted">Evaluated as of: <strong>{evaluated || 'No date supplied'}</strong>. Each sentence uses its own hypothetical clinical context, not patient facts.</p>
      {#each results as result}
        {@const record = records.find(r => Number(value(r,'S')) === result.sentence)}
        <article>
          <div class="statement-heading"><h3>Sentence {result.sentence}</h3><strong class:absent={!result.derived}>{result.derived ? 'Derived' : 'Not derived'}</strong></div>
          <p class="statement">{evidence?.ace.sentences.find(s => s.number === result.sentence)?.text}</p>
          <p class="muted">Source wording, not a current-care recommendation. {result.derived ? 'The recommendation context derives under this run’s premises.' : 'The recommendation context has no derivation under this run’s premises.'}</p>
          {#if record}
            <p class="supersession">Superseded from {value(record,'Effective').replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3')} by <a href={value(record,'Url')} target="_blank" rel="noreferrer">{value(record,'Citation')}</a>.</p>
          {/if}
          {#if result.derived}<button class="secondary" onclick={() => selected = result.sentence}>Show sentence {result.sentence} in the evidence ladder</button>{/if}
          <details><summary>Prolog goal and engine result</summary><pre>{result.goal}</pre><p>{result.solutions.length} solutions.</p>{#each result.solutions as solution}<pre>{solution.display.Proof}</pre>{/each}</details>
        </article>
      {/each}
    {/if}
  </section>
  {#if results.some(r => r.derived)}
    <section class="ladder"><h2>Evidence for sentence {selected}</h2><ProvenanceLadder state={provenance} /></section>
  {/if}
  <footer>Development prototype. CDC guideline material is available free on the CDC website. CDC does not endorse this demo. This demo is not for clinical use.</footer>
</main>

<style>
  header, main { width: min(100% - 3rem, 72rem); margin-inline: auto; }
  header { display: flex; justify-content: space-between; align-items: center; padding-block: 1rem; }
  header span { font-weight: 700; }
  h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); margin-block: .6rem 1rem; }
  h2 { font-size: 1.35rem; margin-top: 0; }
  h3 { font-size: 1rem; margin: 0; }
  .intro { max-width: 65ch; }
  form { display: flex; align-items: flex-end; flex-wrap: wrap; gap: .7rem; margin-top: 1.7rem; }
  label { display: grid; gap: .35rem; font-weight: 700; }
  input { font: inherit; min-height: 2.75rem; padding: .4rem .65rem; color: var(--text); background: var(--surface-raised); border: 1px solid var(--border); color-scheme: light dark; }
  button { font: inherit; min-height: 2.75rem; padding: .55rem 1rem; cursor: pointer; color: var(--action-text); background: var(--action); border: 1px solid var(--action); border-radius: .25rem; }
  button[type=button], .secondary { color: var(--action); background: transparent; border-color: var(--border); }
  button:disabled { cursor: default; opacity: .6; }
  :is(input,button):focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
  .muted { color: var(--text-muted); font-size: .92rem; line-height: 1.5; max-width: 78ch; }
  .answer, .ladder { margin-block: 1.8rem; border: 1px solid var(--border); padding: clamp(1rem, 3vw, 2rem); background: var(--surface-raised); }
  .status { font-weight: 700; max-width: 70ch; }
  article { border-top: 1px solid var(--border); padding-block: 1.25rem; }
  article:last-child { padding-bottom: 0; }
  .statement-heading { display: flex; justify-content: space-between; gap: .5rem; }
  .statement-heading strong { color: var(--action); }
  .statement-heading .absent { color: var(--warn); }
  .statement { font-family: var(--font-prose); font-size: 1.1rem; line-height: 1.55; max-width: 75ch; }
  .supersession { font-size: .95rem; line-height: 1.5; max-width: 78ch; }
  details { margin-top: 1rem; }
  summary { cursor: pointer; color: var(--action); }
  a, a:visited { color: var(--action); }
  pre { overflow-wrap: anywhere; white-space: pre-wrap; font-size: .8rem; max-height: 15rem; overflow-y: auto; }
  footer { font-size: .85rem; color: var(--text-muted); padding-block: 1rem 3rem; max-width: 80ch; }
  @media(max-width: 500px) { header, main { width: calc(100% - 2rem); } form { gap: .5rem; } .statement-heading { flex-wrap: wrap; } .secondary { text-align: left; } }
</style>
