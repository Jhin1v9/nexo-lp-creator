<script>
  import { fade, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { editorTab, isGenerating, hasPreview } from '../stores.js';
  import LPChatArea from './LPChatArea.svelte';
  import LPPreview from './LPPreview.svelte';
  import LPCodeEditor from './LPCodeEditor.svelte';
  import LPDeployPanel from './LPDeployPanel.svelte';
  import LPVersionHistory from './LPVersionHistory.svelte';
  import LPBugDetectorPanel from './LPBugDetectorPanel.svelte';

  const tabs = [
    { id: 'chat', label: 'Chat', icon: ChatIcon },
    { id: 'preview', label: 'Preview', icon: PreviewIcon },
    { id: 'code', label: 'Code', icon: CodeIcon },
    { id: 'deploy', label: 'Deploy', icon: DeployIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'bugs', label: 'Bugs', icon: BugIcon },
  ];

  function ChatIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
  }

  function PreviewIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  function CodeIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
  }

  function DeployIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
  }

  function HistoryIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`;
  }

  function BugIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size}" height="${props.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>`;
  }
</script>

<div class="flex flex-col h-full relative">
  <!-- Tab Bar -->
  <div
    class="flex-shrink-0 bg-white border-b border-luna-border px-4 transition-all duration-500 ease-in-out overflow-hidden"
    class:h-14={!$isGenerating}
    class:h-0={$isGenerating}
    class:opacity-0={$isGenerating}
  >
    <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {#each tabs as tab}
        <button
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap"
          class:border-luna-primary={$editorTab === tab.id}
          class:text-luna-primary={$editorTab === tab.id}
          class:border-transparent={$editorTab !== tab.id}
          class:text-luna-text-muted={$editorTab !== tab.id}
          class:hover:text-luna-text={$editorTab !== tab.id}
          on:click={() => editorTab.set(tab.id)}
        >
          <span class="flex items-center justify-center w-4 h-4">
            {@html tab.icon({ size: 16 })}
          </span>
          <span>{tab.label}</span>
          {#if tab.id === 'preview' && $hasPreview}
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {/if}
          {#if tab.id === 'bugs'}
            <span class="flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold">3</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Tab Content -->
  <div class="flex-1 overflow-hidden relative">
    {#if $editorTab === 'chat'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPChatArea />
      </div>
    {:else if $editorTab === 'preview'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPPreview />
      </div>
    {:else if $editorTab === 'code'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPCodeEditor />
      </div>
    {:else if $editorTab === 'deploy'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPDeployPanel />
      </div>
    {:else if $editorTab === 'history'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPVersionHistory />
      </div>
    {:else if $editorTab === 'bugs'}
      <div class="h-full" in:fade={{ duration: 200 }}>
        <LPBugDetectorPanel />
      </div>
    {/if}
  </div>

</div>
