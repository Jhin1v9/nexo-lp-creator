<script>
  import { tick } from 'svelte';
  import {
    listAdminTemplates,
    updateAdminTemplate,
    approveAdminTemplate,
    deleteAdminTemplate,
    sanitizeAdminTemplate,
  } from '../../api.js';
  import { showNotification } from '../../stores.js';
  import AdminDataTable from './AdminDataTable.svelte';
  import LPAdminTemplatePanel from './LPAdminTemplatePanel.svelte';
  import {
    SparklesIcon,
    ShieldCheckIcon,
    TrashIcon,
    CommandIcon,
    FilterIcon,
  } from './adminIcons.js';
  import { formatCurrency, formatDate, statusBadge } from './adminUtils.js';

  let templates = [];
  let categories = [];
  let loading = false;
  let filter = { status: 'all', category: 'all', search: '' };
  let selectedIds = new Set();
  let selectedTemplate = null;
  let panelOpen = false;

  export function refresh() {
    load();
  }

  export async function sanitizeUnreviewed() {
    if (templates.length === 0) await load();
    const targets = templates.filter((t) => (t.status || '').toLowerCase() === 'unreviewed');
    if (targets.length === 0) {
      showNotification('No unreviewed templates', 'info');
      return;
    }
    await Promise.all(targets.map((t) => runSanitize(t.id)));
    showNotification(`${targets.length} template(s) na fila de sanitização`, 'success');
    await load();
  }

  async function load() {
    loading = true;
    try {
      const filters = { limit: 100 };
      if (filter.status && filter.status !== 'all') filters.status = filter.status;
      if (filter.category && filter.category !== 'all') filters.category = filter.category;
      if (filter.search?.trim()) filters.search = filter.search.trim();
      const data = await listAdminTemplates(filters);
      templates = data.templates || data || [];
      const cats = new Set(templates.map((t) => t.category).filter(Boolean));
      categories = Array.from(cats).sort();
      selectedIds = new Set();
    } catch (err) {
      console.error('Failed to load templates', err);
      showNotification('Failed to load templates', 'error');
    } finally {
      loading = false;
    }
  }

  load();

  $: filtered = templates.filter((t) => {
    const matchesStatus = filter.status === 'all' || (t.status || '').toLowerCase() === filter.status;
    const matchesCategory = filter.category === 'all' || t.category === filter.category;
    const q = filter.search.toLowerCase();
    const matchesSearch = !q || (t.name || '').toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  function openPanel(tpl) {
    selectedTemplate = { ...tpl };
    panelOpen = true;
  }

  function closePanel() {
    panelOpen = false;
    selectedTemplate = null;
  }

  async function saveTemplate({ detail }) {
    const tpl = detail.template;
    try {
      await updateAdminTemplate(tpl.id, {
        name: tpl.name,
        category: tpl.category,
        subcategory: tpl.subcategory,
        price: Number(tpl.price ?? 0),
        status: tpl.status,
      });
      showNotification('Template updated', 'success');
      closePanel();
      await load();
    } catch (err) {
      showNotification('Failed to update template', 'error');
    }
  }

  async function runApprove(id) {
    try {
      await approveAdminTemplate(id);
      showNotification('Template approved', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to approve template', 'error');
    }
  }

  async function runSanitize(id) {
    try {
      await sanitizeAdminTemplate(id);
      showNotification('Sanitização iniciada — acompanhe na aba Operações', 'success');
      await load();
    } catch (err) {
      showNotification('Failed to sanitize template', 'error');
    }
  }

  async function runDelete(id, withConfirm = true) {
    if (withConfirm && !confirm(`Delete template ${id}?`)) return;
    try {
      await deleteAdminTemplate(id);
      showNotification('Template deleted', 'success');
      if (selectedTemplate?.id === id) closePanel();
      await load();
    } catch (err) {
      showNotification('Failed to delete template', 'error');
    }
  }

  async function runBulk(action) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showNotification('No templates selected', 'warning');
      return;
    }
    try {
      if (action === 'sanitize') {
        if (!confirm(`Sanitize ${ids.length} templates?`)) return;
        await Promise.all(ids.map((id) => runSanitize(id)));
      } else if (action === 'approve') {
        if (!confirm(`Approve ${ids.length} templates?`)) return;
        await Promise.all(ids.map((id) => runApprove(id)));
      } else if (action === 'delete') {
        if (!confirm(`Delete ${ids.length} templates?`)) return;
        await Promise.all(ids.map((id) => runDelete(id, false)));
      } else if (action === 'price') {
        const price = prompt('Set price for selected templates', '0');
        if (price === null) return;
        await Promise.all(ids.map((id) => updateAdminTemplate(id, { price: Number(price) })));
        showNotification(`Set price ${price} for ${ids.length} templates`, 'success');
      }
      selectedIds = new Set();
      await load();
    } catch (err) {
      showNotification('Bulk action failed', 'error');
    }
  }

  function toggleSelection({ detail }) {
    const next = new Set(selectedIds);
    if (next.has(detail.id)) next.delete(detail.id);
    else next.add(detail.id);
    selectedIds = next;
  }

  function toggleAll() {
    if (filtered.length && filtered.every((t) => selectedIds.has(t.id))) {
      const next = new Set(selectedIds);
      filtered.forEach((t) => next.delete(t.id));
      selectedIds = next;
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((t) => next.add(t.id));
      selectedIds = next;
    }
  }

  const columns = [
    { key: 'id', label: 'ID', class: 'font-mono text-xs text-slate-500' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'price', label: 'Price', render: (v) => formatCurrency(v) },
    { key: 'updated_at', label: 'Updated', render: (v, row) => formatDate(v || row.updatedAt) },
  ];

  const actions = [
    { title: 'Edit', icon: CommandIcon, onClick: (row) => openPanel(row) },
    { title: 'Sanitize', icon: SparklesIcon, onClick: (row) => runSanitize(row.id) },
    { title: 'Approve', icon: ShieldCheckIcon, onClick: (row) => runApprove(row.id) },
    { title: 'Delete', icon: TrashIcon, class: 'hover:text-red-600', onClick: (row) => runDelete(row.id) },
  ];
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Templates</h2>
      <p class="text-sm text-slate-500">Manage and review public templates</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {@html FilterIcon({ size: 14 })}
      <select bind:value={filter.status} on:change={load} class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary">
        <option value="all">All statuses</option>
        <option value="unreviewed">Unreviewed</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <select bind:value={filter.category} on:change={load} class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-luna-primary">
        <option value="all">All categories</option>
        {#each categories as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
      <input
        type="text"
        bind:value={filter.search}
        on:input={load}
        placeholder="Search templates..."
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-luna-primary"
      />
    </div>
  </div>

  {#if selectedIds.size > 0}
    <div class="flex items-center gap-2 rounded-lg border border-luna-primary/20 bg-luna-primary/5 px-3 py-2 text-xs">
      <span class="text-slate-700">{selectedIds.size} selected</span>
      <div class="ml-auto flex gap-2">
        <button on:click={() => runBulk('sanitize')} class="rounded px-2 py-1 text-slate-700 hover:bg-luna-primary/10">Sanitize</button>
        <button on:click={() => runBulk('approve')} class="rounded px-2 py-1 text-slate-700 hover:bg-luna-primary/10">Approve</button>
        <button on:click={() => runBulk('price')} class="rounded px-2 py-1 text-slate-700 hover:bg-luna-primary/10">Set price</button>
        <button on:click={() => runBulk('delete')} class="rounded px-2 py-1 text-red-600 hover:bg-red-50">Delete</button>
      </div>
    </div>
  {/if}

  <AdminDataTable
    {columns}
    rows={filtered}
    keyFn={(row) => row.id}
    selectable={true}
    {selectedIds}
    showActions={true}
    {actions}
    on:toggle={toggleSelection}
    on:toggleAll={toggleAll}
  />
</div>

{#if panelOpen}
  <LPAdminTemplatePanel
    template={selectedTemplate}
    on:close={closePanel}
    on:save={saveTemplate}
    on:sanitize={(e) => runSanitize(e.detail.id)}
    on:approve={(e) => runApprove(e.detail.id)}
    on:delete={(e) => runDelete(e.detail.id)}
  />
{/if}
