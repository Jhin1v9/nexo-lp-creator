<script>
  import { createEventDispatcher } from 'svelte';
  import { adminLiveEvents } from '../../stores.js';
  import { getAdminStats } from '../../api.js';
  import AdminMetricRow from './AdminMetricRow.svelte';
  import AdminEventFeed from './AdminEventFeed.svelte';
  import {
    LayersIcon,
    CreditCardIcon,
    MessageSquareIcon,
    CpuIcon,
    SparklesIcon,
    ArrowLeftIcon,
  } from './adminIcons.js';
  import { formatCurrency } from './adminUtils.js';

  const dispatch = createEventDispatcher();

  let stats = null;
  let loading = false;

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      stats = await getAdminStats();
    } catch (err) {
      console.error('Failed to load admin stats', err);
    } finally {
      loading = false;
    }
  }

  load();

  $: metrics = [
    { label: 'Templates', value: formatCurrency(stats?.templates?.total ?? 0) },
    { label: 'Purchases', value: formatCurrency(stats?.purchases?.total ?? 0) },
    { label: 'Active sessions', value: formatCurrency(stats?.sessions?.active ?? 0) },
    { label: 'Mining jobs', value: formatCurrency(stats?.jobs?.total ?? 0) },
    { label: 'Currency in circulation', value: formatCurrency(stats?.currency?.total ?? 0) },
  ];
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Overview</h2>
      <p class="text-sm text-slate-500">Live admin telemetry</p>
    </div>
    {#if loading}<span class="text-sm text-slate-400">Loading...</span>{/if}
  </div>

  <AdminMetricRow metrics={metrics} />

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <AdminEventFeed events={$adminLiveEvents.events} />
    </div>

    <div class="space-y-4">
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h3 class="mb-3 text-sm font-medium text-slate-700">Quick actions</h3>
        <div class="grid grid-cols-1 gap-2">
          <button
            on:click={() => dispatch('switchModule', { id: 'templates' })}
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-luna-primary/40 hover:text-luna-primary"
          >
            {@html LayersIcon({ size: 14 })} Manage templates
          </button>
          <button
            on:click={() => dispatch('openCredit')}
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-luna-primary/40 hover:text-luna-primary"
          >
            {@html CreditCardIcon({ size: 14 })} Credit / Deduct
          </button>
          <button
            on:click={() => dispatch('switchModule', { id: 'operations' })}
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-luna-primary/40 hover:text-luna-primary"
          >
            {@html MessageSquareIcon({ size: 14 })} Live operations
          </button>
          <button
            on:click={() => dispatch('switchModule', { id: 'mining' })}
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-luna-primary/40 hover:text-luna-primary"
          >
            {@html CpuIcon({ size: 14 })} Mining jobs
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h3 class="mb-3 text-sm font-medium text-slate-700">System shortcuts</h3>
        <button
          on:click={() => dispatch('backToNexo')}
          class="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition-colors hover:border-luna-primary/40 hover:text-luna-primary"
        >
          {@html ArrowLeftIcon({ size: 14 })} Back to NEXO LP
        </button>
      </div>
    </div>
  </div>
</div>
