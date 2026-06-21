<script>
  import { formatTime } from './adminUtils.js';

  export let events = [];
  export let maxEvents = 50;
  export let emptyText = 'Nenhum evento recente';

  function describe(event) {
    if (event.type === 'purchase') return `Compra: ${event.templateId || event.purchaseId}`;
    if (event.scope === 'generation') return `Geração ${event.phase || event.type}`;
    if (event.scope === 'sanitization') return `Sanitização ${event.step !== undefined ? `etapa ${event.step}` : event.type}`;
    return event.type || 'evento';
  }
</script>

<div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
  <div class="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">Atividade</div>
  <div class="max-h-96 overflow-auto">
    {#if events.length === 0}
      <div class="px-4 py-8 text-center text-sm text-slate-400">{emptyText}</div>
    {:else}
      {#each events.slice(0, maxEvents) as event, i (event.id || event.timestamp || i)}
        <div class="flex items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50">
          <span class="whitespace-nowrap text-xs tabular-nums text-slate-400">{formatTime(event.timestamp)}</span>
          <span class="text-slate-700">{describe(event)}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>
