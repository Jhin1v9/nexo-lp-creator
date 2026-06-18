<script>
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  export let title = '';
  export let message = '';
  export let status = 'loading'; // loading | success | error
  export let icon = '';
  export let isGenerating = false;
  export let defaultExpanded = null; // boolean or null for auto

  let expanded = defaultExpanded ?? (status === 'loading' || status === 'error');

  function toggle() {
    expanded = !expanded;
  }

  $: statusColor = status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-amber-400';
  $: statusIcon = status === 'success' ? '✓' : status === 'error' ? '!' : '⟳';
  $: chevronClass = expanded ? 'rotate-180' : '';
</script>

<div class="rounded-xl border text-sm transition-colors overflow-hidden {isGenerating ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-luna-border text-luna-text'}">
  <button
    type="button"
    class="w-full p-3 text-left flex items-start gap-3 group"
    on:click={toggle}
    aria-expanded={expanded}
  >
    <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
      {icon}
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold truncate">{title}</div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="text-xs font-medium {statusColor}">
            {#if status === 'loading'}
              <span class="inline-block animate-spin">{statusIcon}</span>
            {:else}
              {statusIcon}
            {/if}
          </div>
          <div class="text-xs {isGenerating ? 'text-white/50' : 'text-luna-text-muted'} transition-transform duration-200 {chevronClass}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>
      <div class="text-xs mt-0.5 {isGenerating ? 'text-white/70' : 'text-luna-text-muted'}">
        {message}
      </div>
    </div>
  </button>
  {#if expanded}
    <div
      class="px-3 pb-3 text-xs"
      transition:slide={{ duration: 250, easing: quintOut }}
    >
      <slot />
    </div>
  {/if}
</div>
