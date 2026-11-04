<script lang="ts">
  import type { Rule, Sentence } from '../../shared/data.js';
  let { rule, sentence, compact = false }: { rule?: Rule; sentence?: Sentence; compact?: boolean } = $props();
  const conditions = $derived((rule?.condition ?? sentence?.condition ?? '').split(' and ').filter(Boolean));
  const mode = $derived(rule?.mode ?? sentence?.modal ?? 'fact');
  const negative = $derived(rule ? rule.actions.some(a => a.polarity === 'negative') : sentence?.negated);
  const clean = (s: string) => s.replaceAll('-', ' ');
</script>

<div class:compact class="flow">
  <div class="inputs">
    <span class="role">When {conditions.length > 1 ? 'all hold' : ''}</span>
    {#if conditions.length === 0}<div class="box">No condition stated</div>{/if}
    {#each conditions as condition, i}
      {#if i > 0}<span class="and">AND</span>{/if}
      <div class="box">{clean(condition)}</div>
    {/each}
    {#if !compact && conditions.length > 1}<small>AND groups are a text reading.</small>{/if}
  </div>
  <div class="connector" aria-hidden="true">→</div>
  <div class="gate"><span>{mode === 'fact' ? 'states' : mode}</span>{#if negative}<strong>NOT</strong>{/if}</div>
  <div class="connector" aria-hidden="true">→</div>
  <div class="outputs">
    <span class="role">{rule ? clean(rule.subject) : 'Text reading, not a clinical parse'}</span>
    {#if rule}
      {#each rule.actions as action}
        <div class="box action"><b>{action.qualifiers.filter((q): q is string => typeof q === 'string').map(clean).join(' ')} {clean(action.verb)}</b> {[clean(action.object), ...action.modifiers.map((m) => `${m.preposition} ${clean(m.value)}`)].join(' ')}</div>
      {/each}
    {:else if sentence}<div class="box action">{clean(sentence.conclusion)}</div>{/if}
  </div>
</div>

<style>
  .flow{display:grid;grid-template-columns:minmax(0,1fr) 32px 92px 32px minmax(0,1fr);gap:10px;align-items:center;padding:24px 0}.inputs,.outputs{min-width:0}.role{display:block;color:var(--text-muted);font-size:13px;margin-bottom:8px}.box{border:1px solid var(--border);background:var(--surface-raised);padding:12px 16px;overflow-wrap:anywhere;line-height:1.5}.action{border-left:4px solid var(--action);margin-bottom:8px}.gate{background:var(--action);color:var(--action-text);border-radius:50%;width:92px;min-height:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;line-height:1.25}.gate strong{font-size:16px}.connector{font-size:28px;color:var(--text-muted);text-align:center}.and{display:block;text-align:center;font-size:11px;color:var(--text-muted);padding:3px}.compact{grid-template-columns:minmax(0,1fr) 18px 54px 18px minmax(0,1fr);gap:6px;padding:12px 0;font-size:12px}.compact .gate{width:54px;min-height:54px;font-size:14px}.compact .gate strong{font-size:11px}.compact .box{padding:8px}.compact .role{font-size:11px}.compact .connector{font-size:20px}.compact .and{padding:0}small{font-size:12px;color:var(--text-muted)}
  @media(max-width:650px){.flow,.compact{grid-template-columns:1fr;gap:6px;padding:12px 0}.connector{transform:rotate(90deg);font-size:24px;line-height:1}.gate,.compact .gate{justify-self:center;width:74px;min-height:74px;font-size:18px}.compact .role{font-size:12px}.compact{font-size:14px}.compact .box{padding:10px}.and{padding:2px}}
</style>
