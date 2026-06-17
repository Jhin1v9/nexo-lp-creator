<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: title = data.title || 'Definindo intenção';
  $: description = data.description || '';
  $: sections = Array.isArray(data.sections) ? data.sections : [];
  $: style = data.style || {};
  $: target = data.target || {};
</script>

<PhaseCardBase title={title} message={event?.message || 'Analisando requisitos...'} status={event?.status} icon="🎯" {isGenerating}>
  {#if description}
    <p class="leading-relaxed {isGenerating ? 'text-white/80' : 'text-luna-text-secondary'}">{description}</p>
  {/if}

  {#if sections.length > 0}
    <div class="mt-2 flex flex-wrap gap-1">
      {#each sections as section}
        <span class="px-2 py-0.5 rounded-full text-[10px] font-medium {isGenerating ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'}">
          {section}
        </span>
      {/each}
    </div>
  {/if}

  {#if style.tone || style.typography}
    <div class="mt-2 grid grid-cols-2 gap-2">
      {#if style.tone}
        <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
          <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Tom</div>
          <div class="capitalize">{style.tone}</div>
        </div>
      {/if}
      {#if style.typography}
        <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
          <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Tipografia</div>
          <div class="capitalize">{style.typography}</div>
        </div>
      {/if}
    </div>
  {/if}

  {#if target.audience}
    <div class="mt-2 text-[11px] {isGenerating ? 'text-white/60' : 'text-luna-text-muted'}">
      Público: <span class="font-medium">{target.audience}</span> · Objetivo: <span class="font-medium">{target.purpose || '—'}</span>
    </div>
  {/if}
</PhaseCardBase>
