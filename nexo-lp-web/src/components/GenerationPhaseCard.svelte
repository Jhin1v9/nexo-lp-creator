<script>
  export let event;

  const phaseConfig = {
    intention: { title: 'Definindo intenção', icon: '🎯' },
    structure: { title: 'Estrutura da página', icon: '🏗️' },
    code:      { title: 'Gerando código',      icon: '💻' },
    review:    { title: 'Revisão de qualidade', icon: '🔍' },
    preview:   { title: 'Preview pronto',       icon: '👁️' },
  };

  $: phase = event?.phase || 'intention';
  $: config = phaseConfig[phase] || phaseConfig.intention;
  $: data = event?.result || {};
  $: tags = Array.isArray(data.sections)
    ? data.sections.slice(0, 3)
    : Array.isArray(data.tags)
      ? data.tags.slice(0, 3)
      : [];
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
  </div>
</div>
