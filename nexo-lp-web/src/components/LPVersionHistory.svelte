<script>
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { versionHistory, preview, showNotification, session, editorTab } from '../stores.js';
  import { lpClient } from '../lib/lpClient.js';
  import { createBlobUrl, revokeBlobUrl } from '../lib/previewBuilder.js';

  let selectedVersion = null;
  let isRollingBack = false;
  let isLoading = false;

  onMount(async () => {
    await loadVersions();
  });

  let lastLoadedSessionId = null;

  $: if ($editorTab === 'history' && $session.id && $session.id !== lastLoadedSessionId) {
    loadVersions();
  }

  async function loadVersions() {
    if (!$session.id) return;
    lastLoadedSessionId = $session.id;
    isLoading = true;
    try {
      const versions = await lpClient.getVersions();
      versionHistory.set(versions || []);
    } catch (error) {
      console.error('Failed to load versions:', error);
      showNotification('Failed to load version history', 'error');
    } finally {
      isLoading = false;
    }
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function formatFullTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  async function handleRollback(version) {
    if (isRollingBack) return;

    if (!confirm(`Rollback to "${version.change_summary || 'this version'}"? This will replace your current work.`)) {
      return;
    }

    isRollingBack = true;

    try {
      const rolledBack = await lpClient.rollbackVersion(version.id);

      if (rolledBack.html && rolledBack.html.length > 50) {
        if ($preview.blobUrl) revokeBlobUrl($preview.blobUrl);
        const blobUrl = createBlobUrl(rolledBack.html);
        preview.set({
          html: rolledBack.html,
          blobUrl,
          lastUpdated: Date.now(),
          device: $preview.device,
        });
      }

      showNotification('Rolled back successfully!', 'success');
    } catch (error) {
      console.error('Rollback failed:', error);
      showNotification('Rollback failed', 'error');
    } finally {
      isRollingBack = false;
    }
  }

  async function handleSaveVersion() {
    const note = prompt('Enter a note for this version:');
    if (!note) return;

    try {
      const newVersion = await lpClient.saveVersion($preview.html, note);
      versionHistory.update((v) => [newVersion, ...v]);
      showNotification('Version saved!', 'success');
    } catch (error) {
      console.error('Save version failed:', error);
      showNotification('Failed to save version', 'error');
    }
  }

  function getVersionColor(index) {
    const colors = [
      'bg-luna-primary',
      'bg-luna-purple',
      'bg-blue-500',
      'bg-emerald-500',
      'bg-amber-500',
    ];
    return colors[index % colors.length];
  }

  function toggleVersionDetails(version) {
    if (selectedVersion === version.id) {
      selectedVersion = null;
    } else {
      selectedVersion = version.id;
    }
  }

  function getChanges(version) {
    if (Array.isArray(version.changes) && version.changes.length > 0) {
      return version.changes;
    }
    if (version.metadata) {
      try {
        const meta = typeof version.metadata === 'string' ? JSON.parse(version.metadata) : version.metadata;
        if (meta.source) return [`Source: ${meta.source}`];
      } catch (e) {
        // ignore
      }
    }
    return [version.change_summary || 'Saved version'];
  }

  function getDiffPreview(version) {
    return getChanges(version).map((change) => `+ ${change}`).join('\n');
  }
</script>

<div class="flex flex-col h-full bg-white overflow-hidden">
  <!-- Header -->
  <div class="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-luna-border">
    <div>
      <h2 class="text-lg font-semibold text-luna-text">Version History</h2>
      <p class="text-xs text-luna-text-muted mt-0.5">{$versionHistory.length} versions saved</p>
    </div>
    <button
      class="flex items-center gap-2 px-4 py-2 rounded-xl btn-primary text-white text-sm font-medium"
      on:click={handleSaveVersion}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Save Current
    </button>
  </div>

  <!-- Version List -->
  <div class="flex-1 overflow-y-auto px-6 py-4">
    {#if isLoading}
      <div class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-luna-primary"></div>
      </div>
    {:else}
      <div class="relative">
        <!-- Timeline Line -->
        <div class="absolute left-[19px] top-0 bottom-0 w-0.5 bg-luna-border"></div>

        <div class="space-y-4">
          {#each $versionHistory as version, i (version.id)}
            <div
              class="relative flex gap-4 group"
              in:fly={{ y: 10, duration: 250, delay: i * 50 }}
            >
              <!-- Timeline Dot -->
              <div class="relative z-10 flex-shrink-0">
                <div class="w-10 h-10 rounded-full {getVersionColor(i)} bg-opacity-10 border-2 border-white shadow-sm flex items-center justify-center">
                  <span class="text-xs font-bold {getVersionColor(i)} text-opacity-80" style="color: inherit;">
                    {$versionHistory.length - i}
                  </span>
                </div>
              </div>

              <!-- Version Card -->
              <div class="flex-1 min-w-0">
                <button
                  class="w-full text-left p-4 rounded-xl border border-luna-border bg-white hover:border-luna-primary/30 hover:shadow-md transition-all duration-200"
                  on:click={() => toggleVersionDetails(version)}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <h3 class="text-sm font-semibold text-luna-text truncate">{version.change_summary || 'Saved version'}</h3>
                      <div class="flex items-center gap-3 mt-1.5">
                        <span class="text-xs text-luna-text-muted">{formatTime(version.created_at)}</span>
                        <span class="text-xs text-luna-text-muted">{formatFullTime(version.created_at)}</span>
                        <span class="px-1.5 py-0.5 rounded bg-luna-surface text-[10px] text-luna-text-muted">{version.version_number ? `v${version.version_number}` : 'manual'}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <button
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border border-luna-border text-luna-text-secondary hover:bg-luna-primary hover:text-white hover:border-luna-primary transition-all"
                        on:click|stopPropagation={() => handleRollback(version)}
                        disabled={isRollingBack}
                      >
                        {isRollingBack ? 'Rolling...' : 'Rollback'}
                      </button>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-luna-text-muted transition-transform duration-200 {selectedVersion === version.id ? 'rotate-180' : ''}"
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  <!-- Expanded Details -->
                  {#if selectedVersion === version.id}
                    <div class="mt-4 pt-4 border-t border-luna-border" in:slide={{ duration: 200 }}>
                      <p class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider mb-2">Changes</p>
                      <div class="space-y-1.5">
                        {#each getChanges(version) as change}
                          <div class="flex items-start gap-2 text-sm text-luna-text-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500 flex-shrink-0 mt-0.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                            <span>{change}</span>
                          </div>
                        {/each}
                      </div>

                      <!-- Diff Preview -->
                      {#if getChanges(version).length > 0}
                        <div class="mt-4 p-3 rounded-lg bg-luna-surface font-mono text-xs text-luna-text-muted overflow-x-auto">
                          <pre class="whitespace-pre-wrap">{getDiffPreview(version)}</pre>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if $versionHistory.length === 0 && !isLoading}
      <div class="flex flex-col items-center justify-center py-16 text-center" in:fade={{ duration: 300 }}>
        <div class="w-16 h-16 rounded-2xl bg-luna-surface flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-luna-text-muted"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h3 class="text-base font-semibold text-luna-text mb-1">No Versions Yet</h3>
        <p class="text-sm text-luna-text-muted">Save versions to track your progress and rollback if needed.</p>
      </div>
    {/if}
  </div>
</div>
