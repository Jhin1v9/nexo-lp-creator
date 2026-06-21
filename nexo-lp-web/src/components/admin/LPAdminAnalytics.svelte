<script>
  import { listAdminPurchases } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import AdminMetricRow from './AdminMetricRow.svelte';
  import AdminDataTable from './AdminDataTable.svelte';
  import { DownloadIcon } from './adminIcons.js';
  import { formatCurrency, formatDate, statusBadge } from './adminUtils.js';

  let purchases = [];
  let loading = false;
  let dateFrom = '';
  let dateTo = '';

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      const data = await listAdminPurchases({ limit: 1000 });
      purchases = Array.isArray(data) ? data : data.purchases || [];
    } catch (err) {
      console.error('Failed to load purchases', err);
      showNotification('Failed to load purchases', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  $: filtered = purchases.filter((p) => {
    const d = p.created_at || p.createdAt;
    if (!d) return true;
    const ts = new Date(d).getTime();
    if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
    if (dateTo && ts > new Date(dateTo).getTime() + 86400000) return false;
    return true;
  });

  $: totalStars = filtered.reduce((sum, p) => sum + (Number(p.price_stars) || 0), 0);
  $: totalSuns = filtered.reduce((sum, p) => sum + (Number(p.price_suns) || 0), 0);
  $: totalMoons = filtered.reduce((sum, p) => sum + (Number(p.price_moons) || 0), 0);

  $: metrics = [
    { label: 'Total sales', value: formatCurrency(filtered.length) },
    { label: 'Stars revenue', value: formatCurrency(totalStars) },
    { label: 'Suns revenue', value: formatCurrency(totalSuns) },
    { label: 'Moons revenue', value: formatCurrency(totalMoons) },
  ];

  function exportCsv() {
    const headers = ['Template', 'Buyer', 'Stars', 'Suns', 'Moons', 'Date', 'Status'];
    const lines = filtered.map((r) =>
      [
        r.template_name || r.templateName || '',
        r.user_id || r.userId || '',
        r.price_stars || 0,
        r.price_suns || 0,
        r.price_moons || 0,
        r.created_at || r.createdAt || '',
        r.status || '',
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'user_id', label: 'Buyer', render: (v, row) => v || row.userId || '—' },
    { key: 'template_name', label: 'Template', render: (v, row) => v || row.templateName || '—' },
    { key: 'price_stars', label: 'Stars', render: (v) => formatCurrency(v) },
    { key: 'price_suns', label: 'Suns', render: (v) => formatCurrency(v) },
    { key: 'price_moons', label: 'Moons', render: (v) => formatCurrency(v) },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'created_at', label: 'Date', render: (v, row) => formatDate(v || row.createdAt) },
  ];
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Loja Analytics</h2>
      <p class="text-sm text-slate-500">Sales and revenue overview</p>
    </div>
    <button
      on:click={exportCsv}
      class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {@html DownloadIcon({ size: 14 })} Export CSV
    </button>
  </div>

  <AdminMetricRow metrics={metrics} />

  <div class="rounded-lg border border-slate-200 bg-white p-4">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <label class="text-sm text-slate-600">From</label>
      <input type="date" bind:value={dateFrom} class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary" />
      <label class="text-sm text-slate-600">To</label>
      <input type="date" bind:value={dateTo} class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary" />
      {#if dateFrom || dateTo}
        <button on:click={() => { dateFrom = ''; dateTo = ''; }} class="text-xs text-luna-primary hover:underline">Clear</button>
      {/if}
    </div>
    <AdminDataTable {columns} rows={filtered} keyFn={(row) => row.id} />
  </div>
</div>
