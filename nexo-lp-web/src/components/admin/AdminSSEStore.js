import { writable } from 'svelte/store';
import { API_BASE } from '../../api.js';

const ADMIN_TOKEN_KEY = 'nexo_admin_token';

function buildSSEUrl() {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
  const base = API_BASE || '/api/nexo-lp';
  const url = `${base}/admin/events`;
  return token ? `${url}?adminToken=${encodeURIComponent(token)}` : url;
}

function createAdminSSEStore() {
  const { subscribe, set, update } = writable({ connected: false, events: [], jobs: {} });
  let es = null;
  let reconnectTimer = null;

  function connect() {
    if (es) return;
    if (typeof EventSource === 'undefined') return;

    try {
      es = new EventSource(buildSSEUrl());
      es.onopen = () => update((s) => ({ ...s, connected: true }));
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          update((s) => {
            const events = [event, ...s.events].slice(0, 100);
            const jobs = { ...s.jobs };
            if (event.scope === 'generation' || event.scope === 'sanitization') {
              const key = event.sessionId || event.templateId;
              if (key) {
                jobs[key] = { ...jobs[key], ...event, lastUpdate: Date.now() };
              }
            }
            if (
              event.type === 'generation_complete' ||
              event.type === 'sanitization_complete' ||
              event.type === 'generation_error' ||
              event.type === 'sanitization_error'
            ) {
              const key = event.sessionId || event.templateId;
              if (key) {
                setTimeout(() => {
                  update((state) => {
                    const next = { ...state.jobs };
                    delete next[key];
                    return { ...state, jobs: next };
                  });
                }, 5000);
              }
            }
            return { ...s, events, jobs };
          });
        } catch (err) {
          console.error('[AdminSSE] invalid event', err);
        }
      };
      es.onerror = () => {
        update((s) => ({ ...s, connected: false }));
        es.close();
        es = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    } catch (err) {
      console.error('[AdminSSE] failed to connect', err);
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (es) {
      es.close();
      es = null;
    }
  }

  return { subscribe, set, update, connect, disconnect };
}

export const adminLiveEvents = createAdminSSEStore();
