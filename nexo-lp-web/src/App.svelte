<script>
  import { onMount } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import {
    currentView,
    notification,
    messages,
    preview,
    isGenerating,
    generationEvents,
    session,
    tokens,
    currencies,
    showNotification,
    kimiChatUrl,
    contextWarning,
    contextUsagePercent,
    contextInfo,
    currentTemplate,
  } from './stores.js';
  import { lpClient } from './lib/lpClient.js';
  import { createBlobUrl } from './lib/previewBuilder.js';
  import { projectNameFromPrompt } from './lib/projectName.js';
  import { getSession, renameSession, deleteSession, getSessionDownloadUrl } from './api.js';
  import LandingPageCreator from './components/LandingPageCreator.svelte';
  import LPTemplateStore from './components/LPTemplateStore.svelte';
  import LunaStarfield from './components/LunaStarfield.svelte';

  let sidebarCollapsed = false;
  let recentSessions = [];
  let loadingSessions = false;
  let openMenuSessionId = null;
  let menuTriggerRect = null;

  $: menuSession = recentSessions.find((s) => s.id === openMenuSessionId);

  const SESSION_STORAGE_KEY = 'nexo-lp-current-session';

  const WELCOME_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content: "Hi! I'm Luna, your landing page creator. Tell me what you'd like to build, and I'll make the magic happen.",
    timestamp: Date.now(),
    type: 'text',
  };

  function syncContextStores() {
    kimiChatUrl.set(lpClient.getKimiChatUrl());
    contextWarning.set(lpClient.getContextWarning());
    contextInfo.set(lpClient.getContextInfo());
  }

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('generating', $isGenerating);
  }

  onMount(async () => {
    await loadRecentSessions();

    // Support loading a specific session via URL query param
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session');
    if (sessionFromUrl) {
      const projectName = urlParams.get('project') || 'Untitled Project';
      await loadSessionById(sessionFromUrl, projectName);
      return;
    }

    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      try {
        const savedSession = JSON.parse(saved);
        if (savedSession.id) {
          await loadSessionById(savedSession.id, savedSession.projectName || 'Untitled Project');
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  });

  async function loadRecentSessions() {
    loadingSessions = true;
    try {
      const result = await lpClient.listSessions(1, 50);
      recentSessions = (result.sessions || []).map((s) => ({
        id: s.id,
        projectName: projectNameFromPrompt(s.initial_prompt || s.initialPrompt, s.name || 'Untitled Project'),
        status: s.status,
        updatedAt: s.updated_at,
        createdAt: s.created_at,
      }));
    } catch (error) {
      console.error('Failed to load recent sessions:', error);
      recentSessions = [];
    } finally {
      loadingSessions = false;
    }
  }

  async function loadSessionById(sessionId, projectName) {
    try {
      await lpClient.setSession(sessionId, projectName || 'Untitled Project');
      session.set({
        id: lpClient.sessionId,
        projectName: lpClient.projectName,
        createdAt: lpClient.messageHistory[0]?.timestamp || Date.now(),
      });
      syncContextStores();
      currentTemplate.set(null);
      messages.set([
        WELCOME_MESSAGE,
        ...lpClient.messageHistory.map((m, i) => ({
          id: `msg_${m.timestamp || Date.now()}_${i}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || Date.now(),
          type: m.type || 'text',
          metadata: m.metadata || {},
        })),
      ]);
      // Refresh preview if session has generated HTML
      try {
        const s = await getSession(sessionId);
        if (s?.current_html) {
          preview.set({
            html: s.current_html,
            blobUrl: createBlobUrl(s.current_html),
            lastUpdated: Date.now(),
            device: 'desktop',
          });
        }
      } catch (e) {
        // ignore
      }
      currentView.set('chat');
    } catch (error) {
      console.error('Failed to load session:', error);
      showNotification('Failed to load project', 'error');
    }
  }

  function persistSession(s) {
    if (s.id) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
    }
  }

  $: if ($session.id) persistSession($session);

  function toggleSessionMenu(e, sessionId) {
    e.stopPropagation();
    if (openMenuSessionId === sessionId) {
      openMenuSessionId = null;
      menuTriggerRect = null;
    } else {
      openMenuSessionId = sessionId;
      menuTriggerRect = e.currentTarget.getBoundingClientRect();
    }
  }

  function closeSessionMenu() {
    openMenuSessionId = null;
    menuTriggerRect = null;
  }

  async function handleRenameSession(e, s) {
    e.stopPropagation();
    const newName = prompt('Rename project', s.projectName);
    if (newName && newName.trim()) {
      try {
        await renameSession(s.id, newName.trim());
        await loadRecentSessions();
        if ($session.id === s.id) {
          session.update((st) => ({ ...st, projectName: newName.trim() }));
        }
        showNotification('Project renamed', 'success');
      } catch (error) {
        console.error('Failed to rename session:', error);
        showNotification('Rename failed', 'error');
      }
    }
    openMenuSessionId = null;
  }

  async function handleDeleteSession(e, s) {
    e.stopPropagation();
    if (!confirm('Delete this project?')) {
      openMenuSessionId = null;
      return;
    }
    try {
      await deleteSession(s.id);
      recentSessions = recentSessions.filter((rs) => rs.id !== s.id);
      if ($session.id === s.id) {
        session.set({ id: null, createdAt: null, projectName: 'Untitled Project' });
        messages.set([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
        preview.set({ html: '', blobUrl: null, lastUpdated: null, device: 'desktop' });
        currentTemplate.set(null);
        kimiChatUrl.set(null);
        contextWarning.set('none');
        contextInfo.set({ size: 0, limit: 0 });
        currentView.set('chat');
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      showNotification('Project deleted', 'success');
    } catch (error) {
      console.error('Failed to delete session:', error);
      showNotification('Delete failed', 'error');
    }
    openMenuSessionId = null;
  }

  function handleDownloadSession(e, s) {
    e.stopPropagation();
    window.open(getSessionDownloadUrl(s.id), '_blank');
    openMenuSessionId = null;
  }

  const navItems = [
    { id: 'chat', label: 'Editor', icon: SparkleIcon },
    { id: 'templates', label: 'LOJA', icon: TemplateIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  function SparkleIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size || 20}" height="${props.size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
  }

  function TemplateIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size || 20}" height="${props.size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>`;
  }

  function SettingsIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size || 20}" height="${props.size || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }

  function LogoIcon(props) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${props.size || 24}" height="${props.size || 24}" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366F1"/><stop offset="100%" style="stop-color:#8B5CF6"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#logoGrad)"/><path d="M8 12l3 3 5-6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
  }

  function dismissNotification() {
    notification.set({ message: '', type: '', visible: false });
  }
</script>

<!-- ===== NOTIFICATION TOAST ===== -->
{#if $notification.visible}
  <div
    class="fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border border-white/20 backdrop-blur-sm toast-enter"
    class:bg-emerald-500={$notification.type === 'success'}
    class:bg-red-500={$notification.type === 'error'}
    class:bg-luna-primary={$notification.type === 'info'}
    class:bg-amber-500={$notification.type === 'warning'}
    transition:slide={{ duration: 200, easing: quintOut }}
  >
    <span class="text-white text-sm font-medium">{$notification.message}</span>
    <button
      class="text-white/70 hover:text-white transition-colors"
      on:click={dismissNotification}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  </div>
{/if}

<svelte:window on:click={closeSessionMenu} />

<!-- ===== IMMERSIVE STARFIELD BACKGROUND ===== -->
<LunaStarfield active={$isGenerating} />

<!-- ===== DARK OVERLAY DURING GENERATION ===== -->
<div
  class="fixed inset-0 z-[5] pointer-events-none bg-black transition-opacity duration-700 ease-in-out"
  style="opacity: {$isGenerating ? 0.35 : 0};"
></div>

<!-- ===== MAIN LAYOUT ===== -->
<div
  class="flex h-screen w-full overflow-hidden relative z-10 transition-colors duration-700"
  class:bg-luna-surface={!$isGenerating}
  class:bg-transparent={$isGenerating}
>

  <!-- ===== LEFT SIDEBAR ===== -->
  <aside
    class="flex-shrink-0 h-full bg-white border-r border-luna-border flex flex-col transition-all duration-500 ease-in-out overflow-hidden"
    class:w-64={!sidebarCollapsed && !$isGenerating}
    class:w-16={sidebarCollapsed && !$isGenerating}
    class:w-0={$isGenerating}
    class:opacity-0={$isGenerating}
  >
    <!-- Logo Area -->
    <div class="flex items-center gap-3 px-4 h-16 border-b border-luna-border flex-shrink-0">
      <div class="flex items-center justify-center w-8 h-8 flex-shrink-0">
        {@html LogoIcon({ size: 28 })}
      </div>
      {#if !sidebarCollapsed}
        <div class="overflow-hidden" transition:fade={{ duration: 150 }}>
          <span class="font-bold text-lg tracking-tight gradient-text">NEXO</span>
        </div>
      {/if}
      <button
        class="ml-auto text-luna-text-muted hover:text-luna-text transition-colors p-1 rounded-lg hover:bg-luna-surface"
        class:ml-auto={!sidebarCollapsed}
        class:mx-auto={sidebarCollapsed}
        on:click={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if sidebarCollapsed}
            <path d="m9 18 6-6-6-6"/>
          {:else}
            <path d="m15 18-6-6 6-6"/>
          {/if}
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-1">
      {#each navItems as item}
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group"
          class:bg-luna-primary={$currentView === item.id}
          class:text-white={$currentView === item.id}
          class:bg-transparent={$currentView !== item.id}
          class:text-luna-text-secondary={$currentView !== item.id}
          class:hover:bg-luna-surface={$currentView !== item.id}
          class:hover:text-luna-text={$currentView !== item.id}
          on:click={() => currentView.set(item.id)}
        >
          <span class="flex-shrink-0 flex items-center justify-center w-5 h-5">
            {@html item.icon({ size: 18 })}
          </span>
          {#if !sidebarCollapsed}
            <span class="truncate" transition:fade={{ duration: 150 }}>{item.label}</span>
          {/if}
        </button>
      {/each}

      <!-- Divider -->
      {#if !sidebarCollapsed}
        <div class="pt-4 pb-2 px-3">
          <div class="h-px bg-luna-border"></div>
        </div>
      {:else}
        <div class="pt-4 pb-2 px-3">
          <div class="h-px bg-luna-border mx-auto" class:w-6={sidebarCollapsed}></div>
        </div>
      {/if}

      <!-- New Project Button -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border border-dashed border-luna-border text-luna-text-muted hover:text-luna-text hover:border-luna-primary hover:bg-luna-primary/5"
        on:click={() => {
          if (confirm('Start a new project? Your current progress will be saved.')) {
            lpClient.reset();
            localStorage.removeItem(SESSION_STORAGE_KEY);
            session.set({ id: null, createdAt: null, projectName: 'Untitled Project' });
            messages.set([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
            preview.set({ html: '', blobUrl: null, lastUpdated: null, device: 'desktop' });
            currentTemplate.set(null);
            kimiChatUrl.set(null);
            contextWarning.set('none');
            contextInfo.set({ size: 0, limit: 0 });
            isGenerating.set(false);
            generationEvents.set([]);
            currentView.set('chat');
            showNotification('New project started!', 'success');
          }
        }}
      >
        <span class="flex-shrink-0 flex items-center justify-center w-5 h-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </span>
        {#if !sidebarCollapsed}
          <span transition:fade={{ duration: 150 }}>New Project</span>
        {/if}
      </button>

      <!-- Recent Projects -->
      {#if !sidebarCollapsed}
        <div class="pt-4 pb-2 px-3">
          <div class="h-px bg-luna-border"></div>
        </div>
        <div class="px-3 pb-2">
          <span class="text-xs font-semibold text-luna-text-muted uppercase tracking-wider">Recent Projects</span>
        </div>
        <div class="space-y-1 px-3 overflow-y-auto max-h-[60vh]" on:scroll={closeSessionMenu}>
          {#if loadingSessions}
            <div class="px-3 py-2 text-xs text-luna-text-muted">Loading...</div>
          {:else if recentSessions.length === 0}
            <div class="px-3 py-2 text-xs text-luna-text-muted">No projects yet</div>
          {:else}
            {#each recentSessions as s (s.id)}
              <div class="relative group">
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors hover:bg-luna-surface"
                  class:bg-luna-surface={$session.id === s.id}
                  class:text-luna-primary={$session.id === s.id}
                  class:text-luna-text-secondary={$session.id !== s.id}
                  on:click={() => { closeSessionMenu(); loadSessionById(s.id, s.projectName); }}
                  title={s.projectName}
                >
                  <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </span>
                  <span class="truncate flex-1 pr-5">{s.projectName}</span>
                </button>
                <button
                  class="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md text-luna-text-muted hover:text-luna-text hover:bg-luna-border/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="Project options"
                  aria-label="Project options"
                  on:click|stopPropagation={(e) => toggleSessionMenu(e, s.id)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
                </button>
              </div>
            {/each}
          {/if}
        </div>
        {#if menuSession && menuTriggerRect}
          <div
            class="fixed w-32 bg-white border border-luna-border rounded-lg shadow-lg py-1 z-50"
            style="top: {menuTriggerRect.bottom + 4}px; left: {menuTriggerRect.right}px; transform: translateX(-100%);"
            role="menu"
            tabindex="-1"
            on:click|stopPropagation={() => {}}
            on:keydown|stopPropagation={() => {}}
          >
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-luna-text-secondary hover:bg-luna-surface hover:text-luna-text flex items-center gap-2"
              on:click|stopPropagation={(e) => handleRenameSession(e, menuSession)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Rename
            </button>
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-luna-text-secondary hover:bg-luna-surface hover:text-luna-text flex items-center gap-2"
              on:click|stopPropagation={(e) => handleDownloadSession(e, menuSession)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download
            </button>
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              on:click|stopPropagation={(e) => handleDeleteSession(e, menuSession)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete
            </button>
          </div>
        {/if}
      {/if}
    </nav>

    <!-- Bottom Section -->
    <div class="p-3 border-t border-luna-border flex-shrink-0">
      {#if !sidebarCollapsed}
        <div class="bg-gradient-to-br from-luna-primary/10 to-luna-purple/10 rounded-xl p-3 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span class="text-xs font-medium text-luna-text-secondary">Luna Ready</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1 text-amber-600" title="Estrelas">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              {$currencies.stars}
            </span>
            <span class="flex items-center gap-1 text-orange-500" title="Sóis">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              {$currencies.suns}
            </span>
            <span class="flex items-center gap-1 text-indigo-500" title="Lunas">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              {$currencies.moons}
            </span>
          </div>
        </div>
      {:else}
        <div class="flex justify-center">
          <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Luna Ready"></div>
        </div>
      {/if}
    </div>
  </aside>

  <!-- ===== MAIN CONTENT AREA ===== -->
  <main class="flex-1 flex flex-col h-full overflow-hidden relative">
    <!-- Top Bar -->
    <header
      class="h-16 flex items-center justify-between px-6 flex-shrink-0 z-10 transition-colors duration-700"
      class:bg-white={!$isGenerating}
      class:bg-opacity-80={!$isGenerating}
      class:backdrop-blur-sm={!$isGenerating}
      class:border-b={!$isGenerating}
      class:border-luna-border={!$isGenerating}
      class:bg-black={$isGenerating}
      class:bg-opacity-40={$isGenerating}
      class:backdrop-blur-md={$isGenerating}
      class:border-white={$isGenerating}
      class:border-opacity-10={$isGenerating}
    >
      <div class="flex items-center gap-3">
        <h1
          class="text-sm font-semibold transition-colors duration-700"
          class:text-luna-text={!$isGenerating}
          class:text-white={$isGenerating}
        >
          {$session.projectName}
        </h1>
        {#if $currentTemplate}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200">
            Using template: {$currentTemplate.name}
          </span>
        {/if}
        {#if $isGenerating}
          <div class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-luna-primary/10 text-luna-primary text-xs font-medium animate-pulse">
            <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Generating...
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if $session.id && $kimiChatUrl}
          <a
            href={$kimiChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors {$isGenerating ? 'bg-white bg-opacity-10 text-white border-white border-opacity-20 hover:bg-white hover:bg-opacity-20' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}"
            title="Open this session in Kimi"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            Open in Kimi
          </a>
        {/if}
        {#if $contextWarning !== 'none'}
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border {$contextWarning === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}"
            title={$contextWarning === 'critical' ? 'Critical: near Kimi context limit' : 'Approaching Kimi context limit'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            Context: {$contextUsagePercent}%
          </span>
        {/if}
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all {$isGenerating ? 'text-white text-opacity-70 hover:text-white hover:bg-white hover:bg-opacity-10' : 'text-luna-text-secondary hover:text-luna-text hover:bg-luna-surface'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          <span class="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      {#if $currentView === 'chat'}
        <LandingPageCreator />
      {:else if $currentView === 'templates'}
        <LPTemplateStore />
      {:else if $currentView === 'settings'}
        <div class="h-full flex items-center justify-center">
          <div class="text-center space-y-4 max-w-md mx-auto p-8" in:fade={{ duration: 300 }}>
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-luna-primary/10 to-luna-purple/10 flex items-center justify-center mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-luna-primary"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <h2 class="text-xl font-semibold text-luna-text">Settings</h2>
            <p class="text-luna-text-muted text-sm">Configure your workspace preferences, API keys, and integrations.</p>
            <div class="space-y-3 text-left pt-4">
              <div class="p-4 rounded-xl border border-luna-border bg-white space-y-2">
                <label class="block text-sm font-medium text-luna-text">Project Name</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-luna-border bg-white text-sm input-focus transition-all"
                  value={$session.projectName}
                  on:change={(e) => session.update(s => ({ ...s, projectName: e.target.value }))}
                />
              </div>
              <div class="p-4 rounded-xl border border-luna-border bg-white space-y-2">
                <label class="block text-sm font-medium text-luna-text">Theme</label>
                <div class="flex gap-2">
                  <button class="px-3 py-1.5 rounded-lg bg-luna-primary text-white text-xs font-medium">Light</button>
                  <button class="px-3 py-1.5 rounded-lg bg-luna-surface text-luna-text-muted text-xs font-medium border border-luna-border cursor-not-allowed opacity-50" title="Coming soon">Dark</button>
                </div>
              </div>
              <div class="p-4 rounded-xl border border-luna-border bg-white space-y-2">
                <label class="block text-sm font-medium text-luna-text">API Endpoint</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 rounded-lg border border-luna-border bg-white text-sm input-focus transition-all"
                  value={import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}
                  disabled
                />
                <p class="text-xs text-luna-text-muted">Set via VITE_API_URL environment variable</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

  </main>
</div>
