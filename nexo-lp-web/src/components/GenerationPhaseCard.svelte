<script>
  export let event;

  const phaseConfig = {
    intention: { title: 'Definindo intenção', icon: '🎯' },
    structure: { title: 'Estrutura da página', icon: '🏗️' },
    code:      { title: 'Gerando código',      icon: '💻' },
    review:    { title: 'Revisão de qualidade', icon: '🔍' },
    preview:   { title: 'Preview pronto',       icon: '👁️' },
    thinking:  { title: 'Pensando',             icon: '💭' },
  };

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

    return phaseConfig.intention;
  }

  function formatJson(value) {
    if (value === null || value === undefined) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  function hasJsonPreview(result) {
    if (!result || typeof result !== 'object') return false;
    const keys = Object.keys(result);
    return keys.length > 0 && !keys.every((k) => ['html', 'css', 'js'].includes(k));
  }

  function resolveTags(result) {
    if (!result || typeof result !== 'object') return [];
    if (Array.isArray(result.sections)) {
      return result.sections
        .slice(0, 3)
        .map((s) => (typeof s === 'string' ? s : s?.type || s?.id || 'section'));
    }
    if (Array.isArray(result.tags)) return result.tags.slice(0, 3).map(String);
    if (Array.isArray(result.components)) return result.components.slice(0, 3).map(String);
    if (Array.isArray(result.files)) return result.files.slice(0, 3).map((f) => f?.path || String(f));
    return [];
  }

  $: phase = event?.phase || 'intention';
  $: config = resolveConfig(phase);
  $: data = event?.result || {};
  $: tags = resolveTags(data);
  $: status = event?.status || 'loading';
  $: statusColor = status === 'success' ? 'text-emerald-300' : status === 'error' ? 'text-red-300' : 'text-amber-300';
  $: statusIcon = status === 'success' ? '✓' : status === 'error' ? '!' : '⟳';
  $: statusText = status === 'success' ? 'concluído' : status === 'error' ? 'erro' : 'em andamento';
  $: jsonPreview = status === 'success' && hasJsonPreview(data) ? formatJson(data) : '';
</script>

<div class="flex gap-4 items-start w-full">
  <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-luna-primary/30 to-luna-purple/30 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
    <span class="text-lg">{config.icon}</span>
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <div class="font-semibold text-sm text-white tracking-tight truncate">{config.title}</div>
      <div class="phase-status text-[10px] font-semibold {statusColor} flex items-center gap-1" data-status={status}>
        {#if status === 'loading'}
          <span class="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
        {:else}
          <span>{statusIcon}</span>
        {/if}
        <span>{statusText}</span>
      </div>
    </div>
    <div class="text-xs text-white/55 mt-0.5">{event?.message || 'Processando...'}</div>
    {#if tags.length > 0}
      <div class="flex flex-wrap gap-1.5 mt-3">
        {#each tags as tag}
          <span class="text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/80 border border-white/5">{tag}</span>
        {/each}
      </div>
    {/if}
    {#if jsonPreview}
      <div class="mt-3 rounded-lg border border-white/10 bg-black/40 p-2 overflow-hidden">
        <div class="text-[10px] uppercase tracking-wider text-white/40 mb-1">JSON da Kimi</div>
        <pre class="text-[10px] text-emerald-300/90 font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all">{jsonPreview}</pre>
      </div>
    {/if}
  </div>
</div>
