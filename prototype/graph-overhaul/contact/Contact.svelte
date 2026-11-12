<script lang="ts">
  import Thumb from './Thumb.svelte';
  import { VARIANTS } from './variants.js';

  const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
  const href = (id: string, hash = '#overview') => `./variants/${id}/?theme=${theme}${hash}`;
  const groups = [
    { label: 'Round 5: the combined pick', items: VARIANTS.filter((v) => v.round === 5) },
    { label: 'Round 4: where to start + colour', items: VARIANTS.filter((v) => v.round === 4) },
    { label: 'Round 3: the picked network', items: VARIANTS.filter((v) => v.round === 3) },
  ];
</script>

<main class="contact">
  <header>
    <h1>Graph overhaul: the clinical concept network</h1>
    <p>
      Each variant draws the same guideline data with a different model of what a node and an edge
      mean. Open one to try the four jobs: trace an answer, explore the knowledge base, see the
      guideline's shape, and explain one rule. These are prototypes: they read statements derived
      offline from the knowledge base, and the demo derives them live by Prolog.
    </p>
    <p><a href={`?theme=${theme === 'dark' ? 'light' : 'dark'}`}>Show the {theme === 'dark' ? 'light' : 'dark'} theme</a></p>
  </header>
  {#each groups as group (group.label)}
    <h2>{group.label}</h2>
    <ul class="grid">
      {#each group.items as v (v.id)}
        <li>
          <Thumb title={`${v.title}, overview`} src={href(v.id)} />
          <h3><a href={href(v.id)}>{v.title}</a></h3>
          <p>{v.premise}</p>
          <dl>
            <dt>Node</dt><dd>{v.node}</dd>
            <dt>Edge</dt><dd>{v.edge}</dd>
          </dl>
          <p class="states">
            Try: <a href={href(v.id, '#trace=starting-opioid-therapy')}>a traced answer</a>,
            <a href={href(v.id, '#rule=cdc2022-opioid-rec01:5')}>one rule</a>,
            <a href={href(v.id, '#explore=naloxone')}>a search</a>
          </p>
          <code>{v.id}</code>
        </li>
      {/each}
    </ul>
  {/each}
</main>

<style>
  .contact { max-width: 88rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; color: var(--text); }
  header p { max-width: 70ch; }
  .grid { list-style: none; padding: 0; display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr)); }
  li { border-top: 2px solid var(--border); padding-top: 0.75rem; min-width: 0; }
  h3 { margin: 0.75rem 0 0.25rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.1rem 0.75rem; margin: 0.5rem 0; }
  dt { color: var(--text-muted); }
  dd { margin: 0; }
  .states { color: var(--text-muted); }
  code { color: var(--text-muted); font-size: 0.85em; }
  a { color: var(--action); }
  a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
</style>
