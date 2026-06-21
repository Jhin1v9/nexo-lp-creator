<script>
  import { onMount, tick } from 'svelte';
  import { fade, fly, slide, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { currentView, session, showNotification } from '../stores.js';

  function goBackToNexo() {
    currentView.set('chat');
  }
  import {
    API_BASE,
    getAdminStats,
    listAdminTemplates,
    updateAdminTemplate,
    approveAdminTemplate,
    deleteAdminTemplate,
    sanitizeAdminTemplate,
    bulkSanitizeAdminTemplates,
    bulkApproveAdminTemplates,
    bulkDeleteAdminTemplates,
    listAdminSessions,
    regenerateAdminSession,
    deleteAdminSession,
    listAdminPurchases,
    getAdminPurchasesSummary,
    creditAdminCurrency,
    deductAdminCurrency,
    listAdminMiningJobs,
    retryAdminMiningJob,
    pauseAdminMiningJob,
    resumeAdminMiningJob,
    getAdminSettings,
    updateAdminSettings,
    pushAdminFinance,
    getSession,
  } from '../api.js';

  const ADMIN_TOKEN_KEY = 'nexo_admin_token';

  // ============================================================
  // STATE
  // ============================================================
  let checkingAuth = true;
  let isAuthenticated = false;
  let passwordInput = '';
  let authError = '';

  let activeModule = 'overview';
  let terminalOpen = true;
  let logs = [];

  let stats = null;
  let templates = [];
  let sessions = [];
  let purchases = [];
  let purchasesSummary = [];
  let miningJobs = [];
  let settings = null;

  let templateFilter = { status: 'all', category: 'all', search: '' };
  let sessionSearch = '';
  let purchaseSearch = '';
  let miningSearch = '';

  let templateCategories = [];
  let selectedTemplateIds = new Set();
  let selectedTemplate = null;
  let templatePanelOpen = false;

  let paletteOpen = false;
  let paletteQuery = '';
  let paletteIndex = 0;

  let creditUserId = '';
  let creditAmount = '';
  let creditCurrency = 'stars';
  let creditMode = 'credit';

  let settingsForm = {
    mode: 'landing',
    frameworks: '',
    auto_publish: false,
    base_prompt: '',
    default_template: 0,
  };

  let isLoading = false;
  let terminalEl;
  let isMobile = false;

  function checkMobile() {
    isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  }

  // ============================================================
  // MODULES
  // ============================================================
  const modules = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
    { id: 'templates', label: 'Templates', icon: LayersIcon },
    { id: 'sessions', label: 'Sessions', icon: MessageSquareIcon },
    { id: 'purchases', label: 'Purchases', icon: CreditCardIcon },
    { id: 'mining', label: 'Mining', icon: CpuIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  // ============================================================
  // ICONS
  // ============================================================
  function LayoutDashboardIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`;
  }
  function LayersIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`;
  }
  function MessageSquareIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  }
  function CreditCardIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`;
  }
  function CpuIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`;
  }
  function SettingsIcon(props = {}) {
    const s = props.size || 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
  function SearchIcon(props = {}) {
    const s = props.size || 18;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
  }
  function CommandIcon(props = {}) {
    const s = props.size || 18;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>`;
  }
  function LogOutIcon(props = {}) {
    const s = props.size || 18;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`;
  }
  function ArrowLeftIcon(props = {}) {
    const s = props.size || 18;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
  }
  function TerminalIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>`;
  }
  function ChevronDownIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
  }
  function ChevronUpIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
  }
  function CheckIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  }
  function XIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  }
  function RefreshCwIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;
  }
  function TrashIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  }
  function ShieldCheckIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
  }
  function SparklesIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`;
  }
  function ExternalLinkIcon(props = {}) {
    const s = props.size || 16;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>`;
  }

  // ============================================================
  // HELPERS
  // ============================================================
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

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d) ? String(value) : d.toLocaleString();
  }

  function formatCurrency(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  function statusBadgeClasses(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'active' || s === 'running' || s === 'completed' || s === 'paid') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (s === 'pending' || s === 'unreviewed' || s === 'queued' || s === 'paused') {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
    if (s === 'rejected' || s === 'failed' || s === 'deleted' || s === 'error') {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  }

  function handleApiError(error, fallback) {
    console.error(error);
    const msg = error?.message || fallback;
    showNotification(msg, 'error');
    addLog(`ERR: ${msg}`, 'error');
  }

  // ============================================================
  // AUTH
  // ============================================================
  async function checkAuth() {
    checkingAuth = true;
    authError = '';
    try {
      stats = await getAdminStats();
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
    stats = null;
    templates = [];
    sessions = [];
    purchases = [];
    miningJobs = [];
    settings = null;
    logs = [];
    activeModule = 'overview';
    addLog('Logged out', 'info');
  }

  // ============================================================
  // DATA LOADING
  // ============================================================
  async function loadActiveModule() {
    if (!isAuthenticated) return;
    switch (activeModule) {
      case 'overview': await loadOverview(); break;
      case 'templates': await loadTemplates(); break;
      case 'sessions': await loadSessions(); break;
      case 'purchases': await loadPurchases(); break;
      case 'mining': await loadMining(); break;
      case 'settings': await loadSettings(); break;
    }
  }

  async function loadOverview() {
    isLoading = true;
    try {
      stats = await getAdminStats();
      addLog('Overview stats refreshed', 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load stats');
    } finally {
      isLoading = false;
    }
  }

  async function loadTemplates() {
    isLoading = true;
    try {
      const filters = { limit: 100 };
      if (templateFilter.status && templateFilter.status !== 'all') filters.status = templateFilter.status;
      if (templateFilter.category && templateFilter.category !== 'all') filters.category = templateFilter.category;
      if (templateFilter.search?.trim()) filters.search = templateFilter.search.trim();
      const data = await listAdminTemplates(filters);
      templates = data.templates || data || [];
      const cats = new Set(templates.map((t) => t.category).filter(Boolean));
      templateCategories = Array.from(cats).sort();
      selectedTemplateIds = new Set();
      addLog(`Loaded ${templates.length} templates`, 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load templates');
    } finally {
      isLoading = false;
    }
  }

  async function loadSessions() {
    isLoading = true;
    try {
      const data = await listAdminSessions({ search: sessionSearch, limit: 100 });
      sessions = data.sessions || data || [];
      addLog(`Loaded ${sessions.length} sessions`, 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load sessions');
    } finally {
      isLoading = false;
    }
  }

  async function loadPurchases() {
    isLoading = true;
    try {
      const [data, summary] = await Promise.all([
        listAdminPurchases({ search: purchaseSearch, limit: 100 }),
        getAdminPurchasesSummary(),
      ]);
      purchases = data.purchases || data || [];
      purchasesSummary = summary.summary || summary || [];
      addLog(`Loaded ${purchases.length} purchases`, 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load purchases');
    } finally {
      isLoading = false;
    }
  }

  async function loadMining() {
    isLoading = true;
    try {
      const data = await listAdminMiningJobs({ search: miningSearch, limit: 100 });
      miningJobs = data.jobs || data || [];
      addLog(`Loaded ${miningJobs.length} mining jobs`, 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load mining jobs');
    } finally {
      isLoading = false;
    }
  }

  async function loadSettings() {
    isLoading = true;
    try {
      settings = await getAdminSettings();
      const gen = settings.generation || {};
      const pricing = settings.pricing || {};
      settingsForm = {
        mode: gen.mode || 'landing',
        frameworks: Array.isArray(gen.frameworks) ? gen.frameworks.join(', ') : gen.frameworks || '',
        auto_publish: !!gen.auto_publish,
        base_prompt: gen.base_prompt || '',
        default_template: Number(pricing.default_template ?? gen.default_template_price ?? 0),
      };
      addLog('Settings loaded', 'success');
    } catch (error) {
      handleApiError(error, 'Failed to load settings');
    } finally {
      isLoading = false;
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  async function saveTemplateMeta() {
    if (!selectedTemplate) return;
    try {
      await updateAdminTemplate(selectedTemplate.id, {
        name: selectedTemplate.name,
        category: selectedTemplate.category,
        subcategory: selectedTemplate.subcategory,
        price: Number(selectedTemplate.price),
        status: selectedTemplate.status,
      });
      addLog(`Updated template ${selectedTemplate.id}`, 'success');
      showNotification('Template updated', 'success');
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Failed to update template');
    }
  }

  async function approveTemplate(id) {
    try {
      await approveAdminTemplate(id);
      addLog(`Approved template ${id}`, 'success');
      showNotification('Template approved', 'success');
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Failed to approve template');
    }
  }

  async function sanitizeTemplate(id) {
    try {
      await sanitizeAdminTemplate(id);
      addLog(`Sanitization queued for template ${id}`, 'success');
      showNotification('Sanitização iniciada — acompanhe na aba Operações', 'success');
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Failed to sanitize template');
    }
  }

  async function removeTemplate(id) {
    if (!confirm(`Delete template ${id}?`)) return;
    try {
      await deleteAdminTemplate(id);
      addLog(`Deleted template ${id}`, 'success');
      showNotification('Template deleted', 'success');
      if (selectedTemplate?.id === id) closeTemplatePanel();
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Failed to delete template');
    }
  }

  async function runBulk(action) {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0) {
      showNotification('No templates selected', 'warning');
      return;
    }
    try {
      if (action === 'sanitize') {
        if (!confirm(`Sanitize ${ids.length} templates?`)) return;
        await bulkSanitizeAdminTemplates(ids);
        addLog(`Bulk sanitization queued for ${ids.length} templates`, 'success');
      } else if (action === 'approve') {
        if (!confirm(`Approve ${ids.length} templates?`)) return;
        await bulkApproveAdminTemplates(ids);
        addLog(`Bulk approved ${ids.length} templates`, 'success');
      } else if (action === 'delete') {
        if (!confirm(`Delete ${ids.length} templates?`)) return;
        await bulkDeleteAdminTemplates(ids);
        addLog(`Bulk deleted ${ids.length} templates`, 'success');
      } else if (action === 'price') {
        const price = prompt('Set price for selected templates', '0');
        if (price === null) return;
        await Promise.all(ids.map((id) => updateAdminTemplate(id, { price: Number(price) })));
        addLog(`Set price ${price} for ${ids.length} templates`, 'success');
      }
      showNotification('Bulk action completed', 'success');
      selectedTemplateIds = new Set();
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Bulk action failed');
    }
  }

  async function openSessionInEditor(sessionId) {
    try {
      const s = await getSession(sessionId);
      session.set({
        id: s.id,
        projectName: s.name || s.initial_prompt || 'Untitled Project',
        createdAt: s.created_at || Date.now(),
      });
      currentView.set('chat');
      addLog(`Opened session ${sessionId} in editor`, 'success');
      showNotification('Session opened in editor', 'success');
    } catch (error) {
      handleApiError(error, 'Failed to open session');
    }
  }

  async function regenerateSession(id) {
    try {
      await regenerateAdminSession(id);
      addLog(`Regenerating session ${id}`, 'success');
      showNotification('Session regeneration started', 'success');
      await loadSessions();
    } catch (error) {
      handleApiError(error, 'Failed to regenerate session');
    }
  }

  async function removeSession(id) {
    if (!confirm(`Delete session ${id}?`)) return;
    try {
      await deleteAdminSession(id);
      addLog(`Deleted session ${id}`, 'success');
      showNotification('Session deleted', 'success');
      await loadSessions();
    } catch (error) {
      handleApiError(error, 'Failed to delete session');
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
      await loadPurchases();
    } catch (error) {
      handleApiError(error, 'Currency operation failed');
    }
  }

  async function pushPurchaseFinance(id) {
    try {
      await pushAdminFinance(id);
      addLog(`Pushed finance for purchase ${id}`, 'success');
      showNotification('Finance pushed', 'success');
      await loadPurchases();
    } catch (error) {
      handleApiError(error, 'Failed to push finance');
    }
  }

  async function controlMiningJob(id, action) {
    try {
      if (action === 'retry') await retryAdminMiningJob(id);
      if (action === 'pause') await pauseAdminMiningJob(id);
      if (action === 'resume') await resumeAdminMiningJob(id);
      addLog(`Mining job ${id} ${action}ed`, 'success');
      showNotification(`Job ${action}ed`, 'success');
      await loadMining();
    } catch (error) {
      handleApiError(error, `Failed to ${action} mining job`);
    }
  }

  async function saveSettings() {
    try {
      const payload = {
        generation: {
          mode: settingsForm.mode,
          frameworks: settingsForm.frameworks.split(',').map((s) => s.trim()).filter(Boolean),
          auto_publish: settingsForm.auto_publish,
          base_prompt: settingsForm.base_prompt,
        },
        pricing: {
          default_template: Number(settingsForm.default_template),
        },
      };
      await updateAdminSettings(payload);
      addLog('Settings saved', 'success');
      showNotification('Settings saved', 'success');
      await loadSettings();
    } catch (error) {
      handleApiError(error, 'Failed to save settings');
    }
  }

  // ============================================================
  // TEMPLATE PANEL
  // ============================================================
  function openTemplatePanel(tpl) {
    selectedTemplate = { ...tpl };
    templatePanelOpen = true;
  }

  function closeTemplatePanel() {
    templatePanelOpen = false;
    selectedTemplate = null;
  }

  function toggleTemplateSelection(id) {
    const next = new Set(selectedTemplateIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedTemplateIds = next;
  }

  function toggleAllTemplates() {
    if (filteredTemplates.length && filteredTemplates.every((t) => selectedTemplateIds.has(t.id))) {
      const next = new Set(selectedTemplateIds);
      filteredTemplates.forEach((t) => next.delete(t.id));
      selectedTemplateIds = next;
    } else {
      const next = new Set(selectedTemplateIds);
      filteredTemplates.forEach((t) => next.add(t.id));
      selectedTemplateIds = next;
    }
  }

  $: filteredTemplates = templates.filter((t) => {
    const matchesStatus = templateFilter.status === 'all' || (t.status || '').toLowerCase() === templateFilter.status;
    const matchesCategory = templateFilter.category === 'all' || t.category === templateFilter.category;
    const q = templateFilter.search.toLowerCase();
    const matchesSearch = !q ||
      (t.name || '').toLowerCase().includes(q) ||
      (t.id || '').toLowerCase().includes(q);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  $: filteredSessions = sessions.filter((s) => {
    const q = sessionSearch.toLowerCase();
    return !q ||
      (s.id || '').toLowerCase().includes(q) ||
      (s.name || s.project || '').toLowerCase().includes(q);
  });

  $: filteredPurchases = purchases.filter((p) => {
    const q = purchaseSearch.toLowerCase();
    return !q ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.user_id || '').toLowerCase().includes(q) ||
      (p.template_name || '').toLowerCase().includes(q);
  });

  $: filteredMiningJobs = miningJobs.filter((j) => {
    const q = miningSearch.toLowerCase();
    return !q ||
      (j.id || '').toLowerCase().includes(q) ||
      (j.type || '').toLowerCase().includes(q) ||
      (j.status || '').toLowerCase().includes(q);
  });

  // ============================================================
  // COMMAND PALETTE
  // ============================================================
  const paletteActions = [
    { id: 'sanitize-unreviewed', label: 'Sanitize unreviewed templates', icon: SparklesIcon, run: sanitizeUnreviewed },
    { id: 'approve-template', label: 'Approve template <id>', icon: ShieldCheckIcon, run: () => promptAction('Template ID to approve', approveTemplate) },
    { id: 'open-session', label: 'Open session <id>', icon: ExternalLinkIcon, run: () => promptAction('Session ID to open', openSessionInEditor) },
    { id: 'credit-user', label: 'Credit user <id>', icon: CreditCardIcon, run: () => promptCredit() },
    { id: 'regenerate-session', label: 'Regenerate session <id>', icon: RefreshCwIcon, run: () => promptAction('Session ID to regenerate', regenerateSession) },
    { id: 'push-finance', label: 'Push finance <purchase id>', icon: CreditCardIcon, run: () => promptAction('Purchase ID to push finance', pushPurchaseFinance) },
    { id: 'go-mining', label: 'Go to mining jobs', icon: CpuIcon, run: () => switchModule('mining') },
    { id: 'go-templates', label: 'Go to templates', icon: LayersIcon, run: () => switchModule('templates') },
    { id: 'go-purchases', label: 'Go to purchases', icon: CreditCardIcon, run: () => switchModule('purchases') },
    { id: 'go-settings', label: 'Go to settings', icon: SettingsIcon, run: () => switchModule('settings') },
    { id: 'refresh-module', label: 'Refresh current module', icon: RefreshCwIcon, run: () => loadActiveModule() },
  ];

  $: filteredActions = paletteQuery.trim()
    ? paletteActions.filter((a) => a.label.toLowerCase().includes(paletteQuery.toLowerCase()))
    : paletteActions;

  function switchModule(id) {
    activeModule = id;
    paletteOpen = false;
    paletteQuery = '';
  }

  async function sanitizeUnreviewed() {
    if (templates.length === 0) {
      await loadTemplates();
    }
    const targets = templates.filter((t) => (t.status || '').toLowerCase() === 'unreviewed');
    if (targets.length === 0) {
      showNotification('No unreviewed templates', 'info');
      return;
    }
    try {
      await bulkSanitizeAdminTemplates(targets.map((t) => t.id));
      addLog(`Sanitization queued for ${targets.length} unreviewed templates`, 'success');
      showNotification(`${targets.length} template(s) na fila de sanitização`, 'success');
      await loadTemplates();
    } catch (error) {
      handleApiError(error, 'Failed to sanitize unreviewed templates');
    }
  }

  function promptAction(promptText, action) {
    const value = prompt(promptText);
    if (value && value.trim()) {
      action(value.trim());
    }
    paletteOpen = false;
    paletteQuery = '';
  }

  function promptCredit() {
    const userId = prompt('User ID');
    if (!userId) return;
    const amount = prompt('Amount (positive number)');
    if (!amount) return;
    creditUserId = userId.trim();
    creditAmount = amount.trim();
    creditMode = 'credit';
    handleCreditSubmit();
    paletteOpen = false;
    paletteQuery = '';
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

  // ============================================================
  // LIFECYCLE
  // ============================================================
  onMount(() => {
    checkMobile();
    const onResize = () => checkMobile();
    window.addEventListener('resize', onResize);
    if (localStorage.getItem(ADMIN_TOKEN_KEY)) {
      checkAuth();
    } else {
      checkingAuth = false;
      isAuthenticated = false;
    }
    return () => window.removeEventListener('resize', onResize);
  });

  $: if (activeModule && isAuthenticated) {
    loadActiveModule();
  }
</script>

<svelte:window on:keydown={handleGlobalKey} />

<!-- ============================================================ -->
<!-- LOGIN GATE -->
<!-- ============================================================ -->
{#if !isAuthenticated}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6" in:fade={{ duration: 200 }}>
    <div class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div class="mb-6 flex items-center justify-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-luna-primary/10 text-luna-primary">
          {@html CommandIcon({ size: 24 })}
        </div>
      </div>
      <h1 class="mb-2 text-center text-xl font-semibold text-slate-100">Nexo Command Center</h1>
      <p class="mb-6 text-center text-sm text-slate-400">Admin authentication required</p>

      <form on:submit|preventDefault={login} class="space-y-4">
        <div>
          <label class="mb-1.5 block text-xs font-medium text-slate-400">Admin token</label>
          <input
            type="password"
            bind:value={passwordInput}
            placeholder="Enter your admin token"
            class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-luna-primary focus:ring-1 focus:ring-luna-primary/30"
          />
        </div>
        {#if authError}
          <div class="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400" transition:slide={{ duration: 150 }}>
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

<!-- ============================================================ -->
<!-- MAIN SHELL -->
<!-- ============================================================ -->
{#if isAuthenticated}
  <div class="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-200" in:fade={{ duration: 200 }}>
    <!-- Left rail (desktop) -->
    <aside class="hidden h-full w-16 flex-shrink-0 flex-col items-center border-r border-slate-800 bg-slate-900 py-4 md:flex">
      <div class="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-luna-primary to-luna-purple text-white shadow-lg shadow-luna-primary/20">
        {@html CommandIcon({ size: 20 })}
      </div>
      <nav class="flex flex-1 flex-col gap-2">
        {#each modules as m}
          <button
            class="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all"
            class:bg-slate-800={activeModule === m.id}
            class:text-slate-100={activeModule === m.id}
            class:text-slate-400={activeModule !== m.id}
            class:hover:bg-slate-800={activeModule !== m.id}
            class:hover:text-slate-200={activeModule !== m.id}
            on:click={() => switchModule(m.id)}
            title={m.label}
          >
            {@html m.icon({ size: 18 })}
            <span class="absolute left-full ml-2 hidden rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 group-hover:block whitespace-nowrap z-50">
              {m.label}
            </span>
          </button>
        {/each}
      </nav>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
        title="Logout"
        on:click={logout}
      >
        {@html LogOutIcon({ size: 18 })}
      </button>
    </aside>

    <!-- Mobile bottom nav -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-slate-800 bg-slate-900/95 backdrop-blur md:hidden">
      {#each modules as m}
        <button
          class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors"
          class:text-luna-primary={activeModule === m.id}
          class:text-slate-400={activeModule !== m.id}
          on:click={() => switchModule(m.id)}
          aria-label={m.label}
        >
          {@html m.icon({ size: 18 })}
          <span class="text-[10px]">{m.label}</span>
        </button>
      {/each}
      <button
        class="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-slate-400 transition-colors hover:text-red-400"
        on:click={logout}
        aria-label="Logout"
      >
        {@html LogOutIcon({ size: 18 })}
        <span class="text-[10px]">Logout</span>
      </button>
    </nav>

    <!-- Content area -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Top bar -->
      <header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur">
        <div class="flex items-center gap-3">
          <button
            on:click={goBackToNexo}
            class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            title="Back to NEXO LP"
          >
            {@html ArrowLeftIcon({ size: 14 })}
            <span class="hidden sm:inline">Back to NEXO LP</span>
            <span class="sm:hidden">Back</span>
          </button>
          <h1 class="text-sm font-semibold text-slate-100">Nexo Command Center</h1>
          <span class="rounded-full border border-luna-primary/30 bg-luna-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-luna-primary">
            Admin
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            on:click={() => { paletteOpen = true; paletteQuery = ''; paletteIndex = 0; }}
            class="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 md:flex"
          >
            {@html SearchIcon({ size: 14 })}
            <span>Search or run command</span>
            <kbd class="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <button
            on:click={() => { paletteOpen = true; paletteQuery = ''; paletteIndex = 0; }}
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 md:hidden"
            title="Command palette"
          >
            {@html SearchIcon({ size: 16 })}
          </button>
          <button
            on:click={() => loadActiveModule()}
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            title="Refresh"
          >
            {@html RefreshCwIcon({ size: 16 })}
          </button>
        </div>
      </header>

      <!-- Main module -->
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pb-24 md:p-6">
        {#if isLoading && !stats && templates.length === 0 && sessions.length === 0 && purchases.length === 0 && miningJobs.length === 0}
          <div class="flex h-full items-center justify-center text-slate-500">
            <div class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-luna-primary"></div>
            Loading...
          </div>
        {:else}
          <!-- ===== OVERVIEW ===== -->
          {#if activeModule === 'overview'}
            <div class="space-y-6" in:fade={{ duration: 200 }}>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Overview</h2>
                <span class="text-xs text-slate-500">Live admin telemetry</span>
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-transform hover:-translate-y-0.5">
                  <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-luna-primary">
                    {@html LayersIcon({ size: 18 })}
                  </div>
                  <div class="text-2xl font-semibold text-slate-100">{Object.values(stats?.templates?.byStatus || {}).reduce((a,b)=>a+b,0) || templates.length}</div>
                  <div class="text-xs text-slate-400">Templates by status</div>
                  <div class="mt-1 text-[10px] text-slate-600">{Object.entries(stats?.templates?.byStatus || {}).map(([k,v]) => `${k}:${v}`).join(' ')}</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-transform hover:-translate-y-0.5">
                  <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-luna-primary">
                    {@html CreditCardIcon({ size: 18 })}
                  </div>
                  <div class="text-2xl font-semibold text-slate-100">{stats?.purchases?.total ?? purchases.length}</div>
                  <div class="text-xs text-slate-400">Total purchases</div>
                  <div class="mt-1 text-[10px] text-slate-600">completed transactions</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-transform hover:-translate-y-0.5">
                  <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-luna-primary">
                    {@html MessageSquareIcon({ size: 18 })}
                  </div>
                  <div class="text-2xl font-semibold text-slate-100">{stats?.sessions?.active ?? sessions.filter(s => (s.status || '').toLowerCase() === 'preview').length}</div>
                  <div class="text-xs text-slate-400">Active sessions</div>
                  <div class="mt-1 text-[10px] text-slate-600">in memory</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-transform hover:-translate-y-0.5">
                  <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-luna-primary">
                    {@html CpuIcon({ size: 18 })}
                  </div>
                  <div class="text-2xl font-semibold text-slate-100">{stats?.jobs?.total ?? miningJobs.length}</div>
                  <div class="text-xs text-slate-400">Mining jobs</div>
                  <div class="mt-1 text-[10px] text-slate-600">workers</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-transform hover:-translate-y-0.5">
                  <div class="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-luna-primary">
                    {@html CreditCardIcon({ size: 18 })}
                  </div>
                  <div class="text-2xl font-semibold text-slate-100">{formatCurrency(stats?.currency?.total)}</div>
                  <div class="text-xs text-slate-400">Currency in circulation</div>
                  <div class="mt-1 text-[10px] text-slate-600">across users</div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-2">
                  <h3 class="mb-3 text-sm font-medium text-slate-300">Recent activity</h3>
                  <div class="space-y-2">
                    {#if logs.length === 0}
                      <p class="text-xs text-slate-500">No activity recorded yet.</p>
                    {:else}
                      {#each [...logs].reverse().slice(0, 10) as log (log.id)}
                        <div class="flex items-center gap-3 rounded-lg bg-slate-950/50 px-3 py-2 text-xs">
                          <span class="text-slate-500">{log.time}</span>
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            class:bg-emerald-400={log.type === 'success'}
                            class:bg-amber-400={log.type === 'warning'}
                            class:bg-red-400={log.type === 'error'}
                            class:bg-luna-primary={log.type === 'info'}
                          ></span>
                          <span class="text-slate-300">{log.message}</span>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <h3 class="mb-3 text-sm font-medium text-slate-300">Quick actions</h3>
                  <div class="grid grid-cols-1 gap-2">
                    <button on:click={() => sanitizeUnreviewed()} class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-luna-primary/40 hover:text-slate-100">
                      {@html SparklesIcon({ size: 14 })} Sanitize unreviewed
                    </button>
                    <button on:click={() => switchModule('templates')} class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-luna-primary/40 hover:text-slate-100">
                      {@html LayersIcon({ size: 14 })} Manage templates
                    </button>
                    <button on:click={() => switchModule('mining')} class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-luna-primary/40 hover:text-slate-100">
                      {@html CpuIcon({ size: 14 })} Mining jobs
                    </button>
                    <button on:click={() => switchModule('settings')} class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-luna-primary/40 hover:text-slate-100">
                      {@html SettingsIcon({ size: 14 })} Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- ===== TEMPLATES ===== -->
          {#if activeModule === 'templates'}
            <div class="flex min-h-0 flex-1 flex-col gap-4" in:fade={{ duration: 200 }}>
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Templates</h2>
                <div class="flex flex-wrap items-center gap-2">
                  <select
                    bind:value={templateFilter.status}
                    on:change={loadTemplates}
                    class="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-luna-primary"
                  >
                    <option value="all">All statuses</option>
                    <option value="unreviewed">Unreviewed</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    bind:value={templateFilter.category}
                    on:change={loadTemplates}
                    class="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-luna-primary"
                  >
                    <option value="all">All categories</option>
                    {#each templateCategories as cat}
                      <option value={cat}>{cat}</option>
                    {/each}
                  </select>
                  <input
                    type="text"
                    bind:value={templateFilter.search}
                    on:input={loadTemplates}
                    placeholder="Search templates..."
                    class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"
                  />
                </div>
              </div>

              {#if selectedTemplateIds.size > 0}
                <div class="flex items-center gap-2 rounded-lg border border-luna-primary/20 bg-luna-primary/10 px-3 py-2 text-xs">
                  <span class="text-slate-300">{selectedTemplateIds.size} selected</span>
                  <div class="ml-auto flex gap-2">
                    <button on:click={() => runBulk('sanitize')} class="rounded px-2 py-1 text-slate-300 hover:bg-luna-primary/20 hover:text-slate-100">Sanitize</button>
                    <button on:click={() => runBulk('approve')} class="rounded px-2 py-1 text-slate-300 hover:bg-luna-primary/20 hover:text-slate-100">Approve</button>
                    <button on:click={() => runBulk('price')} class="rounded px-2 py-1 text-slate-300 hover:bg-luna-primary/20 hover:text-slate-100">Set price</button>
                    <button on:click={() => runBulk('delete')} class="rounded px-2 py-1 text-red-400 hover:bg-red-500/10">Delete</button>
                  </div>
                </div>
              {/if}

              <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900">
                <table class="w-full min-w-[640px] text-left text-xs">
                  <thead class="sticky top-0 z-10 bg-slate-900 text-slate-400">
                    <tr class="border-b border-slate-800">
                      <th class="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={filteredTemplates.length > 0 && filteredTemplates.every((t) => selectedTemplateIds.has(t.id))}
                          on:change={toggleAllTemplates}
                          class="rounded border-slate-700 bg-slate-950 text-luna-primary"
                        />
                      </th>
                      <th class="px-3 py-2 font-medium">ID</th>
                      <th class="px-3 py-2 font-medium">Name</th>
                      <th class="px-3 py-2 font-medium">Status</th>
                      <th class="px-3 py-2 font-medium">Category</th>
                      <th class="px-3 py-2 font-medium">Price</th>
                      <th class="px-3 py-2 font-medium">Updated</th>
                      <th class="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each filteredTemplates as tpl (tpl.id)}
                      <tr class="transition-colors hover:bg-slate-800/50">
                        <td class="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedTemplateIds.has(tpl.id)}
                            on:change={() => toggleTemplateSelection(tpl.id)}
                            class="rounded border-slate-700 bg-slate-950 text-luna-primary"
                          />
                        </td>
                        <td class="px-3 py-2 font-mono text-slate-500">{tpl.id}</td>
                        <td class="px-3 py-2 text-slate-200">{tpl.name || 'Untitled'}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium {statusBadgeClasses(tpl.status)}">
                            {tpl.status || 'unknown'}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-slate-400">{tpl.category || '—'}</td>
                        <td class="px-3 py-2 text-slate-400">{formatCurrency(tpl.price)}</td>
                        <td class="px-3 py-2 text-slate-500">{formatDate(tpl.updated_at || tpl.updatedAt)}</td>
                        <td class="px-3 py-2 text-right">
                          <div class="flex items-center justify-end gap-1">
                            <button on:click={() => openTemplatePanel(tpl)} title="Edit" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">{@html CommandIcon({ size: 14 })}</button>
                            <button on:click={() => sanitizeTemplate(tpl.id)} title="Sanitize" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html SparklesIcon({ size: 14 })}</button>
                            <button on:click={() => approveTemplate(tpl.id)} title="Approve" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html ShieldCheckIcon({ size: 14 })}</button>
                            <button on:click={() => removeTemplate(tpl.id)} title="Delete" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400">{@html TrashIcon({ size: 14 })}</button>
                          </div>
                        </td>
                      </tr>
                    {:else}
                      <tr>
                        <td colspan="8" class="px-3 py-8 text-center text-slate-500">No templates found</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          <!-- ===== SESSIONS ===== -->
          {#if activeModule === 'sessions'}
            <div class="flex min-h-0 flex-1 flex-col gap-4" in:fade={{ duration: 200 }}>
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Sessions</h2>
                <input
                  type="text"
                  bind:value={sessionSearch}
                  on:input={loadSessions}
                  placeholder="Search sessions..."
                  class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"
                />
              </div>
              <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900">
                <table class="w-full min-w-[640px] text-left text-xs">
                  <thead class="sticky top-0 z-10 bg-slate-900 text-slate-400">
                    <tr class="border-b border-slate-800">
                      <th class="px-3 py-2 font-medium">ID</th>
                      <th class="px-3 py-2 font-medium">Project</th>
                      <th class="px-3 py-2 font-medium">Status</th>
                      <th class="px-3 py-2 font-medium">Updated</th>
                      <th class="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each filteredSessions as s (s.id)}
                      <tr class="transition-colors hover:bg-slate-800/50">
                        <td class="px-3 py-2 font-mono text-slate-500">{s.id}</td>
                        <td class="px-3 py-2 text-slate-200">{s.name || s.project || s.initial_prompt || 'Untitled'}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium {statusBadgeClasses(s.status)}">
                            {s.status || 'unknown'}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-slate-500">{formatDate(s.updated_at || s.updatedAt)}</td>
                        <td class="px-3 py-2 text-right">
                          <div class="flex items-center justify-end gap-1">
                            <button on:click={() => openSessionInEditor(s.id)} title="Open in editor" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">{@html ExternalLinkIcon({ size: 14 })}</button>
                            <button on:click={() => regenerateSession(s.id)} title="Regenerate" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html RefreshCwIcon({ size: 14 })}</button>
                            <button on:click={() => removeSession(s.id)} title="Delete" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400">{@html TrashIcon({ size: 14 })}</button>
                          </div>
                        </td>
                      </tr>
                    {:else}
                      <tr>
                        <td colspan="5" class="px-3 py-8 text-center text-slate-500">No sessions found</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          <!-- ===== PURCHASES ===== -->
          {#if activeModule === 'purchases'}
            <div class="flex min-h-0 flex-1 flex-col gap-4" in:fade={{ duration: 200 }}>
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Purchases</h2>
                <div class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 md:w-80">
                  <h3 class="text-xs font-medium text-slate-300">Manual credit / deduct</h3>
                  <input
                    type="text"
                    bind:value={creditUserId}
                    placeholder="User ID"
                    class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"
                  />
                  <div class="flex gap-2">
                    <select bind:value={creditCurrency} class="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-luna-primary">
                      <option value="stars">Stars</option>
                      <option value="suns">Suns</option>
                      <option value="moons">Moons</option>
                    </select>
                    <input
                      type="number"
                      bind:value={creditAmount}
                      placeholder="Amount"
                      class="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      on:click={() => { creditMode = 'credit'; handleCreditSubmit(); }}
                      class="flex-1 rounded-lg bg-luna-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-luna-primary-hover"
                    >Credit</button>
                    <button
                      on:click={() => { creditMode = 'deduct'; handleCreditSubmit(); }}
                      class="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-red-500/30 hover:text-red-400"
                    >Deduct</button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:col-span-1">
                  <h3 class="mb-3 text-xs font-medium text-slate-300">Summary by template</h3>
                  <div class="space-y-2">
                    {#each purchasesSummary as row (row.template_id || row.name)}
                      <div class="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2 text-xs">
                        <span class="truncate text-slate-400">{row.name || row.template_name || row.template_id || '—'}</span>
                        <span class="font-mono text-slate-200">{formatCurrency(row.total || row.count || 0)}</span>
                      </div>
                    {:else}
                      <p class="text-xs text-slate-500">No summary data</p>
                    {/each}
                  </div>
                </div>
                <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900 lg:col-span-3">
                  <table class="w-full min-w-[640px] text-left text-xs">
                    <thead class="sticky top-0 z-10 bg-slate-900 text-slate-400">
                      <tr class="border-b border-slate-800">
                        <th class="px-3 py-2 font-medium">ID</th>
                        <th class="px-3 py-2 font-medium">User</th>
                        <th class="px-3 py-2 font-medium">Template</th>
                        <th class="px-3 py-2 font-medium">Amount</th>
                        <th class="px-3 py-2 font-medium">Status</th>
                        <th class="px-3 py-2 font-medium">Date</th>
                        <th class="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800">
                      {#each filteredPurchases as p (p.id)}
                        <tr class="transition-colors hover:bg-slate-800/50">
                          <td class="px-3 py-2 font-mono text-slate-500">{p.id}</td>
                          <td class="px-3 py-2 text-slate-400">{p.user_id || p.userId || '—'}</td>
                          <td class="px-3 py-2 text-slate-200">{p.template_name || p.templateName || '—'}</td>
                          <td class="px-3 py-2 text-slate-400">{formatCurrency(p.amount || p.price || 0)}</td>
                          <td class="px-3 py-2">
                            <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium {statusBadgeClasses(p.status)}">
                              {p.status || 'unknown'}
                            </span>
                          </td>
                          <td class="px-3 py-2 text-slate-500">{formatDate(p.created_at || p.createdAt)}</td>
                          <td class="px-3 py-2 text-right">
                            <button on:click={() => pushPurchaseFinance(p.id)} title="Push finance" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html CreditCardIcon({ size: 14 })}</button>
                          </td>
                        </tr>
                      {:else}
                        <tr>
                          <td colspan="7" class="px-3 py-8 text-center text-slate-500">No purchases found</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          {/if}

          <!-- ===== MINING ===== -->
          {#if activeModule === 'mining'}
            <div class="flex min-h-0 flex-1 flex-col gap-4" in:fade={{ duration: 200 }}>
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Mining jobs</h2>
                <input
                  type="text"
                  bind:value={miningSearch}
                  on:input={loadMining}
                  placeholder="Search jobs..."
                  class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"
                />
              </div>
              <div class="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900">
                <table class="w-full min-w-[640px] text-left text-xs">
                  <thead class="sticky top-0 z-10 bg-slate-900 text-slate-400">
                    <tr class="border-b border-slate-800">
                      <th class="px-3 py-2 font-medium">ID</th>
                      <th class="px-3 py-2 font-medium">Type</th>
                      <th class="px-3 py-2 font-medium">Status</th>
                      <th class="px-3 py-2 font-medium">Progress</th>
                      <th class="px-3 py-2 font-medium">Updated</th>
                      <th class="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800">
                    {#each filteredMiningJobs as j (j.id)}
                      {@const progress = Math.max(0, Math.min(100, Number(j.progress) || 0))}
                      <tr class="transition-colors hover:bg-slate-800/50">
                        <td class="px-3 py-2 font-mono text-slate-500">{j.id}</td>
                        <td class="px-3 py-2 text-slate-200">{j.type || '—'}</td>
                        <td class="px-3 py-2">
                          <span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium {statusBadgeClasses(j.status)}">
                            {j.status || 'unknown'}
                          </span>
                        </td>
                        <td class="px-3 py-2">
                          <div class="flex items-center gap-2">
                            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                              <div class="h-full rounded-full bg-luna-primary transition-all" style="width: {progress}%"></div>
                            </div>
                            <span class="text-[10px] text-slate-500">{progress}%</span>
                          </div>
                        </td>
                        <td class="px-3 py-2 text-slate-500">{formatDate(j.updated_at || j.updatedAt)}</td>
                        <td class="px-3 py-2 text-right">
                          <div class="flex items-center justify-end gap-1">
                            <button on:click={() => controlMiningJob(j.id, 'retry')} title="Retry" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html RefreshCwIcon({ size: 14 })}</button>
                            <button on:click={() => controlMiningJob(j.id, 'pause')} title="Pause" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-400">{@html CommandIcon({ size: 14 })}</button>
                            <button on:click={() => controlMiningJob(j.id, 'resume')} title="Resume" class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400">{@html CheckIcon({ size: 14 })}</button>
                          </div>
                        </td>
                      </tr>
                    {:else}
                      <tr>
                        <td colspan="6" class="px-3 py-8 text-center text-slate-500">No mining jobs found</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          <!-- ===== SETTINGS ===== -->
          {#if activeModule === 'settings'}
            <div class="mx-auto w-full max-w-3xl" in:fade={{ duration: 200 }}>
              <h2 class="mb-4 text-lg font-semibold text-slate-100">Settings</h2>
              <div class="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-slate-400">Generation mode</label>
                    <select bind:value={settingsForm.mode} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none focus:border-luna-primary">
                      <option value="landing">Landing</option>
                      <option value="multi-page">Multi-page</option>
                    </select>
                  </div>
                  <div>
                    <label class="mb-1.5 block text-xs font-medium text-slate-400">Default template price</label>
                    <input type="number" bind:value={settingsForm.default_template} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none focus:border-luna-primary" />
                  </div>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-slate-400">Frameworks (comma separated)</label>
                  <input type="text" bind:value={settingsForm.frameworks} placeholder="e.g. tailwind, alpinejs" class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary" />
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-medium text-slate-400">Base prompt</label>
                  <textarea bind:value={settingsForm.base_prompt} rows="5" class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-luna-primary"></textarea>
                </div>
                <div class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
                  <div>
                    <div class="text-sm font-medium text-slate-200">Auto-publish</div>
                    <div class="text-xs text-slate-500">Automatically publish generated pages</div>
                  </div>
                  <button
                    on:click={() => settingsForm.auto_publish = !settingsForm.auto_publish}
                    class="relative h-6 w-11 rounded-full transition-colors"
                    class:bg-luna-primary={settingsForm.auto_publish}
                    class:bg-slate-700={!settingsForm.auto_publish}
                  >
                    <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform" class:translate-x-5={settingsForm.auto_publish}></span>
                  </button>
                </div>
                <div class="flex justify-end pt-2">
                  <button on:click={saveSettings} class="rounded-lg bg-luna-primary px-4 py-2 text-sm font-medium text-white hover:bg-luna-primary-hover">Save settings</button>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </main>

      <!-- Terminal -->
      <div
        class="flex-shrink-0 border-t border-slate-800 bg-slate-900 transition-all"
        class:h-48={terminalOpen}
        class:h-8={!terminalOpen}
        class:mb-14={isMobile && terminalOpen}
      >
        <button
          on:click={() => terminalOpen = !terminalOpen}
          class="flex h-8 w-full items-center justify-between px-4 text-xs text-slate-500 hover:text-slate-300"
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
                <span class="text-slate-600">[{log.time}]</span>
                <span
                  class="font-semibold"
                  class:text-emerald-400={log.type === 'success'}
                  class:text-amber-400={log.type === 'warning'}
                  class:text-red-400={log.type === 'error'}
                  class:text-luna-primary={log.type === 'info'}
                >{log.type.toUpperCase()}</span>
                <span class="text-slate-400">{log.message}</span>
              </div>
            {:else}
              <div class="text-slate-600">Waiting for activity...</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ============================================================ -->
<!-- COMMAND PALETTE MODAL -->
<!-- ============================================================ -->
{#if paletteOpen}
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
    on:click={() => { paletteOpen = false; paletteQuery = ''; }}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      on:click|stopPropagation
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <div class="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        {@html SearchIcon({ size: 18 })}
        <input
          type="text"
          bind:value={paletteQuery}
          on:keydown={handlePaletteKey}
          placeholder="Type a command..."
          class="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          autofocus
        />
        <kbd class="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
      </div>
      <div class="max-h-[50vh] overflow-y-auto py-2">
        {#each filteredActions as action, i (action.id)}
          <button
            on:click={() => executeAction(action)}
            on:mouseenter={() => paletteIndex = i}
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors {paletteIndex === i ? 'bg-luna-primary/10 text-slate-100' : 'text-slate-400'}"
          >
            <span class="text-slate-500">{@html action.icon({ size: 16 })}</span>
            <span>{action.label}</span>
          </button>
        {:else}
          <div class="px-4 py-6 text-center text-xs text-slate-500">No commands match “{paletteQuery}”</div>
        {/each}
      </div>
      <div class="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-4 py-2 text-[10px] text-slate-500">
        <span>↑↓ to navigate</span>
        <span>↵ to run</span>
      </div>
    </div>
  </div>
{/if}

<!-- ============================================================ -->
<!-- TEMPLATE SIDE PANEL -->
<!-- ============================================================ -->
{#if templatePanelOpen && selectedTemplate}
  <div class="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-sm" on:click={closeTemplatePanel} transition:fade={{ duration: 150 }}>
    <div
      class="flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl"
      on:click|stopPropagation
      transition:fly={{ x: 400, duration: 250, easing: quintOut }}
    >
      <div class="flex h-14 items-center justify-between border-b border-slate-800 px-5">
        <h3 class="text-sm font-semibold text-slate-100">Template preview & metadata</h3>
        <button on:click={closeTemplatePanel} class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">{@html XIcon({ size: 18 })}</button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <div class="mb-4 aspect-video overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <iframe
            title="Template preview"
            sandbox="allow-scripts"
            class="h-full w-full"
            srcdoc={selectedTemplate.html || selectedTemplate.preview_html || selectedTemplate.preview || '<p class="text-slate-500 p-4">No preview available</p>'}
          ></iframe>
        </div>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-slate-500">Name</label>
            <input type="text" bind:value={selectedTemplate.name} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-luna-primary" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-slate-500">Category</label>
              <input type="text" bind:value={selectedTemplate.category} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-luna-primary" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-500">Subcategory</label>
              <input type="text" bind:value={selectedTemplate.subcategory} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-luna-primary" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs text-slate-500">Price</label>
              <input type="number" bind:value={selectedTemplate.price} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-luna-primary" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-500">Status</label>
              <select bind:value={selectedTemplate.status} class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-luna-primary">
                <option value="unreviewed">Unreviewed</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <button on:click={saveTemplateMeta} class="rounded-lg bg-luna-primary px-4 py-2 text-sm font-medium text-white hover:bg-luna-primary-hover">Save changes</button>
            <button on:click={() => sanitizeTemplate(selectedTemplate.id)} class="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:text-emerald-400">Sanitize</button>
            <button on:click={() => approveTemplate(selectedTemplate.id)} class="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-300 hover:text-emerald-400">Approve</button>
            <button on:click={() => removeTemplate(selectedTemplate.id)} class="ml-auto rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}


