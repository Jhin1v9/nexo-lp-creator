<script>
  export let title = '';
  export let message = '';
  export let status = 'loading'; // loading | success | error
  export let icon = '';
  export let isGenerating = false;

  $: statusColor = status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-amber-400';
  $: statusIcon = status === 'success' ? '✓' : status === 'error' ? '!' : '⟳';
</script>

<div class="rounded-xl border p-3 text-sm transition-colors {isGenerating ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-luna-border text-luna-text'}">
  <div class="flex items-start gap-3">
    <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg {isGenerating ? 'bg-white/10' : 'bg-luna-surface'}">
      {icon}
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold truncate">{title}</div>
        <div class="flex-shrink-0 text-xs font-medium {statusColor}">
          {#if status === 'loading'}
            <span class="inline-block animate-spin">{statusIcon}</span>
          {:else}
            {statusIcon}
          {/if}
        </div>
      </div>
      <div class="text-xs mt-0.5 {isGenerating ? 'text-white/70' : 'text-luna-text-muted'}">
        {message}
      </div>
      <div class="mt-2 text-xs">
        <slot />
      </div>
    </div>
  </div>
</div>
