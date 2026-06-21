<script>
  import { onMount } from 'svelte';
  import { generationPageMode } from '../stores.js';
  import { getAdminSettings } from '../api.js';

  let modes = [];

  onMount(async () => {
    try {
      const settings = await getAdminSettings();
      modes = Array.isArray(settings['generation.modes']) ? settings['generation.modes'] : [];
      if (modes.length && !modes.find((m) => m.label === $generationPageMode)) {
        generationPageMode.set(modes[0].label);
      }
    } catch (err) {
      console.error('[GenerationModeSwitch] failed to load modes', err);
    }
  });
</script>

{#if modes.length > 0}
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-500">Modo:</span>
    <select bind:value={$generationPageMode} class="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-luna-primary">
      {#each modes as mode}
        <option value={mode.label}>{mode.label}</option>
      {/each}
    </select>
  </div>
{/if}
