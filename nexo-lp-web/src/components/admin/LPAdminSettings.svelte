<script>
  import { getAdminSettings, updateAdminSettings } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import { PlusIcon, MinusIcon } from './adminIcons.js';

  let settings = null;
  let loading = false;
  let saving = false;

  let mode = 'landing';
  let modes = [];
  let frameworks = '';
  let autoPublish = false;
  let basePrompt = '';
  let defaultTemplatePrice = 0;

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      settings = await getAdminSettings();
      mode = settings['generation.mode'] || 'landing';
      modes = Array.isArray(settings['generation.modes']) ? settings['generation.modes'].map((m) => ({ ...m })) : [];
      frameworks = Array.isArray(settings['generation.frameworks']) ? settings['generation.frameworks'].join(', ') : settings['generation.frameworks'] || '';
      autoPublish = !!settings['generation.auto_publish'];
      basePrompt = settings['generation.base_prompt'] || '';
      defaultTemplatePrice = Number(settings['pricing.default_template'] ?? 0);
    } catch (err) {
      console.error('Failed to load settings', err);
      showNotification('Failed to load settings', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  function addMode() {
    modes = [...modes, { label: 'New mode', basePrompt: '' }];
  }

  function removeMode(index) {
    modes = modes.filter((_, i) => i !== index);
  }

  async function save() {
    saving = true;
    try {
      const payload = {
        'generation.mode': mode,
        'generation.modes': modes,
        'generation.frameworks': frameworks.split(',').map((s) => s.trim()).filter(Boolean),
        'generation.auto_publish': autoPublish,
        'generation.base_prompt': basePrompt,
        'pricing.default_template': Number(defaultTemplatePrice),
      };
      await updateAdminSettings(payload);
      showNotification('Settings saved', 'success');
      await load();
    } catch (err) {
      console.error('Failed to save settings', err);
      showNotification('Failed to save settings', 'error');
    } finally {
      saving = false;
    }
  }
</script>

<div class="mx-auto w-full max-w-3xl space-y-6">
  <div>
    <h2 class="text-lg font-semibold text-slate-900">Settings</h2>
    <p class="text-sm text-slate-500">Generation modes, defaults and pricing</p>
  </div>

  {#if loading && !settings}
    <div class="text-sm text-slate-400">Loading settings...</div>
  {:else}
    <div class="space-y-6 rounded-lg border border-slate-200 bg-white p-5">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-xs font-medium text-slate-700">Default generation mode</label>
          <select bind:value={mode} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary">
            {#each modes as m}
              <option value={m.label.toLowerCase()}>{m.label}</option>
            {:else}
              <option value="landing">Landing</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-medium text-slate-700">Default template price</label>
          <input type="number" bind:value={defaultTemplatePrice} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary" />
        </div>
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-medium text-slate-700">Frameworks (comma separated)</label>
        <input type="text" bind:value={frameworks} placeholder="e.g. static-html-tailwind" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-luna-primary" />
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <label class="text-xs font-medium text-slate-700">Generation modes</label>
          <button on:click={addMode} class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
            {@html PlusIcon({ size: 12 })} Add mode
          </button>
        </div>
        <div class="space-y-3">
          {#each modes as m, i (i)}
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div class="mb-2 flex gap-2">
                <input type="text" bind:value={m.label} placeholder="Label" class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-luna-primary" />
                <button on:click={() => removeMode(i)} class="rounded-lg border border-slate-200 bg-white px-2 text-slate-500 hover:text-red-600" title="Remove mode">
                  {@html MinusIcon({ size: 14 })}
                </button>
              </div>
              <textarea bind:value={m.basePrompt} rows="2" placeholder="Base prompt for this mode" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-luna-primary"></textarea>
            </div>
          {:else}
            <div class="text-sm text-slate-400">No generation modes configured.</div>
          {/each}
        </div>
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-medium text-slate-700">Base prompt</label>
        <textarea bind:value={basePrompt} rows="5" placeholder="Additional instructions appended to every generation prompt" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-luna-primary"></textarea>
      </div>

      <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <div>
          <div class="text-sm font-medium text-slate-900">Auto-publish</div>
          <div class="text-xs text-slate-500">Automatically publish generated pages</div>
        </div>
        <button
          on:click={() => autoPublish = !autoPublish}
          class="relative h-6 w-11 rounded-full transition-colors"
          class:bg-luna-primary={autoPublish}
          class:bg-slate-300={!autoPublish}
        >
          <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform" class:translate-x-5={autoPublish}></span>
        </button>
      </div>

      <div class="flex justify-end pt-2">
        <button on:click={save} disabled={saving} class="rounded-lg bg-luna-primary px-4 py-2 text-sm font-medium text-white hover:bg-luna-primary-hover disabled:opacity-50">
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  {/if}
</div>
