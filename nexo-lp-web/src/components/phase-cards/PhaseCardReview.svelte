<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: score = typeof data.score === 'number' ? data.score : null;
  $: passed = data.passed;
  $: issues = Array.isArray(data.issues) ? data.issues : [];
  $: suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  function scoreColor(s) {
    if (s >= 80) return 'text-emerald-400';
    if (s >= 60) return 'text-amber-400';
    return 'text-red-400';
  }
</script>

<PhaseCardBase title="Revisão de qualidade" message={event?.message || 'Verificando código gerado...'} status={event?.status} icon="🔍" {isGenerating}>
  {#if score !== null}
    <div class="flex items-center gap-3">
      <div class="text-2xl font-bold {scoreColor(score)}">{score}</div>
      <div class="text-[11px] {isGenerating ? 'text-white/60' : 'text-luna-text-muted'}">
        {passed ? 'Aprovado' : 'Revisar pontos abaixo'}
      </div>
    </div>
  {/if}

  {#if issues.length > 0}
    <div class="mt-2 space-y-1">
      {#each issues.slice(0, 3) as issue}
        <div class="flex items-start gap-1.5 text-[11px]">
          <span class="text-red-400">•</span>
          <span class="{isGenerating ? 'text-white/80' : 'text-luna-text-secondary'}">
            {issue.message || issue}
            {#if issue.file}
              <span class="{isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">({issue.file}{issue.line ? `:${issue.line}` : ''})</span>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  {#if suggestions.length > 0}
    <div class="mt-2 flex flex-wrap gap-1">
      {#each suggestions.slice(0, 3) as suggestion}
        <span class="text-[10px] px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/10 text-white/80' : 'bg-amber-50 text-amber-700'}">
          {suggestion}
        </span>
      {/each}
    </div>
  {/if}
</PhaseCardBase>
