<script>
  import { createEventDispatcher } from 'svelte';
  import { XIcon, SparklesIcon, ShieldCheckIcon, TrashIcon } from './adminIcons.js';
  import { formatDate } from './adminUtils.js';

  export let template = null;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function save() {
    dispatch('save', { template });
  }

  function sanitize() {
    dispatch('sanitize', { id: template.id });
  }

  function approve() {
    dispatch('approve', { id: template.id });
  }

  function remove() {
    dispatch('delete', { id: template.id });
  }

  $: previewHtml = template?.html || template?.preview_html || template?.preview || '<p class="p-4 text-slate-500">No preview available</p>';
</script>

{#if template}
  <div class="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-sm" on:click={close}>
    <div
      class="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      on:click|stopPropagation
    >
      <div class="flex h-14 items-center justify-between border-b border-slate-200 px-5">
        <h3 class="text-sm font-semibold text-slate-900">Template preview & metadata</h3>
        <button on:click={close} class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          {@html XIcon({ size: 18 })}
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <div class="mb-4 aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <iframe title="Template preview" sandbox="allow-scripts" class="h-full w-full" srcdoc={previewHtml}></iframe>
        </div>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500">Name</label>
            <input type="text" bind:value={template.name} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Category</label>
              <input type="text" bind:value={template.category} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Subcategory</label>
              <input type="text" bind:value={template.subcategory} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Price</label>
              <input type="number" bind:value={template.price} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select bind:value={template.status} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-luna-primary">
                <option value="unreviewed">Unreviewed</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div class="text-xs text-slate-400">Updated {formatDate(template.updated_at || template.updatedAt)}</div>
          <div class="flex flex-wrap gap-2 pt-2">
            <button on:click={save} class="rounded-lg bg-luna-primary px-4 py-2 text-sm font-medium text-white hover:bg-luna-primary-hover">Save changes</button>
            <button on:click={sanitize} class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              {@html SparklesIcon({ size: 14 })} Sanitize
            </button>
            <button on:click={approve} class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              {@html ShieldCheckIcon({ size: 14 })} Approve
            </button>
            <button on:click={remove} class="ml-auto rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
              {@html TrashIcon({ size: 14 })} Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
