<script>
  import { listAdminSessions, regenerateAdminSession, deleteAdminSession, getSession } from '../../api.js';
  import { showNotification, session, currentView } from '../../stores.js';
  import AdminDataTable from './AdminDataTable.svelte';
  import { ExternalLinkIcon, RefreshCwIcon, TrashIcon } from './adminIcons.js';
  import { formatDate, statusBadge } from './adminUtils.js';

  let sessions = [];
  let loading = false;
  let search = '';

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      const data = await listAdminSessions({ search, limit: 1000 });
      sessions = data.sessions || data || [];
    } catch (err) {
      console.error('Failed to load sessions', err);
      showNotification('Failed to load sessions', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  $: filtered = sessions.filter((s) => {
    const q = search.toLowerCase();
    return !q || (s.id || '').toLowerCase().includes(q) || (s.name || s.project || s.initial_prompt || '').toLowerCase().includes(q);
  });

  async function openInEditor(id) {
    try {
      const s = await getSession(id);
      session.set({
        id: s.id,
        projectName: s.name || s.initial_prompt || 'Untitled Project',
        createdAt: s.created_at || Date.now(),
      });
      currentView.set('chat');
      showNotification('Session opened in editor', 'success');
    } catch (err) {
      showNotification('Failed to open session', 'error');
    }
  }

  async function regenerate(id) {
    try {
      await regenerateAdminSession(id);
      showNotification('Session regeneration started', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to regenerate session', 'error');
    }
  }

  async function remove(id) {
    if (!confirm(`Delete session ${id}?`)) return;
    try {
      await deleteAdminSession(id);
      showNotification('Session deleted', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to delete session', 'error');
    }
  }

  const columns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'initial_prompt', label: 'Project', render: (v, row) => v || row.name || row.project || 'Untitled' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'updated_at', label: 'Updated', render: (v, row) => formatDate(v || row.updatedAt) },
  ];

  const actions = [
    { title: 'Open in editor', icon: ExternalLinkIcon, onClick: (row) => openInEditor(row.id) },
    { title: 'Regenerate', icon: RefreshCwIcon, onClick: (row) => regenerate(row.id) },
    { title: 'Delete', icon: TrashIcon, class: 'hover:text-red-600', onClick: (row) => remove(row.id) },
  ];
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Sessions</h2>
      <p class="text-sm text-slate-500">Active conversations and previews</p>
    </div>
    <input
      type="text"
      bind:value={search}
      on:input={load}
      placeholder="Search sessions..."
      class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-luna-primary"
    />
  </div>

  <AdminDataTable {columns} rows={filtered} keyFn={(row) => row.id} showActions={true} {actions} />
</div>
