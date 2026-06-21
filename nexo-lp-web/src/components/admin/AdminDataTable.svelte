<script>
  import { createEventDispatcher } from 'svelte';

  export let columns = []; // { key, label, render?, class? }
  export let rows = [];
  export let keyFn = (row, i) => i;
  export let selectable = false;
  export let selectedIds = new Set();
  export let showActions = false;
  export let actions = []; // { label?, title?, icon?, class?, onClick(row), show?(row) }

  const dispatch = createEventDispatcher();

  $: allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(keyFn(row, 0)));
  $: colspan = columns.length + (selectable ? 1 : 0) + (showActions ? 1 : 0);

  function toggleAll() {
    dispatch('toggleAll');
  }

  function toggleRow(row) {
    dispatch('toggle', { id: keyFn(row, 0) });
  }

  function handleAction(action, row) {
    if (action.onClick) action.onClick(row);
  }
</script>

<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table class="w-full text-left text-sm">
    <thead>
      <tr class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        {#if selectable}
          <th class="w-10 px-3 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              on:change={toggleAll}
              class="rounded border-slate-300 text-luna-primary focus:ring-luna-primary"
            />
          </th>
        {/if}
        {#each columns as col}
          <th class="px-3 py-2 font-medium {col.class || ''}">{col.label}</th>
        {/each}
        {#if showActions}
          <th class="px-3 py-2 text-right font-medium">Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (keyFn(row, i))}
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          {#if selectable}
            <td class="px-3 py-2">
              <input
                type="checkbox"
                checked={selectedIds.has(keyFn(row, i))}
                on:change={() => toggleRow(row)}
                class="rounded border-slate-300 text-luna-primary focus:ring-luna-primary"
              />
            </td>
          {/if}
          {#each columns as col}
            <td class="px-3 py-2 text-slate-700 {col.class || ''}">
              {#if col.render}
                {@html col.render(row[col.key], row)}
              {:else}
                {row[col.key] ?? '—'}
              {/if}
            </td>
          {/each}
          {#if showActions}
            <td class="px-3 py-2 text-right">
              <div class="flex items-center justify-end gap-1">
                {#each actions as action}
                  {#if !action.show || action.show(row)}
                    <button
                      title={action.title || action.label}
                      class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 {action.class || ''}"
                      on:click={() => handleAction(action, row)}
                    >
                      {#if action.icon}
                        {@html action.icon({ size: 14 })}
                      {:else}
                        {action.label}
                      {/if}
                    </button>
                  {/if}
                {/each}
              </div>
            </td>
          {/if}
        </tr>
      {:else}
        <tr>
          <td {colspan} class="px-3 py-8 text-center text-sm text-slate-400">
            <slot name="empty">No data found</slot>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
