<script>
  import { listAdminMiningJobs, retryAdminMiningJob, pauseAdminMiningJob, resumeAdminMiningJob } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import AdminDataTable from './AdminDataTable.svelte';
  import { RefreshCwIcon, PlayIcon, PauseIcon } from './adminIcons.js';
  import { formatDate, statusBadge } from './adminUtils.js';

  let jobs = [];
  let loading = false;
  let search = '';

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      const data = await listAdminMiningJobs({ search, limit: 1000 });
      jobs = data.jobs || data || [];
    } catch (err) {
      console.error('Failed to load mining jobs', err);
      showNotification('Failed to load mining jobs', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  $: filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return !q || (j.id || '').toLowerCase().includes(q) || (j.type || '').toLowerCase().includes(q) || (j.status || '').toLowerCase().includes(q);
  });

  async function control(id, action) {
    try {
      if (action === 'retry') await retryAdminMiningJob(id);
      if (action === 'pause') await pauseAdminMiningJob(id);
      if (action === 'resume') await resumeAdminMiningJob(id);
      showNotification(`Job ${action}ed`, 'success');
      await load();
    } catch (err) {
      showNotification(`Failed to ${action} mining job`, 'error');
    }
  }

  const columns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'progress', label: 'Progress', render: (v) => `${Math.max(0, Math.min(100, Number(v) || 0))}%` },
    { key: 'updated_at', label: 'Updated', render: (v, row) => formatDate(v || row.updatedAt) },
  ];

  const actions = [
    { title: 'Retry', icon: RefreshCwIcon, onClick: (row) => control(row.id, 'retry') },
    { title: 'Pause', icon: PauseIcon, show: (row) => row.status !== 'paused', onClick: (row) => control(row.id, 'pause') },
    { title: 'Resume', icon: PlayIcon, show: (row) => row.status === 'paused', onClick: (row) => control(row.id, 'resume') },
  ];
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Mining jobs</h2>
      <p class="text-sm text-slate-500">Background workers and automation</p>
    </div>
    <input
      type="text"
      bind:value={search}
      on:input={load}
      placeholder="Search jobs..."
      class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-luna-primary"
    />
  </div>

  <AdminDataTable {columns} rows={filtered} keyFn={(row) => row.id} showActions={true} {actions} />
</div>
