<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: description = data.description || '';
  $: sections = Array.isArray(data.sections) ? data.sections : [];
  $: style = data.style || {};
  $: colors = style.colors || {};
  $: target = data.target || {};

  function sectionLabel(section) {
    if (typeof section === 'string') return section;
    if (section && typeof section === 'object') {
      return section.type || section.id || section.name || JSON.stringify(section);
    }
    return String(section);
  }

  function getColorEntries(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).filter(([, v]) => v && typeof v === 'string');
  }
</script>

<PhaseCardBase
  title={data.title || 'Definindo intenção'}
  message={event?.message || 'Analisando requisitos...'}
  status={event?.status}
  icon="🎯"
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  <div class="space-y-3">
    {#if data.title}
      <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
        <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Título do projeto</div>
        <div class="font-semibold text-sm mt-0.5">{data.title}</div>
      </div>
    {/if}

    {#if description}
      <p class="leading-relaxed {isGenerating ? 'text-white/80' : 'text-luna-text-secondary'}">{description}</p>
    {/if}

    {#if getColorEntries(colors).length > 0}
      <div class="flex flex-wrap items-center gap-2">
        {#each getColorEntries(colors) as [name, value]}
          <div class="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 border {isGenerating ? 'border-white/10 bg-white/5' : 'border-luna-border bg-luna-surface'}">
            <span class="w-4 h-4 rounded-full border border-white/10 shadow-sm" style="background-color: {value};"></span>
            <span class="text-[10px] capitalize">{name}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if sections.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Seções planejadas</div>
        <div class="flex flex-wrap gap-1.5">
          {#each sections as section}
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium {isGenerating ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'}">
              {sectionLabel(section)}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if style.tone || style.typography || target.audience || target.purpose}
      <div class="grid grid-cols-2 gap-2">
        {#if style.tone}
          <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
            <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Tom</div>
            <div class="capitalize text-xs font-medium">{style.tone}</div>
          </div>
        {/if}
        {#if style.typography}
          <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
            <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Tipografia</div>
            <div class="capitalize text-xs font-medium">{style.typography}</div>
          </div>
        {/if}
        {#if target.audience}
          <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
            <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Público</div>
            <div class="text-xs font-medium">{target.audience}</div>
          </div>
        {/if}
        {#if target.purpose}
          <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
            <div class="text-[10px] uppercase tracking-wide {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Objetivo</div>
            <div class="text-xs font-medium">{target.purpose}</div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</PhaseCardBase>
