import { writable, derived } from 'svelte/store';
import { adminLiveEvents as adminLiveEventsStore } from './components/admin/AdminSSEStore.js';

// Admin live events (SSE) state: { connected, events, jobs }
export const adminLiveEvents = adminLiveEventsStore;

// End-user page generation mode (Landing, Multi-page, etc.)
export const generationPageMode = writable('Landing');

// Session management
export const session = writable({
  id: null,
  createdAt: null,
  projectName: 'Untitled Project',
});

// Chat messages
export const messages = writable([
  {
    id: 'welcome',
    role: 'assistant',
    content: "Hi! I'm Luna, your landing page creator. Tell me what you'd like to build, and I'll make the magic happen.",
    timestamp: Date.now(),
    type: 'text',
  },
]);

// Preview state
export const preview = writable({
  html: '',
  blobUrl: null,
  lastUpdated: null,
  device: 'desktop',
});

// Virtual currency balance (Estrelas, Sóis, Lunas)
export const currencies = writable({
  stars: 50,
  suns: 5,
  moons: 1,
});

// Legacy token store kept for compatibility
export const tokens = writable({
  balance: 5000,
  used: 0,
  total: 5000,
});

// Selected generation mode: stars | suns | moons
export const generationMode = writable('stars');

// Templates
export const templates = writable([]);

// Currently selected template indicator
export const currentTemplate = writable(null);

// Kimi context / chat link state
export const kimiChatUrl = writable(null);
export const contextWarning = writable('none');
export const contextInfo = writable({ size: 0, limit: 0 });
export const contextUsagePercent = derived(contextInfo, ($contextInfo) =>
  $contextInfo.limit > 0 ? Math.round(($contextInfo.size / $contextInfo.limit) * 100) : 0
);

// Current view (chat, templates, settings, editor)
export const currentView = writable('chat');

// Editor active tab (chat, preview, code, deploy, history, bugs)
export const editorTab = writable('chat');

// Generation state
export const isGenerating = writable(false);
export const generationOverlayMinimized = writable(false);

// Current tool/action being executed
export const currentTool = writable(null);

// Real-time generation events (tool cards / progress)
export const generationEvents = writable([]);

// Notification
export const notification = writable({ message: '', type: '', visible: false });

// Deploy state
export const deployState = writable({
  status: 'idle', // idle, deploying, success, error
  url: null,
  platform: null,
});

// Bug detection results
export const bugReport = writable({
  score: 0,
  issues: [],
  checked: false,
});

// Version history
export const versionHistory = writable([]);

// Derived: message count
export const messageCount = derived(messages, ($messages) => $messages.length);

// Derived: has preview
export const hasPreview = derived(preview, ($preview) => !!$preview.html && $preview.html.length > 0);

// Show notification helper
export function showNotification(message, type = 'info') {
  notification.set({ message, type, visible: true });
  setTimeout(() => {
    notification.set({ message: '', type: '', visible: false });
  }, 3000);
}
