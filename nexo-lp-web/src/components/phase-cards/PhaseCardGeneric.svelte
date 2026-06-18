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

  $: phase = event?.phase || 'generic';
  $: config = resolveConfig(phase);
  $: data = event?.result || {};
  $: jsonPreview = event?.status === 'success' && data && typeof data === 'object' && Object.keys(data).length > 0 ? formatJson(data) : '';
</script>

<PhaseCardBase title={config.title} message={event?.message || 'Processando...'} status={event?.status} icon={config.icon} {isGenerating}>
  {#if jsonPreview}
    <div class="mt-2 rounded-lg border {isGenerating ? 'border-white/10 bg-black/40' : 'border-luna-border bg-luna-surface'} p-2 overflow-hidden">
      <div class="text-[10px] uppercase tracking-wider {isGenerating ? 'text-white/40' : 'text-luna-text-muted'} mb-1">JSON da Kimi</div>
      <pre class="text-[10px] {isGenerating ? 'text-emerald-300/90' : 'text-emerald-700'} font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all">{jsonPreview}</pre>
    </div>
  {/if}
</PhaseCardBase>
