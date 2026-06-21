<script>
  export let metrics = []; // { label, value, delta? }
</script>

<div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-4">
  {#each metrics as m}
    <div class="bg-white p-5">
      <div class="mb-1 text-xs text-slate-500">{m.label}</div>
      <div class="text-2xl font-semibold text-slate-900">{m.value}</div>
      {#if m.delta}
        <div class="mt-1 text-xs text-emerald-600">{m.delta}</div>
      {/if}
    </div>
  {/each}
</div>
