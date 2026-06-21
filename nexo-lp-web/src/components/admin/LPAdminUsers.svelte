<script>
  import { listAdminUsers, blockAdminUser, unblockAdminUser, impersonateAdminUser } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import AdminDataTable from './AdminDataTable.svelte';
  import LPAdminUserPanel from './LPAdminUserPanel.svelte';
  import { LockIcon, UnlockIcon, UserIcon, EyeIcon } from './adminIcons.js';
  import { formatCurrency, statusBadge } from './adminUtils.js';

  let users = [];
  let total = 0;
  let loading = false;
  let filter = { status: 'all', role: 'all', search: '' };
  let selectedUserId = null;

  export function refresh() {
    load();
  }

  async function load() {
    loading = true;
    try {
      const filters = {};
      if (filter.status && filter.status !== 'all') filters.status = filter.status;
      if (filter.role && filter.role !== 'all') filters.role = filter.role;
      if (filter.search?.trim()) filters.search = filter.search.trim();
      const result = await listAdminUsers(filters);
      users = result.users || [];
      total = result.total || users.length;
    } catch (err) {
      console.error('Failed to load users', err);
      showNotification('Failed to load users', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  function openUser(id) {
    selectedUserId = id;
  }

  function closeUser() {
    selectedUserId = null;
  }

  async function block(id) {
    try {
      await blockAdminUser(id);
      showNotification('User blocked', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to block user', 'error');
    }
  }

  async function unblock(id) {
    try {
      await unblockAdminUser(id);
      showNotification('User unblocked', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to unblock user', 'error');
    }
  }

  async function impersonate(id) {
    try {
      const result = await impersonateAdminUser(id);
      showNotification(`Impersonation token created: ${result.token?.slice(0, 12)}...`, 'success');
      console.log('Impersonate result', result);
    } catch (err) {
      showNotification('Failed to impersonate user', 'error');
    }
  }

  const columns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'name', label: 'Name', render: (v, row) => v || row.email || '—' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'role', label: 'Role' },
    { key: 'balance_stars', label: 'Stars', render: (v, row) => formatCurrency(v ?? row.balances?.stars ?? 0) },
    { key: 'balance_suns', label: 'Suns', render: (v, row) => formatCurrency(v ?? row.balances?.suns ?? 0) },
    { key: 'balance_moons', label: 'Moons', render: (v, row) => formatCurrency(v ?? row.balances?.moons ?? 0) },
    { key: 'total_purchases', label: 'Purchases', render: (v) => formatCurrency(v) },
  ];

  const actions = [
    { title: 'View', icon: EyeIcon, onClick: (row) => openUser(row.id) },
    { title: 'Block', icon: LockIcon, show: (row) => row.status !== 'blocked', onClick: (row) => block(row.id) },
    { title: 'Unblock', icon: UnlockIcon, show: (row) => row.status === 'blocked', onClick: (row) => unblock(row.id) },
    { title: 'Impersonate', icon: UserIcon, onClick: (row) => impersonate(row.id) },
  ];
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Users</h2>
      <p class="text-sm text-slate-500">{formatCurrency(total)} total users</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <select bind:value={filter.status} on:change={load} class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="blocked">Blocked</option>
      </select>
      <select bind:value={filter.role} on:change={load} class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary">
        <option value="all">All roles</option>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <input
        type="text"
        bind:value={filter.search}
        on:input={load}
        placeholder="Search users..."
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-luna-primary"
      />
    </div>
  </div>

  <AdminDataTable {columns} rows={users} keyFn={(row) => row.id} showActions={true} {actions} />
</div>

<LPAdminUserPanel bind:userId={selectedUserId} />
