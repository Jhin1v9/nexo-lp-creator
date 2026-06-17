<script>
  import { isGenerating } from '../stores.js';
  import PhaseCardIntention from './phase-cards/PhaseCardIntention.svelte';
  import PhaseCardStructure from './phase-cards/PhaseCardStructure.svelte';
  import PhaseCardCode from './phase-cards/PhaseCardCode.svelte';
  import PhaseCardReview from './phase-cards/PhaseCardReview.svelte';
  import PhaseCardPreview from './phase-cards/PhaseCardPreview.svelte';

  export let events = [];

  // Keep only the latest event per phase
  $: latestByPhase = events.reduce((acc, event) => {
    if (!event.phase) return acc;
    const existing = acc[event.phase];
    if (!existing || event.timestamp > existing.timestamp) {
      acc[event.phase] = event;
    }
    return acc;
  }, {});

  $: orderedPhases = ['intention', 'structure', 'code', 'review', 'preview'];
</script>

<div class="flex flex-col gap-2 w-full">
  {#each orderedPhases as phase}
    {#if latestByPhase[phase]}
      {#if phase === 'intention'}
        <PhaseCardIntention event={latestByPhase[phase]} isGenerating={$isGenerating} />
      {:else if phase === 'structure'}
        <PhaseCardStructure event={latestByPhase[phase]} isGenerating={$isGenerating} />
      {:else if phase === 'code'}
        <PhaseCardCode event={latestByPhase[phase]} isGenerating={$isGenerating} />
      {:else if phase === 'review'}
        <PhaseCardReview event={latestByPhase[phase]} isGenerating={$isGenerating} />
      {:else if phase === 'preview'}
        <PhaseCardPreview event={latestByPhase[phase]} isGenerating={$isGenerating} />
      {/if}
    {/if}
  {/each}
</div>
