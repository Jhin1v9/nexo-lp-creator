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

  function scoreBg(s) {
    if (s >= 80) return 'stroke-emerald-400';
    if (s >= 60) return 'stroke-amber-400';
    return 'stroke-red-400';
  }

  function severityIcon(severity) {
    const s = String(severity || '').toLowerCase();
    if (s === 'error' || s === 'critical') return '✕';
    if (s === 'warning') return '!';
    return '•';
  }

  function severityColor(severity) {
    const s = String(severity || '').toLowerCase();
    if (s === 'error' || s === 'critical') return 'text-red-400';
    if (s === 'warning') return 'text-amber-400';
    return 'text-blue-400';
  }
</script>

<PhaseCardBase
  title="Revisão de qualidade"
  message={event?.message || 'Verificando código gerado...'}
  status={event?.status}
  icon="🔍"
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  <div class="space-y-3">
    {#if score !== null}
      <div class="flex items-center gap-4">
        <div class="relative w-14 h-14 flex items-center justify-center">
          <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path class="{isGenerating ? 'stroke-white/10' : 'stroke-slate-200'}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3" />
            <path class="{scoreBg(score)}" stroke-dasharray="{score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3" stroke-linecap="round" />
          </svg>
          <span class="absolute text-sm font-bold {scoreColor(score)}">{score}</span>
        </div>
        <div>
          <div class="text-sm font-semibold {scoreColor(score)}">{passed ? 'Aprovado' : 'Pontos a revisar'}</div>
          <div class="text-[11px] {isGenerating ? 'text-white/60' : 'text-luna-text-muted'}">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} · {suggestions.length} {suggestions.length === 1 ? 'sugestão' : 'sugestões'}
          </div>
        </div>
      </div>
    {/if}

    {#if issues.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Issues</div>
        <div class="space-y-1">
          {#each issues as issue}
            <div class="flex items-start gap-1.5 text-[11px]">
              <span class="{severityColor(issue.severity)} font-bold">{severityIcon(issue.severity)}</span>
              <span class="{isGenerating ? 'text-white/80' : 'text-luna-text-secondary'}">
                {issue.message || issue}
                {#if issue.file}
                  <span class="{isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">({issue.file}{issue.line ? `:${issue.line}` : ''})</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if suggestions.length > 0}
      <div>
        <div class="text-[10px] uppercase tracking-wide mb-1.5 {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">Sugestões</div>
        <div class="flex flex-wrap gap-1">
          {#each suggestions as suggestion}
            <span class="text-[10px] px-2 py-0.5 rounded-full {isGenerating ? 'bg-white/10 text-white/80' : 'bg-amber-50 text-amber-700'}">
              {suggestion}
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</PhaseCardBase>
