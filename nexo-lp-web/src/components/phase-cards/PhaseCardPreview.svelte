<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;
</script>

<PhaseCardBase title="Preview pronto" message={event?.message || 'Salvando preview...'} status={event?.status} icon="👁️" {isGenerating}>
  {#if event?.status === 'success'}
    <div class="text-[11px] {isGenerating ? 'text-emerald-300' : 'text-emerald-600'}">
      Preview salvo com sucesso.
    </div>
  {/if}
</PhaseCardBase>
