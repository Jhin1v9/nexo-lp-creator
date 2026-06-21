<script>
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { preview, hasPreview } from '../stores.js';

  let iframe;
  let reloadKey = 0;
  let deviceMode = 'desktop';

  const devices = [
    { id: 'desktop', label: 'Desktop', width: '100%', icon: DesktopIcon },
    { id: 'tablet', label: 'Tablet', width: '768px', icon: TabletIcon },
    { id: 'mobile', label: 'Mobile', width: '375px', icon: MobileIcon },
  ];

  function DesktopIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`;
  }

  function TabletIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`;
  }

  function MobileIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>`;
  }

  function handleReload() {
    reloadKey++;
    if (iframe) {
      iframe.srcdoc = iframe.srcdoc;
    }
  }

  function handleDeviceChange(device) {
    deviceMode = device;
    preview.update((p) => ({ ...p, device }));
  }

  $: previewHtml = $preview.html || '';
  $: hasContent = $hasPreview;
</script>

<div class="flex flex-col h-full bg-luna-surface">
  <!-- Toolbar -->
  <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-luna-border">
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider">Preview</span>
      {#if hasContent}
        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">Live</span>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <!-- Device Toggles -->
      <div class="flex items-center bg-luna-surface rounded-lg p-0.5 border border-luna-border">
        {#each devices as device}
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
            class:bg-white={deviceMode === device.id}
            class:text-luna-text={deviceMode === device.id}
            class:shadow-sm={deviceMode === device.id}
            class:text-luna-text-muted={deviceMode !== device.id}
            class:hover:text-luna-text={deviceMode !== device.id}
            on:click={() => handleDeviceChange(device.id)}
            title={device.label}
          >
            <span class="flex items-center justify-center w-3.5 h-3.5">
              {@html device.icon({ size: 14 })}
            </span>
            <span class="hidden sm:inline">{device.label}</span>
          </button>
        {/each}
      </div>

      <!-- Reload Button -->
      <button
        class="flex items-center justify-center w-8 h-8 rounded-lg text-luna-text-muted hover:text-luna-text hover:bg-luna-surface transition-all"
        on:click={handleReload}
        title="Reload preview"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
      </button>
    </div>
  </div>

  <!-- Preview Area -->
  <div class="flex-1 overflow-auto p-4 flex items-start justify-center bg-luna-surface">
    {#if hasContent}
      <div
        class="transition-all duration-300 ease-in-out bg-white rounded-xl shadow-md overflow-hidden"
        style="width: {devices.find(d => d.id === deviceMode)?.width || '100%'}; min-height: 600px;"
        in:fade={{ duration: 300 }}
      >
        <iframe
          bind:this={iframe}
          key={reloadKey}
          srcdoc={previewHtml}
          title="Landing Page Preview"
          class="w-full h-full border-0"
          style="min-height: 600px;"
          loading="lazy"
        ></iframe>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-center py-20" in:fade={{ duration: 300 }}>
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-luna-primary/10 to-luna-purple/10 flex items-center justify-center mb-5 animate-float">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-luna-primary"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <h3 class="text-lg font-semibold text-luna-text mb-2">No Preview Yet</h3>
        <p class="text-sm text-luna-text-muted max-w-sm">
          Chat with Luna to generate your landing page. The preview will appear here automatically.
        </p>
      </div>
    {/if}
  </div>
</div>
