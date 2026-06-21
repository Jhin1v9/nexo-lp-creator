<script>
  import { onMount, tick } from 'svelte';
  import { fade, fly, slide, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentView, showNotification, adminLiveEvents } from '../stores.js';
  import { adminLiveEvents as liveEvents } from './admin/AdminSSEStore.js';
  import {
    getAdminStats,
    creditAdminCurrency,
    deductAdminCurrency,
  } from '../api.js';

  import LPAdminOverview from './admin/LPAdminOverview.svelte';
  import LPAdminTemplates from './admin/LPAdminTemplates.svelte';
  import LPAdminAnalytics from './admin/LPAdminAnalytics.svelte';
  import LPAdminUsers from './admin/LPAdminUsers.svelte';
  import LPAdminOperations from './admin/LPAdminOperations.svelte';
  import LPAdminSessions from './admin/LPAdminSessions.svelte';
  import LPAdminMining from './admin/LPAdminMining.svelte';
  import LPAdminSettings from './admin/LPAdminSettings.svelte';

  import {
    LayoutDashboardIcon,
    LayersIcon,
    BarChartIcon,
    UsersIcon,
    ActivityIcon,
    MessageSquareIcon,
    CpuIcon,
    SettingsIcon,
    SearchIcon,
    CommandIcon,
    LogOutIcon,
    ArrowLeftIcon,
    TerminalIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    SparklesIcon,
    CreditCardIcon,
    XIcon,
    RefreshCwIcon,
  } from './admin/adminIcons.js';

  const ADMIN_TOKEN_KEY = 'nexo_admin_token';

  let checkingAuth = true;
  let isAuthenticated = false;
  let passwordInput = '';
  let authError = '';

  let activeModule = 'overview';
  let terminalOpen = true;
  let logs = [];
  let isMobile = false;
  let terminalEl;

  let moduleRef;

  let paletteOpen = false;
  let paletteQuery = '';
  let paletteIndex = 0;

  let creditOpen = false;
  let creditUserId = '';
  let creditAmount = '';
  let creditCurrency = 'stars';
  let creditMode = 'credit';

  const modules = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
    { id: 'templates', label: 'Templates', icon: LayersIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'operations', label: 'Operations', icon: ActivityIcon },
    { id: 'sessions', label: 'Sessions', icon: MessageSquareIcon },
    { id: 'mining', label: 'Mining', icon: CpuIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  function goBackToNexo() {
    currentView.set('chat');
  }

  function addLog(message, type = 'info') {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: new Date().toLocaleTimeString([], { hour12: false }),
      message,
      type,
    };
    logs = [...logs, entry].slice(-100);
    tick().then(() => {
      if (terminalEl) terminalEl.scrollTop = terminalEl.scrollHeight;
    });
  }

  function handleApiError(error, fallback) {
    console.error(error);
    const msg = error?.message || fallback;
    showNotification(msg, 'error');
    addLog(`ERR: ${msg}`, 'error');
  }

  async function checkAuth() {
    checkingAuth = true;
    authError = '';
    try {
      await getAdminStats();
      isAuthenticated = true;
      addLog('Authenticated with Nexo Command Center', 'success');
    } catch (error) {
      if (error.status === 401) {
        isAuthenticated = false;
        addLog('Admin token invalid or missing', 'warning');
      } else {
        authError = error.message || 'Unable to reach admin backend';
      }
    } finally {
      checkingAuth = false;
    }
  }

  async function login() {
    if (!passwordInput.trim()) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, passwordInput.trim());
    await checkAuth();
    if (isAuthenticated) {
      passwordInput = '';
      showNotification('Welcome, commander.', 'success');
    } else {
      authError = authError || 'Invalid admin token';
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    isAuthenticated = false;
    logs = [];
    activeModule = 'overview';
    addLog('Logged out', 'info');
  }

  function checkMobile() {
    isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  }

  function switchModule(id) {
    activeModule = id;
    paletteOpen = false;
    paletteQuery = '';
  }

  function refreshActive() {
    if (moduleRef && typeof moduleRef.refresh === 'function') {
      moduleRef.refresh();
      addLog(`Refreshed ${activeModule}`, 'success');
    }
  }

  async function handleCreditSubmit() {
    if (!creditUserId.trim() || !creditAmount) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      showNotification('Invalid amount', 'warning');
      return;
    }
    try {
      if (creditMode === 'credit') {
        await creditAdminCurrency(creditUserId.trim(), creditCurrency, amount);
        addLog(`Credited ${amount} ${creditCurrency} to ${creditUserId}`, 'success');
      } else {
        await deductAdminCurrency(creditUserId.trim(), creditCurrency, amount);
        addLog(`Deducted ${amount} ${creditCurrency} from ${creditUserId}`, 'success');
      }
      showNotification('Currency operation completed', 'success');
      creditUserId = '';
      creditAmount = '';
      creditOpen = false;
    } catch (error) {
      handleApiError(error, 'Currency operation failed');
    }
  }

  const paletteActions = [
    { id: 'go-overview', label: 'Go to Overview', icon: LayoutDashboardIcon, run: () => switchModule('overview') },
    { id: 'go-templates', label: 'Go to Templates', icon: LayersIcon, run: () => switchModule('templates') },
    { id: 'go-analytics', label: 'Go to Analytics', icon: BarChartIcon, run: () => switchModule('analytics') },
    { id: 'go-users', label: 'Go to Users', icon: UsersIcon, run: () => switchModule('users') },
    { id: 'go-operations', label: 'Go to Operations', icon: ActivityIcon, run: () => switchModule('operations') },
    { id: 'go-sessions', label: 'Go to Sessions', icon: MessageSquareIcon, run: () => switchModule('sessions') },
    { id: 'go-mining', label: 'Go to Mining', icon: CpuIcon, run: () => switchModule('mining') },
    { id: 'go-settings', label: 'Go to Settings', icon: SettingsIcon, run: () => switchModule('settings') },
    { id: 'sanitize-unreviewed', label: 'Sanitize unreviewed templates', icon: SparklesIcon, run: sanitizeUnreviewed },
    { id: 'credit-user', label: 'Credit / Deduct user', icon: CreditCardIcon, run: () => creditOpen = true },
    { id: 'refresh-module', label: 'Refresh current module', icon: LayoutDashboardIcon, run: refreshActive },
  ];

  $: filteredActions = paletteQuery.trim()
    ? paletteActions.filter((a) => a.label.toLowerCase().includes(paletteQuery.toLowerCase()))
    : paletteActions;

  async function sanitizeUnreviewed() {
    paletteOpen = false;
    paletteQuery = '';
    if (activeModule !== 'templates') switchModule('templates');
    setTimeout(() => {
      if (moduleRef && typeof moduleRef.sanitizeUnreviewed === 'function') {
        moduleRef.sanitizeUnreviewed();
      }
    }, 100);
  }

  function executeAction(action) {
    action.run();
  }

  function handlePaletteKey(e) {
    if (!paletteOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteIndex = (paletteIndex + 1) % Math.max(filteredActions.length, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteIndex = (paletteIndex - 1 + Math.max(filteredActions.length, 1)) % Math.max(filteredActions.length, 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[paletteIndex]) executeAction(filteredActions[paletteIndex]);
    } else if (e.key === 'Escape') {
      paletteOpen = false;
      paletteQuery = '';
    }
  }

  function handleGlobalKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      paletteOpen = true;
      paletteQuery = '';
      paletteIndex = 0;
    }
  }

  onMount(() => {
    checkMobile();
    const onResize = () => checkMobile();
    window.addEventListener('resize', onResize);
    liveEvents.connect();

    if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
      checkAuth();
    } else {
      checkingAuth = false;
      isAuthenticated = false;
    }

    return () => {
      window.removeEventListener('resize', onResize);
      liveEvents.disconnect();
    };
  });

  $: activeModuleLabel = modules.find((m) => m.id === activeModule)?.label || 'Admin';
</script>

<svelte:window on:keydown={handleGlobalKey} />

{#if !isAuthenticated}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-6" in:fade={{ duration: 200 }}>
    <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div class="mb-6 flex items-center justify-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-luna-primary/10 text-luna-primary">
          {@html CommandIcon({ size: 24 })}
        </div>
      </div>
      <h1 class="mb-2 text-center text-xl font-semibold text-slate-900">Nexo Command Center</h1>
      <p class="mb-6 text-center text-sm text-slate-500">Admin authentication required</p>

      <form on:submit|preventDefault={login} class="space-y-4">
        <div>
          <label class="mb-1.5 block text-xs font-medium text-slate-500">Admin token</label>
          <input
            type="password"
            bind:value={passwordInput}
            placeholder="Enter your admin token"
            class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-luna-primary focus:ring-1 focus:ring-luna-primary/30"
          />
        </div>
        {#if authError}
          <div class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" transition:slide={{ duration: 150 }}>
            {authError}
          </div>
        {/if}
        <button
          type="submit"
          disabled={checkingAuth || !passwordInput.trim()}
          class="w-full rounded-lg bg-luna-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-luna-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkingAuth ? 'Verifying...' : 'Authenticate'}
        </button>
      </form>
    </div>
  </div>
{/if}

{#if isAuthenticated}
  <div class="flex h-screen w-full bg-slate-50 text-slate-900" in:fade={{ duration: 200 }}>
    <!-- Desktop sidebar -->
    <aside class="hidden h-full w-16 flex-shrink-0 flex-col items-center border-r border-slate-200 bg-white py-4 md:flex">
      <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-luna-primary text-white shadow-sm">
        {@html CommandIcon({ size: 20 })}
      </div>
      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto">
        {#each modules as m}
          <button
            class="flex w-full flex-col items-center justify-center py-2 transition-colors"
            class:text-luna-primary={activeModule === m.id}
            class:text-slate-500={activeModule !== m.id}
            class:bg-slate-50={activeModule === m.id}
            on:click={() => switchModule(m.id)}
            title={m.label}
          >
            {@html m.icon({ size: 18 })}
            <span class="mt-0.5 text-[9px]">{m.label}</span>
          </button>
        {/each}
      </nav>
      <button
        on:click={() => creditOpen = true}
        class="mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-luna-primary"
        title="Credit / Deduct"
      >
        {@html CreditCardIcon({ size: 16 })}
      </button>
      <button
        on:click={logout}
        class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        title="Logout"
      >
        {@html LogOutIcon({ size: 16 })}
      </button>
    </aside>

    <!-- Mobile bottom nav -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      {#each modules as m}
        <button
          class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors"
          class:text-luna-primary={activeModule === m.id}
          class:text-slate-500={activeModule !== m.id}
          on:click={() => switchModule(m.id)}
          aria-label={m.label}
        >
          {@html m.icon({ size: 18 })}
          <span class="text-[9px]">{m.label}</span>
        </button>
      {/each}
      <button
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-slate-500 transition-colors hover:text-red-600"
        on:click={logout}
        aria-label="Logout"
      >
        {@html LogOutIcon({ size: 18 })}
        <span class="text-[9px]">Logout</span>
      </button>
    </nav>

    <!-- Main content -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Top bar -->
      <header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div class="flex items-center gap-3">
          <button
            on:click={goBackToNexo}
            class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            title="Back to NEXO LP"
          >
            {@html ArrowLeftIcon({ size: 14 })}
            <span class="hidden sm:inline">Back to NEXO LP</span>
          </button>
          <h1 class="text-sm font-semibold text-slate-900">{activeModuleLabel}</h1>
          <span class="rounded-full border border-luna-primary/20 bg-luna-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-luna-primary">
            Admin
          </span>
          {#if $adminLiveEvents.connected}
            <span class="hidden h-2 w-2 rounded-full bg-emerald-500 sm:inline-block" title="Live events connected"></span>
          {:else}
            <span class="hidden h-2 w-2 rounded-full bg-red-500 sm:inline-block" title="Live events disconnected"></span>
          {/if}
        </div>
        <div class="flex items-center gap-3">
          <button
            on:click={() => { paletteOpen = true; paletteQuery = ''; paletteIndex = 0; }}
            class="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 md:flex"
          >
            {@html SearchIcon({ size: 14 })}
            <span>Search or run command</span>
            <kbd class="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <button
            on:click={() => { paletteOpen = true; paletteQuery = ''; paletteIndex = 0; }}
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
            title="Command palette"
          >
            {@html SearchIcon({ size: 16 })}
          </button>
          <button
            on:click={refreshActive}
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Refresh"
          >
            {@html RefreshCwIcon({ size: 16 })}
          </button>
        </div>
      </header>

      <!-- Module -->
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-24 md:p-8">
        {#if activeModule === 'overview'}
          <LPAdminOverview
            bind:this={moduleRef}
            on:switchModule={(e) => switchModule(e.detail.id)}
            on:openCredit={() => creditOpen = true}
            on:backToNexo={goBackToNexo}
          />
        {:else if activeModule === 'templates'}
          <LPAdminTemplates bind:this={moduleRef} />
        {:else if activeModule === 'analytics'}
          <LPAdminAnalytics bind:this={moduleRef} />
        {:else if activeModule === 'users'}
          <LPAdminUsers bind:this={moduleRef} />
        {:else if activeModule === 'operations'}
          <LPAdminOperations bind:this={moduleRef} />
        {:else if activeModule === 'sessions'}
          <LPAdminSessions bind:this={moduleRef} />
        {:else if activeModule === 'mining'}
          <LPAdminMining bind:this={moduleRef} />
        {:else if activeModule === 'settings'}
          <LPAdminSettings bind:this={moduleRef} />
        {/if}
      </main>

      <!-- Terminal drawer -->
      <div
        class="flex-shrink-0 border-t border-slate-200 bg-white transition-all"
        class:h-48={terminalOpen}
        class:h-8={!terminalOpen}
        class:mb-14={isMobile && terminalOpen}
      >
        <button
          on:click={() => terminalOpen = !terminalOpen}
          class="flex h-8 w-full items-center justify-between px-4 text-xs text-slate-500 hover:text-slate-900"
        >
          <div class="flex items-center gap-2">
            {@html TerminalIcon({ size: 12 })}
            <span>Admin logs ({logs.length})</span>
          </div>
          {@html terminalOpen ? ChevronDownIcon({ size: 12 }) : ChevronUpIcon({ size: 12 })}
        </button>
        {#if terminalOpen}
          <div bind:this={terminalEl} class="h-40 overflow-y-auto px-4 pb-2 font-mono text-[11px] leading-5">
            {#each logs as log (log.id)}
              <div class="flex gap-2">
                <span class="text-slate-400">[{log.time}]</span>
                <span
                  class="font-semibold"
                  class:text-emerald-600={log.type === 'success'}
                  class:text-amber-600={log.type === 'warning'}
                  class:text-red-600={log.type === 'error'}
                  class:text-luna-primary={log.type === 'info'}
                >{log.type.toUpperCase()}</span>
                <span class="text-slate-600">{log.message}</span>
              </div>
            {:else}
              <div class="text-slate-400">Waiting for activity...</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Command palette -->
{#if paletteOpen}
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
    on:click={() => { paletteOpen = false; paletteQuery = ''; }}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      on:click|stopPropagation
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        {@html SearchIcon({ size: 18 })}
        <input
          type="text"
          bind:value={paletteQuery}
          on:keydown={handlePaletteKey}
          placeholder="Type a command..."
          class="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          autofocus
        />
        <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
      </div>
      <div class="max-h-[50vh] overflow-y-auto py-2">
        {#each filteredActions as action, i (action.id)}
          <button
            on:click={() => executeAction(action)}
            on:mouseenter={() => paletteIndex = i}
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors {paletteIndex === i ? 'bg-luna-primary/10 text-luna-primary' : 'text-slate-600'}"
          >
            <span class="text-slate-400">{@html action.icon({ size: 16 })}</span>
            <span>{action.label}</span>
          </button>
        {:else}
          <div class="px-4 py-6 text-center text-xs text-slate-400">No commands match “{paletteQuery}”</div>
        {/each}
      </div>
      <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
        <span>↑↓ to navigate</span>
        <span>↵ to run</span>
      </div>
    </div>
  </div>
{/if}

<!-- Credit / Deduct modal -->
{#if creditOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    on:click={() => creditOpen = false}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      on:click|stopPropagation
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 class="text-sm font-semibold text-slate-900">Credit / Deduct currency</h3>
        <button on:click={() => creditOpen = false} class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          {@html XIcon({ size: 16 })}
        </button>
      </div>
      <div class="space-y-4 p-4">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-700">User ID</label>
          <input type="text" bind:value={creditUserId} placeholder="user-..." class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-luna-primary" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700">Currency</label>
            <select bind:value={creditCurrency} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-luna-primary">
              <option value="stars">Stars</option>
              <option value="suns">Suns</option>
              <option value="moons">Moons</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-700">Amount</label>
            <input type="number" bind:value={creditAmount} placeholder="0" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-luna-primary" />
          </div>
        </div>
        <div class="flex gap-2">
          <button
            on:click={() => { creditMode = 'credit'; handleCreditSubmit(); }}
            class="flex-1 rounded-lg bg-luna-primary px-3 py-2 text-sm font-medium text-white hover:bg-luna-primary-hover"
          >Credit</button>
          <button
            on:click={() => { creditMode = 'deduct'; handleCreditSubmit(); }}
            class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600"
          >Deduct</button>
        </div>
      </div>
    </div>
  </div>
{/if}
