<script>
  import { getAdminUser, updateAdminUser } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import AdminDataTable from './AdminDataTable.svelte';
  import { XIcon, LockIcon, UnlockIcon, UserCheckIcon } from './adminIcons.js';
  import { formatDate, formatCurrency, statusBadge } from './adminUtils.js';

  export let userId = null;

  let user = null;
  let loading = false;
  let activeTab = 'sessions';

  export function refresh() {
    load();
  }

  async function load() {
    if (!userId) return;
    loading = true;
    try {
      user = await getAdminUser(userId);
    } catch (err) {
      console.error('Failed to load user', err);
      showNotification('Failed to load user', 'error');
    } finally {
      loading = false;
    }
  }

  $: if (userId) load();

  async function saveRole() {
    try {
      await updateAdminUser(userId, { role: user.role });
      showNotification('User updated', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to update user', 'error');
    }
  }

  const sessionColumns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'initial_prompt', label: 'Project', render: (v, row) => v || row.name || row.project || 'Untitled' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'updated_at', label: 'Updated', render: (v, row) => formatDate(v || row.updatedAt) },
  ];

  const purchaseColumns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'template_name', label: 'Template', render: (v, row) => v || row.templateName || '—' },
    { key: 'price_stars', label: 'Stars', render: (v) => formatCurrency(v) },
    { key: 'price_suns', label: 'Suns', render: (v) => formatCurrency(v) },
    { key: 'price_moons', label: 'Moons', render: (v) => formatCurrency(v) },
    { key: 'created_at', label: 'Date', render: (v, row) => formatDate(v || row.createdAt) },
  ];

  const templateColumns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'category', label: 'Category' },
  ];

  const logColumns = [
    { key: 'created_at', label: 'Time', render: (v, row) => formatDate(v || row.createdAt) },
    { key: 'action', label: 'Action' },
    { key: 'target_type', label: 'Target' },
  ];
</script>

{#if userId}
  <div class="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-sm">
    <div class="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div class="flex h-14 items-center justify-between border-b border-slate-200 px-5">
        <h3 class="text-sm font-semibold text-slate-900">User details</h3>
        <button on:click={() => { userId = null; user = null; }} class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          {@html XIcon({ size: 18 })}
        </button>
      </div>
      {#if loading}
        <div class="flex flex-1 items-center justify-center text-sm text-slate-400">Loading...</div>
      {:else if user}
        <div class="flex-1 overflow-y-auto p-5">
          <div class="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-luna-primary/10 text-luna-primary">
                {@html UserCheckIcon({ size: 18 })}
              </div>
              <div>
                <div class="text-sm font-semibold text-slate-900">{user.name || user.email || user.id}</div>
                <div class="text-xs text-slate-500">{user.id}</div>
              </div>
              <div class="ml-auto">{@html statusBadge(user.status)}</div>
            </div>
            <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div class="rounded border border-slate-200 bg-white p-2">
                <div class="font-semibold text-slate-900">{formatCurrency(user.balances?.stars ?? user.balance_stars ?? 0)}</div>
                <div class="text-slate-500">Stars</div>
              </div>
              <div class="rounded border border-slate-200 bg-white p-2">
                <div class="font-semibold text-slate-900">{formatCurrency(user.balances?.suns ?? user.balance_suns ?? 0)}</div>
                <div class="text-slate-500">Suns</div>
              </div>
              <div class="rounded border border-slate-200 bg-white p-2">
                <div class="font-semibold text-slate-900">{formatCurrency(user.balances?.moons ?? user.balance_moons ?? 0)}</div>
                <div class="text-slate-500">Moons</div>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <select bind:value={user.role} class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-luna-primary">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button on:click={saveRole} class="rounded-lg bg-luna-primary px-3 py-1 text-xs font-medium text-white hover:bg-luna-primary-hover">Save role</button>
            </div>
          </div>

          <div class="mb-3 flex gap-2 border-b border-slate-200 text-sm">
            {#each ['sessions', 'purchases', 'templates', 'history'] as tab}
              <button
                on:click={() => activeTab = tab}
                class="px-3 py-2 capitalize transition-colors {activeTab === tab ? 'border-b-2 border-luna-primary font-medium text-luna-primary' : 'text-slate-500 hover:text-slate-700'}"
              >
                {tab}
              </button>
            {/each}
          </div>

          {#if activeTab === 'sessions'}
            <AdminDataTable columns={sessionColumns} rows={user.sessions || []} keyFn={(row) => row.id} />
          {:else if activeTab === 'purchases'}
            <AdminDataTable columns={purchaseColumns} rows={user.purchases || []} keyFn={(row) => row.id} />
          {:else if activeTab === 'templates'}
            <AdminDataTable columns={templateColumns} rows={user.publishedTemplates || []} keyFn={(row) => row.id} />
          {:else if activeTab === 'history'}
            <AdminDataTable columns={logColumns} rows={user.adminHistory || []} keyFn={(row, i) => row.id || i} />
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
