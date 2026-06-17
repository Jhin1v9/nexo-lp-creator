<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: stack = data.stack || '';
  $: fileCount = data.fileCount || 0;
</script>

<PhaseCardBase title="Gerando código" message={event?.message || 'Escrevendo HTML/CSS/JS...'} status={event?.status} icon="💻" {isGenerating}>
  <div class="flex items-center gap-2 text-[11px]">
    {#if stack}
      <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'}">
        Stack: {stack}
      </span>
    {/if}
    {#if fileCount}
      <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'}">
        {fileCount} arquivo{fileCount > 1 ? 's' : ''}
      </span>
    {/if}
  </div>
</PhaseCardBase>
