<script>
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  const phaseConfig = {
    intention: { title: 'Definindo intenção', icon: '🎯' },
    structure: { title: 'Estrutura da página', icon: '🏗️' },
    code:      { title: 'Gerando código',      icon: '💻' },
    review:    { title: 'Revisão de qualidade', icon: '🔍' },
    preview:   { title: 'Preview pronto',       icon: '👁️' },
    thinking:  { title: 'Pensando',             icon: '💭' },
  };

  export let event;

  let expanded = false;
  let showRaw = false;

  function resolveConfig(phase) {
    if (phaseConfig[phase]) return phaseConfig[phase];

    const fixMatch = phase.match(/^fix-(\d+)$/);
    if (fixMatch) {
      return { title: `Corrigindo código (tentativa ${fixMatch[1]})`, icon: '🔧' };
    }

    const reReviewMatch = phase.match(/^re-review-(\d+)$/);
    if (reReviewMatch) {
      return { title: `Revisando correções (tentativa ${reReviewMatch[1]})`, icon: '🔍' };
    }

    const reviewRetryMatch = phase.match(/^review-retry-(\d+)$/);
    if (reviewRetryMatch) {
      return { title: `Revisão de qualidade (tentativa ${reviewRetryMatch[1]})`, icon: '🔍' };
    }

    return { title: phase.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), icon: '⚙️' };
  }

  function resolveTags(result) {
    if (!result || typeof result !== 'object') return [];
    if (Array.isArray(result.sections)) {
      return result.sections
        .slice(0, 4)
        .map((s) => (typeof s === 'string' ? s : s?.type || s?.id || 'section'));
    }
    if (Array.isArray(result.tags)) return result.tags.slice(0, 4).map(String);
    if (Array.isArray(result.components)) return result.components.slice(0, 4).map(String);
    if (Array.isArray(result.files)) return result.files.slice(0, 4).map((f) => f?.path || String(f));
    return [];
  }

  function resolveSummary(result) {
    if (!result || typeof result !== 'object') return '';
    if (typeof result.summary === 'string') return result.summary;
    if (typeof result.description === 'string') return result.description;
    if (typeof result.message === 'string') return result.message;
    if (Array.isArray(result.issues)) return `${result.issues.length} issue(s) encontradas`;
    if (Array.isArray(result.files)) return `${result.files.length} arquivo(s)`;
    if (Array.isArray(result.sections)) return `${result.sections.length} seção(ões)`;
    return '';
  }

  function getKeyValuePairs(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
    return Object.entries(result)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && !['sections', 'files', 'issues', 'suggestions', 'components'].includes(k))
      .slice(0, 6);
  }

  function formatValue(value) {
    if (Array.isArray(value)) return `${value.length} itens`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function formatJson(value) {
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  $: phase = event?.phase || 'intention';
  $: config = resolveConfig(phase);
  $: data = event?.result || {};
  $: tags = resolveTags(data);
  $: summary = resolveSummary(data);
  $: pairs = getKeyValuePairs(data);
  $: status = event?.status || 'loading';
  $: statusColor = status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-red-300' : 'text-amber-300';
  $: statusIcon = status === 'success' ? '✓' : status === 'error' ? '!' : '⟳';
  $: statusText = status === 'success' ? 'concluído' : status === 'error' ? 'erro' : 'em andamento';
</script>

<div class="flex gap-4 items-start w-full">
  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-luna-primary/30 to-luna-purple/30 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
    <span class="text-lg">{config.icon}</span>
  </div>
  <div class="flex-1 min-w-0">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 text-left group"
      on:click={() => expanded = !expanded}
      aria-expanded={expanded}
    >
      <div>
        <div class="font-semibold text-sm text-white tracking-tight truncate">{config.title}</div>
        <div class="text-xs text-white/55 mt-0.5">{event?.message || 'Processando...'}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="phase-status text-[10px] font-semibold {statusColor} flex items-center gap-1" data-status={status}>
          {#if status === 'loading'}
            <span class="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
          {:else}
            <span>{statusIcon}</span>
          {/if}
          <span>{statusText}</span>
        </div>
        <div class="text-white/50 transition-transform duration-200 {expanded ? 'rotate-180' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>
    </button>

    {#if tags.length > 0}
      <div class="flex flex-wrap gap-1.5 mt-3">
        {#each tags as tag}
          <span class="text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/80 border border-white/5">{tag}</span>
        {/each}
      </div>
    {/if}

    {#if expanded}
      <div class="mt-3 space-y-3" transition:slide={{ duration: 250, easing: quintOut }}>
        {#if summary}
          <p class="text-xs leading-relaxed text-white/75">{summary}</p>
        {/if}

        {#if pairs.length > 0}
          <div class="grid grid-cols-2 gap-2">
            {#each pairs as [key, value]}
              <div class="rounded-lg p-2 bg-white/10">
                <div class="text-[10px] uppercase tracking-wide text-white/50 truncate">{key}</div>
                <div class="text-[11px] font-medium text-white truncate">{formatValue(value)}</div>
              </div>
            {/each}
          </div>
        {/if}

        <button
          type="button"
          class="text-[10px] underline text-white/40 hover:text-white/70"
          on:click|stopPropagation={() => showRaw = !showRaw}
        >
          {showRaw ? 'Ocultar JSON bruto' : 'Ver JSON bruto'}
        </button>

        {#if showRaw}
          <div class="rounded-lg border border-white/10 bg-black/40 p-2 overflow-hidden">
            <pre class="text-[10px] text-emerald-300/90 font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all">{formatJson(data)}</pre>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
