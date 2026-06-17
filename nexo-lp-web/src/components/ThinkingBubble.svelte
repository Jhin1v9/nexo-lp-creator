<script>
  import { slide } from 'svelte/transition';

  export let text = '';
  export let isExpanded = true;

  $: lines = (text || '').split('\n').filter((l) => l.trim());

  function getLineIcon(line) {
    const lower = line.toLowerCase();
    if (lower.includes('search') || lower.includes('find')) return '🔍';
    if (lower.includes('error') || lower.includes('fail')) return '⚠️';
    if (lower.includes('file') || lower.includes('write') || lower.includes('read') || lower.includes('save')) return '📄';
    if (lower.includes('code') || lower.includes('script') || lower.includes('function') || lower.includes('class')) return '💻';
    if (lower.includes('idea') || lower.includes('consider') || lower.includes('maybe')) return '💡';
    if (lower.includes('step') || lower.includes('next')) return '▶️';
    if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) return '✅';
    if (lower.includes('wait') || lower.includes('loading')) return '⏳';
    if (lower.includes('tool') || lower.includes('execute') || lower.includes('run') || lower.includes('shell')) return '🔧';
    return '•';
  }
</script>

<div class="w-full max-w-[85%] rounded-xl border border-dashed border-amber-200 bg-amber-50/60 overflow-hidden">
  <button
    class="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
    on:click={() => isExpanded = !isExpanded}
    aria-expanded={isExpanded}
  >
    <span>🧠</span>
    <span>Thinking</span>
    <span class="flex gap-0.5 ml-1">
      <span class="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style="animation-delay: 0ms"></span>
      <span class="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style="animation-delay: 150ms"></span>
      <span class="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style="animation-delay: 300ms"></span>
    </span>
    <svg class="ml-auto w-3.5 h-3.5 transition-transform" class:rotate-180={isExpanded} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {#if isExpanded}
    <div class="px-3 pb-2.5 space-y-1" transition:slide={{ duration: 200 }}>
      {#if lines.length > 0}
        {#each lines as line}
          <div class="flex items-start gap-1.5 text-[11px] text-amber-800/80 font-mono leading-relaxed">
            <span class="select-none">{getLineIcon(line)}</span>
            <span>{line}</span>
          </div>
        {/each}
      {:else}
        <div class="text-[11px] text-amber-800/60 italic">Analyzing...</div>
      {/if}
    </div>
  {/if}
</div>
