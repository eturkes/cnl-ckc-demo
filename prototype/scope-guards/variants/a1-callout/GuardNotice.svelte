<script lang="ts">
  import type { DemoController } from '../../../../src/demo/DemoController.svelte.js';
  import type { PlSolution } from '../../../../src/engine/protocol.js';
  import type { PlTerm } from '../../../../src/engine/terms.js';
  import { loadEvidenceDocument } from '../../../../src/provenance/assets.js';

  let { demo, question, showSupersession }: { demo: DemoController; question: string; showSupersession: boolean } = $props();
  const supersessionGoal = "guideline_supersession(D,S,source(C,U),Date), sub_atom_icasechk(D,0,'cdc2022-opioid-rec12-')";
  const exclusionGoal = "clause(guideline_exclusion('cdc-2022-opioid'),Body)";
  type Statement = { document: string; sentence: number; text: string; citation?: string; url?: string; date?: string };
  let superseded = $state<Statement[]>([]);
  let exclusions = $state<Statement[]>([]);
  let reads = $state<{goal: string; solutions: PlSolution[]; status: string}[]>([]);
  let status = $state('Reading the knowledge base…');
  let started = false;
  const scalar = (term?: PlTerm) => term && 'value' in term ? String(term.value) : '';
  const dateText = (raw: string) => /^\d{8}$/.test(raw) ? new Date(`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T12:00:00Z`).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}) : raw;
  const words = (value: string) => value.replaceAll('-', ' ');
  const key = (term?: PlTerm) => term?.kind === 'variable' ? `v${term.id}` : scalar(term);
  function conjuncts(term: PlTerm): PlTerm[] {
    if(term.kind === 'compound' && term.functor === ':') return conjuncts(term.args[1]);
    if(term.kind === 'compound' && term.functor === ',') return term.args.flatMap(conjuncts);
    return [term];
  }
  function condition(term: PlTerm, inherited = new Map<string,string>()): string {
    const literals = conjuncts(term).filter(item => item.kind === 'compound');
    const nouns = new Map(inherited);
    for(const item of literals) if(item.functor === 'guideline_entity') nouns.set(key(item.args[1]), words(scalar(item.args[2])));
    const events = new Map<string,string>();
    const comparisons = literals.filter(item=>item.functor==='guideline_satisfies');
    const quantity = comparisons.map(item=>item.args.map(scalar).filter(Boolean).map(value=>value==='less' ? 'less than' : words(value)).join(' ')).join('; ');
    for(const item of literals) if(item.functor === 'guideline_event') {
      const roles = literals.filter(arg=>arg.functor==='guideline_arg' && key(arg.args[1])===key(item.args[1]));
      const role = (number: string) => {
        const arg=roles.find(arg=>scalar(arg.args[2])===number);
        return arg ? nouns.get(key(arg.args[3])) ?? quantity : '';
      };
      const pp = literals.filter(pp=>pp.functor==='guideline_pp' && key(pp.args[1])===key(item.args[1])).map(pp=>`${words(scalar(pp.args[2]))} ${nouns.get(key(pp.args[3])) ?? ''}`).join(' ');
      const lemma=words(scalar(item.args[2]));
      const verb=lemma==='have' ? 'has' : `${lemma}s`;
      events.set(key(item.args[1]), `${role('1')} ${verb} ${role('2')} ${pp}`.trim());
    }
    const negatives = literals.filter(item=>item.functor==='\\+').map(item=>`it is not provable that (${condition(item.args[0],nouns)})`);
    return [...events.values(), ...negatives].filter(Boolean).join(' and ');
  }
  async function wording(document: string, sentence: number) {
    const evidence = await loadEvidenceDocument(document);
    return evidence.ace.sentences.find(item => item.number === sentence)?.text ?? `${document}, sentence ${sentence}`;
  }
  async function read(goal: string) {
    const result = await demo.runGoal(goal);
    const solutions = result && 'solutions' in result ? result.solutions : [];
    reads = [...reads, {goal, solutions, status: result?.kind ?? 'unavailable'}];
    if (result?.kind !== 'solutions') throw new Error(`Notice query stopped: ${result?.kind ?? 'unavailable'}`);
    return solutions;
  }
  async function load() {
    try {
      const results = showSupersession ? await read(supersessionGoal) : [];
      superseded = await Promise.all(results.map(async ({bindings:b}) => {
        const document = scalar(b.D), sentence = Number(scalar(b.S));
        return {document,sentence,text:await wording(document,sentence),citation:scalar(b.C),url:scalar(b.U),date:dateText(scalar(b.Date))};
      }));
      const scope = await read(exclusionGoal);
      exclusions = scope.map(({bindings:b},index) => ({document:'Live scope rule',sentence:index+1,text:b.Body ? condition(b.Body) : 'Condition unavailable'}));
      status = '';
    } catch(error) { status = error instanceof Error ? error.message : String(error); }
  }
  $effect(() => {
    if(!started && question !== '') { started = true; void load(); }
  });
</script>

{#snippet goalDisclosure()}
  <details class="notice-goals" data-notice-goals>
    <summary>Prolog goal behind this notice</summary>
    <p>These are the goals and the engine’s verbatim solutions. The scope goal reads recorded conditions; it does not assert that they hold for a patient.</p>
    {#each reads as entry}
      <code>{entry.goal}</code>
      <p class="read-status">Outcome: {entry.status} · {entry.solutions.length} solutions</p>
      <ol>{#each entry.solutions as solution}<li>{#each Object.entries(solution.display) as [name,value]}<code>{name} = {value}</code>{/each}</li>{/each}</ol>
    {/each}
  </details>
{/snippet}

{#if showSupersession}
<aside class="scope-notice" aria-labelledby="supersession-heading" data-variant="a1-callout">
  <h3 id="supersession-heading">Some source statements have been superseded</h3>
  <p class="intro">The statements below are not part of the answer above. The knowledge base records a later source for them.</p>
  {#if status}<p role="status">{status}</p>{/if}
  {#if superseded.length}
    <p class="supersession-date">Superseded from {superseded[0].date} by <a href={superseded[0].url} target="_blank" rel="noreferrer">{superseded[0].citation}</a>.</p>
    <ol class="superseded-statements">
      {#each superseded as item}
        <li><p>{item.text}</p><small>{item.document}, sentence {item.sentence}</small></li>
      {/each}
    </ol>
    <p class="wording-note">Statement wording: the source document’s controlled-language sentence in the provenance record. Supersession, date and citation: live Prolog results.</p>
  {/if}
  {@render goalDisclosure()}
</aside>
{/if}
{#if status && !showSupersession}<p role="status">{status}</p>{/if}
{#if exclusions.length}
  <details class="scope-exclusions">
    <summary>These recommendations do not apply when …</summary>
    <p>The knowledge base records these scope conditions for this guideline. Their absence is not proof that a patient belongs to the guideline’s population. This demo supplies no patient facts that trigger them.</p>
    {#if !showSupersession}{@render goalDisclosure()}{/if}
    <ul>{#each exclusions as item}<li><p>{item.text}</p><small>Live scope rule {item.sentence}</small></li>{/each}</ul>
    <p class="wording-note">Condition wording is a compact rendering of the live clause bodies, not a source quotation. Every verb, noun and comparison comes from that result. The raw bodies remain in the Prolog disclosure. Repeated scope rules remain visible.</p>
  </details>
{/if}

<style>
  .scope-notice {max-width:52rem; margin:1.4rem 0 0; border:1px solid var(--border); border-left:3px solid var(--warn); padding:1rem 1.15rem; background:var(--surface-sunken); font-size:.85rem; line-height:1.55; overflow-wrap:anywhere;}
  h3 {margin:0 0 .45rem; font-size:1rem; font-weight:650;}
  p {margin:.5rem 0;}
  .intro,.wording-note,small,.read-status {color:var(--text-muted);}
  .intro {margin-top:0;}
  .supersession-date {margin:.9rem 0;}
  a,summary {color:var(--action);}
  ol,ul {padding-left:1.25rem; margin:.65rem 0;}
  .superseded-statements {display:grid; gap:.7rem;}
  .superseded-statements p {margin:0;}
  small {font-size:.7rem;}
  .wording-note {font-size:.72rem; margin-top:.9rem;}
  summary {cursor:pointer; font-weight:650;}
  .notice-goals {margin-top:1rem; font-size:.75rem;}
  .notice-goals code {display:block; font-family:var(--font-code); font-size:.68rem; white-space:pre-wrap; overflow-wrap:anywhere;}
  .notice-goals li {margin-bottom:.6rem;}
  .scope-exclusions {max-width:52rem;margin-top:.9rem;font-size:.8rem;line-height:1.55;overflow-wrap:anywhere;}
  .scope-exclusions li {margin-bottom:.75rem;}
  summary:focus-visible {outline:2px solid var(--focus-ring);outline-offset:3px;}
  @media(max-width:34rem) {.scope-notice{padding:.85rem;}}
</style>
