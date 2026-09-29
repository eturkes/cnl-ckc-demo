<script lang="ts">
  // Free-text intake: the description form, its two live regions and the result panel.
  // The regions are mounted from the first render for the reason `RunControls` gives
  // (ARIA22), and the result region stays mounted so `aria-busy` is readable mid-run.

  import { messages } from '../i18n/locale.svelte.js';

  import { MAX_CANDIDATE_LENGTH, MAX_CANDIDATES } from './chunker.js';
  import type { IntakeController, IntakeRow } from './IntakeController.svelte.js';
  import type { PainOption } from './request.js';
  import type { Gap, Match } from './select.js';

  type RevealResult = 'shown' | 'missing' | 'superseded' | 'unavailable';

  interface Props {
    intake: IntakeController;
    /** Runs the rule's prepared question and shows the solution its document derived. */
    onReveal: (row: IntakeRow) => Promise<RevealResult>;
  }

  let { intake, onReveal }: Props = $props();

  // Bounds the Worker's 2000 UTF-16 unit limit in the field itself; `maxlength` counts
  // the same code units.
  const MAX_DESCRIPTION = 2000;

  const uid = $props.id();
  const hintId = `${uid}-hint`;
  const headingId = `${uid}-heading`;
  const gapsId = `${uid}-gaps`;
  const t = $derived(messages.current);
  let description = $state('');
  let cancelled = $state(false);
  // The refusal KIND per row, rendered at display time so a note follows the locale.
  let notes = $state.raw<Readonly<Record<string, 'missing' | 'unavailable'>>>({});

  const view = $derived(intake.state);
  const busy = $derived(intake.busy);
  const canSubmit = $derived(description.trim() !== '' && !busy);

  const failure = $derived.by((): string => {
    if (view.kind !== 'failed') return '';
    const { TEXT } = t;
    switch (view.reason) {
      case 'rate-limited':
        return TEXT.intakeRateLimited();
      case 'stale':
        return TEXT.intakeStale();
      case 'server':
        return TEXT.intakeServer();
      case 'network':
        return TEXT.intakeNetwork();
      case 'invalid':
        return TEXT.intakeInvalid();
      case 'engine':
        return TEXT.intakeEngine();
    }
  });

  const derivedCount = $derived(
    view.kind === 'answered'
      ? view.rows.filter(({ result }) => result.status === 'derived').length
      : 0,
  );

  const status = $derived.by((): string => {
    const { TEXT } = t;
    switch (view.kind) {
      case 'idle':
        return cancelled ? TEXT.intakeCancelled() : '';
      case 'judging':
        return TEXT.intakeJudging();
      case 'deriving':
        return TEXT.intakeDeriving();
      case 'refused':
        return TEXT.intakeRefusedStatus();
      case 'no-match':
        return TEXT.intakeNoMatchStatus();
      case 'answered':
        return TEXT.intakeAnsweredStatus(derivedCount, view.rows.length);
      case 'failed':
        return '';
    }
  });

  const gaps = $derived<readonly Gap[]>(
    view.kind === 'answered' || view.kind === 'no-match' ? view.gaps : [],
  );
  const overflow = $derived(
    view.kind === 'answered' || view.kind === 'no-match' ? view.overflow : 0,
  );
  const rows = $derived<readonly IntakeRow[]>(view.kind === 'answered' ? view.rows : []);
  const pain = $derived.by((): string => {
    if (view.kind !== 'answered') return '';
    const { LABELS } = t;
    const names: Record<Exclude<PainOption, 'other'>, string> = {
      acute: LABELS.painAcute,
      subacute: LABELS.painSubacute,
      chronic: LABELS.painChronic,
      unstated: LABELS.painUnstated,
    };
    return view.pain === 'other' ? '' : t.TEXT.intakePain(names[view.pain]);
  });

  const trigger = (match: Match): string => {
    const score = match.trigger.value.toFixed(2);
    if (match.trigger.kind === 'condition') {
      const condition = intake.vocabulary.conditions.find(({ id }) => id === match.trigger.id);
      return t.TEXT.intakeCondition(condition?.text ?? match.trigger.id, score);
    }
    const section = intake.vocabulary.sections.find(({ id }) => id === match.trigger.id);
    return t.TEXT.intakeSection(section?.heading ?? match.trigger.id, score);
  };

  const outcome = (row: IntakeRow): string => {
    const { result } = row;
    const { TEXT } = t;
    switch (result.status) {
      case 'derived':
        return TEXT.intakeClauses(result.lines.length);
      case 'not-derived':
        return TEXT.intakeNotDerived();
      case 'limit':
        return TEXT.intakeLimit(result.limit);
      case 'error':
        return TEXT.intakeError(result.error.code, result.error.message);
      case 'cancelled':
        return TEXT.intakeRuleCancelled();
    }
  };

  const submit = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!canSubmit) return;
    cancelled = false;
    notes = {};
    void intake.submit(description);
  };

  const reveal = async (row: IntakeRow): Promise<void> => {
    const id = row.rule.id;
    notes = Object.fromEntries(Object.entries(notes).filter(([key]) => key !== id));
    const result = await onReveal(row);
    if (result === 'missing' || result === 'unavailable') notes = { ...notes, [id]: result };
  };

  const note = (kind: 'missing' | 'unavailable'): string =>
    kind === 'missing' ? t.TEXT.intakeRevealMissing() : t.TEXT.intakeRevealUnavailable();
</script>

<form class="intake" data-intake onsubmit={submit}>
  <label for="intake-description">{t.LABELS.intakeLabel}</label>
  <p class="hint" id={hintId}>
    {t.INSTRUCTIONS.intakeDescribe}
    {t.INSTRUCTIONS.intakePrivacy}
    {t.DESCRIPTIONS.intakeDisclosure}
  </p>
  <textarea
    id="intake-description"
    rows="4"
    maxlength={MAX_DESCRIPTION}
    aria-describedby={hintId}
    bind:value={description}></textarea>
  <div class="intake-controls">
    <button class="submit" type="submit" disabled={!canSubmit}>{t.LABELS.intakeSubmit}</button>
    <button
      class="cancel"
      type="button"
      data-intake-cancel
      disabled={!busy}
      onclick={() => {
        cancelled = true;
        intake.cancel();
      }}>{t.LABELS.intakeCancel}</button
    >
    {#if view.kind === 'failed'}
      <button class="retry" type="button" data-intake-retry onclick={() => void intake.retry()}
        >{t.LABELS.intakeRetry}</button
      >
    {/if}
  </div>
</form>

<p class="status" role="status" data-intake-status>{status}</p>
<p class="alert" role="alert" data-intake-alert>{failure}</p>

<section
  class="result"
  class:filled={view.kind !== 'idle' && !busy}
  data-intake-result
  aria-busy={busy}
  aria-label={view.kind === 'idle' || busy ? t.LABELS.intakeResults : undefined}
  aria-labelledby={view.kind === 'idle' || busy ? undefined : headingId}
>
  {#if view.kind === 'refused'}
    <h3 id={headingId} data-intake-outcome="refused">{t.LABELS.intakeRefusedHeading}</h3>
    <p>{t.DESCRIPTIONS.intakeRefused}</p>
  {:else if view.kind === 'no-match'}
    <!-- The judged gaps are the headline of a no-match (user ruling), so the heading names them. -->
    <h3 id={headingId} data-intake-outcome="no-match">{t.LABELS.intakeNoMatchHeading}</h3>
    {@render gapList(headingId)}
    <p>{t.DESCRIPTIONS.intakeNoMatch}</p>
  {:else if view.kind === 'answered'}
    <h3 id={headingId} data-intake-outcome="answered">{t.LABELS.intakeAnsweredHeading}</h3>
    <p>{t.DESCRIPTIONS.intakeAnswered}</p>
    {#if pain !== ''}
      <p class="meta">{pain}</p>
    {/if}
    {#if derivedCount === 0}
      <p class="none">{t.DESCRIPTIONS.intakeNoneDerived}</p>
    {/if}
    <ol class="rows">
      {#each rows as row (row.rule.id)}
        {@const refusal = notes[row.rule.id]}
        <li data-intake-row={row.rule.id}>
          {#if row.result.status === 'derived'}
            <p class="text" data-intake-text>{row.result.text}</p>
          {/if}
          <p class="meta">{outcome(row)}</p>
          <p class="meta">{trigger(row.match)}</p>
          <p class="meta">{t.TEXT.intakeDocument(row.rule.document)}</p>
          {#if row.result.status === 'derived'}
            <button type="button" class="reveal" data-intake-reveal onclick={() => void reveal(row)}
              >{t.LABELS.intakeReveal}</button
            >
          {/if}
          {#if refusal !== undefined}
            <p class="note" data-intake-reveal-note>{note(refusal)}</p>
          {/if}
        </li>
      {/each}
    </ol>
  {:else if view.kind === 'failed'}
    <h3 id={headingId} data-intake-outcome="failed">{t.LABELS.intakeFailedHeading}</h3>
    <p>{failure}</p>
  {/if}

  {#if view.kind === 'answered'}
    <div class="gaps">
      <p class="gaps-label" id={gapsId}>{t.LABELS.intakeGapsLabel}</p>
      {@render gapList(gapsId)}
    </div>
  {/if}
</section>

{#snippet gapList(labelledBy: string)}
  <p class="meta">
    {gaps.length > 0 ? t.DESCRIPTIONS.intakeGapsNote : t.DESCRIPTIONS.intakeNoGaps}
  </p>
  <ul data-intake-gaps aria-labelledby={labelledBy}>
    {#each gaps as gap (gap.start)}
      <li>{gap.text}</li>
    {/each}
  </ul>
  {#if overflow > 0}
    <p class="meta" data-intake-overflow>
      {t.TEXT.intakeOverflow(overflow, MAX_CANDIDATES, MAX_CANDIDATE_LENGTH)}
    </p>
  {/if}
{/snippet}

<p class="or-pick">{t.INSTRUCTIONS.intakeOrPick}</p>

<style>
  .intake {
    display: grid;
    gap: 0.5rem;
  }

  label,
  .gaps-label {
    margin: 0;
    color: var(--text);
    font-size: 0.86rem;
    font-weight: 650;
  }

  .hint,
  .meta,
  .or-pick {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 6rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
  }

  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .intake-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  button {
    min-height: 2.5rem;
    padding: 0.45rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.2rem;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    font-weight: 650;
    cursor: pointer;
  }

  button.submit {
    border-color: var(--action);
    background: var(--action);
    color: var(--action-text);
  }

  button.retry {
    border-color: var(--warn);
    background: var(--warn);
    color: var(--action-text);
  }

  button:disabled {
    border-color: var(--text-muted);
    background: transparent;
    color: var(--text-muted);
    opacity: 0.55;
    cursor: not-allowed;
  }

  .status,
  .alert {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .status {
    color: var(--text-muted);
  }

  .alert:not(:empty) {
    border-left: 3px solid var(--warn);
    padding-left: 0.6rem;
    color: var(--text);
  }

  .result.filled {
    margin-top: 0.75rem;
    border: 1px solid var(--border);
    padding: 1rem;
    background: var(--surface-sunken);
    color: var(--text);
    font-size: 0.86rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .result h3 {
    margin: 0 0 0.4rem;
    font-size: 1rem;
    font-weight: 650;
  }

  .result p {
    margin: 0 0 0.5rem;
  }

  .result .meta {
    margin: 0.15rem 0 0;
  }

  .rows {
    display: grid;
    gap: 0.75rem;
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }

  .text {
    font-weight: 600;
  }

  /* On --surface-sunken, --border measures 2.94:1 (light); --text-muted is the declared pair. */
  .reveal {
    border-color: var(--text-muted);
    margin-top: 0.4rem;
    min-height: 2rem;
    padding: 0.25rem 0.75rem;
  }

  .gaps {
    margin-top: 1.25rem;
  }

  .gaps ul {
    margin: 0.4rem 0 0;
    padding-left: 1.25rem;
  }

  .or-pick {
    margin: 1.25rem 0 0.75rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
</style>
