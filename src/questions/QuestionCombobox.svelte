<script lang="ts">
  import { Combobox } from 'bits-ui';

  import {
    isQuestionId,
    QUESTION_CATALOG,
    QUESTION_IDS,
    type QuestionId,
  } from './catalog.js';

  interface Props {
    selected: QuestionId;
    onSelect: (id: QuestionId) => void;
  }

  let { selected, onSelect }: Props = $props();
  let open = $state(false);

  const labelId = 'question-combobox-label';
  const inputId = 'question-combobox-input';
  const listboxId = 'question-combobox-listbox';
  const items = QUESTION_IDS.map((id) => ({ value: id, label: QUESTION_CATALOG[id].question }));
  const select = (value: string): void => {
    if (isQuestionId(value)) onSelect(value);
  };
</script>

<div data-question-intake>
  <label id={labelId} for={inputId}>Question</label>
  <div data-question-control>
    <Combobox.Root
      type="single"
      value={selected}
      inputValue={QUESTION_CATALOG[selected].question}
      {items}
      allowDeselect={false}
      bind:open
      onValueChange={select}
    >
      <Combobox.Input
        id={inputId}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        readonly
      />
      <Combobox.Trigger aria-label="Toggle questions">▾</Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Content id={listboxId} aria-labelledby={labelId} sideOffset={4}>
          <Combobox.Viewport>
            {#each items as item (item.value)}
              <Combobox.Item id={`question-option-${item.value}`} value={item.value} label={item.label}>
                {item.label}
              </Combobox.Item>
            {/each}
          </Combobox.Viewport>
        </Combobox.Content>
      </Combobox.Portal>
    </Combobox.Root>
  </div>
</div>
