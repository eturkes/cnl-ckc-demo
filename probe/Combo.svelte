<script>
  import { Combobox } from 'bits-ui';

  const questions = [
    { value: 'category-a', label: 'Which recommendations have category A?' },
    { value: 'dose', label: 'What does the guideline say about dosage reduction?' },
    { value: 'evidence-1', label: 'Which recommendation has evidence type 1?' },
    { value: 'exists', label: 'Does a recommendation exist?' },
  ];
  let value = $state('');
  let open = $state(false);
</script>

<Combobox.Root type="single" items={questions} bind:value bind:open>
  <Combobox.Input readonly aria-label="Clinical question" onclick={() => (open = true)} />
  <Combobox.Portal>
    <Combobox.Content>
      {#each questions as question}
        <Combobox.Item value={question.value} label={question.label}>{question.label}</Combobox.Item>
      {/each}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
