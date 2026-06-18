<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  const phaseConfig = {
    intention: { title: 'Definindo intenção', icon: '🎯' },
    structure: { title: 'Estrutura da página', icon: '🏗️' },
    code:      { title: 'Gerando código',      icon: '💻' },
    review:    { title: 'Revisão de qualidade', icon: '🔍' },
    preview:   { title: 'Preview pronto',       icon: '👁️' },
    thinking:  { title: 'Pensando',             icon: '💭' },
  };

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

  function formatJson(value) {
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  function resolveSummary(data) {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    if (data.summary) return data.summary;
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.issues)) return `${data.issues.length} issue(s)`;
    if (Array.isArray(data.files)) return `${data.files.length} arquivo(s)`;
    if (Array.isArray(data.sections)) return `${data.sections.length} seção(ões)`;
    return '';
  }

  function getKeyValuePairs(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    return Object.entries(data)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .slice(0, 8);
  }

  function formatValue(value) {
    if (Array.isArray(value)) return `${value.length} itens`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  $: phase = event?.phase || 'generic';
  $: config = resolveConfig(phase);
  $: data = event?.result || {};
  $: summary = resolveSummary(data);
  $: pairs = getKeyValuePairs(data);
  $: jsonPreview = formatJson(data);
</script>

<PhaseCardBase
  title={config.title}
  message={event?.message || 'Processando...'}
  status={event?.status}
  icon={config.icon}
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  <div class="space-y-3">
    {#if summary}
      <p class="text-[11px] leading-relaxed {isGenerating ? 'text-white/80' : 'text-luna-text-secondary'}">{summary}</p>
    {/if}

    {#if pairs.length > 0}
      <div class="grid grid-cols-2 gap-2">
        {#each pairs as [key, value]}
          <div class="rounded-lg p-2 {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
            <div class="text-[10px] uppercase tracking-wide truncate {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">{key}</div>
            <div class="text-[11px] font-medium truncate">{formatValue(value)}</div>
          </div>
        {/each}
      </div>
    {/if}

    {#if jsonPreview}
      <button
        type="button"
        class="text-[10px] underline {isGenerating ? 'text-white/40 hover:text-white/70' : 'text-luna-text-muted hover:text-luna-text'}"
        on:click={() => showRaw = !showRaw}
      >
        {showRaw ? 'Ocultar JSON bruto' : 'Ver JSON bruto'}
      </button>

      {#if showRaw}
        <div class="mt-2 rounded-lg border {isGenerating ? 'border-white/10 bg-black/40' : 'border-luna-border bg-luna-surface'} p-2 overflow-hidden">
          <pre class="text-[10px] {isGenerating ? 'text-emerald-300/90' : 'text-emerald-700'} font-mono max-h-40 overflow-auto whitespace-pre-wrap break-all">{jsonPreview}</pre>
        </div>
      {/if}
    {/if}
  </div>
</PhaseCardBase>
