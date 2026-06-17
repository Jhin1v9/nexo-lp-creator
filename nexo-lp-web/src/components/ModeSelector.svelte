<script>
  import { isGenerating } from '../stores.js';
  import { MODES, costFor, canAfford, formatCost } from '../lib/currency.js';
  import ModeIcon from './ModeIcon.svelte';

  export let mode = 'stars';
  export let balance = { stars: 0, suns: 0, moons: 0 };
  export let disabled = false;

  let open = false;

  $: cost = costFor('generate', mode);
  $: affordable = canAfford(balance, cost);
  $: selectedMode = MODES[mode] || MODES.stars;

  const modes = ['stars', 'suns', 'moons'];

  function select(m) {
    const mCost = costFor('generate', m);
    if (disabled || !canAfford(balance, mCost)) return;
    mode = m;
    open = false;
  }

  function handleClickOutside(node) {
    const onClick = (event) => {
      if (!node.contains(event.target)) open = false;
    };
    document.addEventListener('click', onClick, true);
    return {
      destroy() {
        document.removeEventListener('click', onClick, true);
      },
    };
  }
</script>

<div class="relative inline-flex items-center gap-3" use:handleClickOutside>
  <button
    type="button"
    class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border text-xs font-medium transition-all {$isGenerating ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-luna-border text-luna-text'}"
    {disabled}
    on:click={() => (open = !open)}
  >
    <ModeIcon mode={mode} size={14} />
    <span>{selectedMode.label}</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="transition-transform {open ? 'rotate-180' : ''}"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div
      class="absolute left-0 bottom-full mb-2 w-64 rounded-xl border shadow-lg overflow-hidden z-50 {$isGenerating ? 'bg-slate-900 border-white/20' : 'bg-white border-luna-border'}"
    >
      {#each modes as m}
        {@const mData = MODES[m]}
        {@const mCost = costFor('generate', m)}
        {@const mAffordable = canAfford(balance, mCost)}
        <button
          type="button"
          class="w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b last:border-b-0 {mode === m ? ($isGenerating ? 'bg-white/10' : 'bg-luna-surface') : ''} {disabled || !mAffordable ? 'opacity-50' : ''} {$isGenerating ? 'border-white/10' : 'border-luna-border'}"
          disabled={disabled || !mAffordable}
          on:click={() => select(m)}
        >
          <div class="flex-shrink-0 mt-0.5">
            <ModeIcon mode={m} size={16} />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold {$isGenerating ? 'text-white' : 'text-luna-text'}">
              {mData.label}
            </div>
            <div class="text-[11px] leading-tight mt-0.5 {$isGenerating ? 'text-white/60' : 'text-luna-text-muted'}">
              {mData.summary}
            </div>
            <div class="text-[10px] mt-1 {$isGenerating ? 'text-white/50' : 'text-luna-text-secondary'}">
              Custo: {formatCost(mCost)}
            </div>
          </div>
          {#if mode === m}
            <div class="flex-shrink-0 mt-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class={$isGenerating ? 'text-white' : 'text-luna-primary'}
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <span class="text-xs {$isGenerating ? 'text-white/60' : 'text-luna-text-muted'}">
    {formatCost(cost)}
  </span>
</div>
