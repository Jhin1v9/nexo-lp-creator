<script>
  export let content = '';

  function tryParseJson(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  function detectPhase(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.title || data.description || data.sections || data.style || data.target) return 'intention';
    if (data.layout || (Array.isArray(data.sections) && data.sections[0]?.components)) return 'structure';
    if (typeof data.score === 'number' || Array.isArray(data.issues)) return 'review';
    return null;
  }

  $: data = tryParseJson(content);
  $: phase = detectPhase(data);
</script>

{#if phase === 'intention' && data}
  <div class="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-luna-text">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base">🎯</span>
      <span class="font-semibold">{data.title || 'Intention'}</span>
    </div>
    {#if data.description}
      <p class="text-luna-text-secondary mb-2 line-clamp-3">{data.description}</p>
    {/if}
    {#if Array.isArray(data.sections) && data.sections.length > 0}
      <div class="flex flex-wrap gap-1 mb-2">
        {#each data.sections as section}
          <span class="px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-100">{section}</span>
        {/each}
      </div>
    {/if}
    {#if data.style?.tone || data.target?.audience}
      <div class="text-[10px] text-luna-text-muted">
        {#if data.style?.tone}Tone: <span class="font-medium text-luna-text">{data.style.tone}</span>{/if}
        {#if data.style?.tone && data.target?.audience} · {/if}
        {#if data.target?.audience}Audience: <span class="font-medium text-luna-text">{data.target.audience}</span>{/if}
      </div>
    {/if}
  </div>
{:else if phase === 'structure' && data}
  <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-luna-text">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base">🏗️</span>
      <span class="font-semibold">Structure: {data.layout || 'Single page'}</span>
    </div>
    {#if Array.isArray(data.sections) && data.sections.length > 0}
      <div class="space-y-1">
        {#each data.sections.slice(0, 6) as section}
          <div class="flex items-center justify-between px-2 py-1 rounded bg-white border border-emerald-100">
            <span class="font-medium capitalize">{section.id || section.type || 'Section'}</span>
            {#if Array.isArray(section.components)}
              <span class="text-[10px] text-luna-text-muted">{section.components.length} components</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if typeof data.navigation === 'boolean'}
      <div class="mt-2 text-[10px] text-luna-text-muted">Navigation: <span class="font-medium text-luna-text">{data.navigation ? 'Yes' : 'No'}</span></div>
    {/if}
  </div>
{:else if phase === 'review' && data}
  <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-luna-text">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="text-base">🔍</span>
        <span class="font-semibold">Review</span>
      </div>
      <span class="px-2 py-0.5 rounded-full {data.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} font-medium">
        {data.score ?? '—'}/100
      </span>
    </div>
    {#if Array.isArray(data.issues) && data.issues.length > 0}
      <div class="text-[10px] text-luna-text-secondary">
        {data.issues.length} issue{data.issues.length === 1 ? '' : 's'} found
      </div>
    {/if}
    {#if Array.isArray(data.suggestions) && data.suggestions.length > 0}
      <div class="mt-1 text-[10px] text-luna-text-muted">
        {data.suggestions.length} suggestion{data.suggestions.length === 1 ? '' : 's'}
      </div>
    {/if}
  </div>
{:else}
  <div class="whitespace-pre-wrap">{content}</div>
{/if}
