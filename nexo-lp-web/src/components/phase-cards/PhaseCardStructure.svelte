<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: layout = data.layout || 'single-page';
  $: sections = Array.isArray(data.sections) ? data.sections : [];
  $: navigation = data.navigation;
  $: breakpoints = Array.isArray(data.responsive_breakpoints) ? data.responsive_breakpoints : [];

  function componentLabel(component) {
    return typeof component === 'string' ? component : component?.type || component?.id || JSON.stringify(component);
  }
</script>

<PhaseCardBase
  title="Estrutura da página"
  message={event?.message || 'Desenhando seções...'}
  status={event?.status}
  icon="🏗️"
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2 text-[11px]">
      <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}">
        Layout: {layout}
      </span>
      {#if navigation !== undefined}
        <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}">
          Navegação: {navigation ? 'sim' : 'não'}
        </span>
      {/if}
      {#each breakpoints as bp}
        <span class="px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">
          {bp}
        </span>
      {/each}
    </div>

    {#if sections.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Seções</div>
        <div class="space-y-1.5">
          {#each sections as section}
            <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium truncate">#{section.order || '?'} {section.id || section.type || 'section'}</span>
                {#if section.type}
                  <span class="text-[10px] {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">{section.type}</span>
                {/if}
              </div>
              {#if Array.isArray(section.components) && section.components.length > 0}
                <div class="mt-1.5 flex flex-wrap gap-1">
                  {#each section.components as component}
                    <span class="text-[10px] px-1.5 py-0.5 rounded {isGenerating ? 'bg-white/10 text-white/80' : 'bg-white text-luna-text-secondary border border-luna-border'}">
                      {componentLabel(component)}
                    </span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</PhaseCardBase>
