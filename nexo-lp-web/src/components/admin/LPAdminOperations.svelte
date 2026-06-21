<script>
  import { onMount, onDestroy } from 'svelte';
  import { adminLiveEvents } from '../../stores.js';
  import { listAdminTemplates, listAdminSessions } from '../../api.js';
  import AdminEventFeed from './AdminEventFeed.svelte';

  let now = Date.now();
  let tickTimer = null;
  let pollTimer = null;

  function progress(job) {
    if (job.scope === 'generation') {
      const phases = ['intention', 'structure', 'code', 'review', 'preview', 'deploy'];
      const idx = phases.indexOf(job.phase);
      return idx >= 0 ? Math.round(((idx + 1) / phases.length) * 100) : 0;
    }
    if (job.scope === 'sanitization') {
      const step = job.step || 0;
      if (step >= 4) return 100;
      if (step === 3) return 75;
      if (step === 2) return 50;
      if (step === 1) return 25;
      return 10;
    }
    return 0;
  }

  function duration(job) {
    const ms = now - (job.lastUpdate || Date.now());
    if (ms < 1000) return 'now';
    return `${Math.round(ms / 1000)}s`;
  }

  async function syncActiveJobs() {
    try {
      const [sanitizing, sessions] = await Promise.all([
        listAdminTemplates({ status: 'sanitizing', limit: 100 }),
        listAdminSessions({ status: 'preview', limit: 100 }),
      ]);

      adminLiveEvents.update((s) => {
        const activeKeys = new Set();
        const nextJobs = {};

        // Preserve existing SSE-driven jobs and merge with backend state.
        for (const t of sanitizing.templates || []) {
          const key = t.session_id || t.id;
          if (!key) continue;
          activeKeys.add(key);
          nextJobs[key] = {
            ...(s.jobs[key] || {}),
            scope: 'sanitization',
            sessionId: t.session_id,
            templateId: t.id,
            step: s.jobs[key]?.step || 0,
            lastUpdate: s.jobs[key]?.lastUpdate || Date.now(),
          };
        }

        const sessionList = Array.isArray(sessions) ? sessions : (sessions.sessions || []);
        for (const sess of sessionList) {
          const key = sess.id;
          if (!key) continue;
          activeKeys.add(key);
          nextJobs[key] = {
            ...(s.jobs[key] || {}),
            scope: 'generation',
            sessionId: sess.id,
            phase: s.jobs[key]?.phase || sess.status || 'preview',
            lastUpdate: s.jobs[key]?.lastUpdate || Date.now(),
          };
        }

        return { ...s, jobs: nextJobs };
      });
    } catch (err) {
      // Silently ignore polling errors so the UI stays resilient.
      console.warn('[Operations] syncActiveJobs failed', err);
    }
  }

  onMount(() => {
    tickTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
    pollTimer = setInterval(() => {
      syncActiveJobs();
    }, 5000);
    syncActiveJobs();
  });

  onDestroy(() => {
    if (tickTimer) clearInterval(tickTimer);
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-lg font-semibold text-slate-900">Live Operations</h2>
    <p class="text-sm text-slate-500">Real-time generation and sanitization jobs</p>
  </div>

  <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
    <span class="h-2.5 w-2.5 rounded-full" class:bg-emerald-500={$adminLiveEvents.connected} class:bg-red-500={!$adminLiveEvents.connected}></span>
    <span class="text-sm text-slate-700">{$adminLiveEvents.connected ? 'Conectado' : 'Desconectado'}</span>
    <span class="ml-auto text-xs text-slate-400">{Object.keys($adminLiveEvents.jobs).length} active job(s)</span>
  </div>

  <div>
    <h3 class="mb-3 text-sm font-medium text-slate-700">Jobs ativos</h3>
    {#if Object.keys($adminLiveEvents.jobs).length === 0}
      <div class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">Nenhum job ativo no momento.</div>
    {:else}
      <div class="space-y-3">
        {#each Object.values($adminLiveEvents.jobs) as job (job.sessionId || job.templateId || job.id)}
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <div class="mb-2 flex justify-between text-sm text-slate-700">
              <span class="capitalize font-medium">{job.scope}</span>
              <span class="text-slate-400 font-mono text-xs">{job.sessionId || job.templateId || job.id} · {duration(job)}</span>
            </div>
            <div class="mb-1 text-xs text-slate-500">{job.phase || (job.step !== undefined ? `etapa ${job.step}` : job.type)}</div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full bg-luna-primary transition-all duration-500" style="width: {progress(job)}%"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <AdminEventFeed events={$adminLiveEvents.events} />
</div>
