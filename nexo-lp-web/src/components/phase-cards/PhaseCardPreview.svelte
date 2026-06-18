<script>
  import PhaseCardBase from './PhaseCardBase.svelte';

  export let event;
  export let isGenerating = false;

  $: data = event?.result || {};
  $: previewUrl = data.preview_url || '';
  $: screenshotUrl = data.screenshot_url || '';
  $: expiresAt = data.expires_at || '';

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso;
    }
  }
</script>

<PhaseCardBase
  title="Preview pronto"
  message={event?.message || 'Salvando preview...'}
  status={event?.status}
  icon="👁️"
  {isGenerating}
  defaultExpanded={event?.status === 'loading' || event?.status === 'error'}
>
  {#if event?.status === 'success'}
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-[11px] {isGenerating ? 'text-emerald-300' : 'text-emerald-600'}">
        <span>✓</span>
        <span>Preview salvo com sucesso</span>
      </div>

      {#if screenshotUrl}
        <div class="rounded-lg overflow-hidden border {isGenerating ? 'border-white/10' : 'border-luna-border'}">
          <img src={screenshotUrl} alt="Preview" class="w-full h-24 object-cover object-top" />
        </div>
      {/if}

      {#if previewUrl}
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-[11px] font-medium {isGenerating ? 'text-indigo-300 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}"
        >
          <span>Abrir preview</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
        </a>
      {/if}

      {#if expiresAt}
        <div class="text-[10px] {isGenerating ? 'text-white/50' : 'text-luna-text-muted'}">
          Expira em {formatDate(expiresAt)}
        </div>
      {/if}
    </div>
  {/if}
</PhaseCardBase>
