export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleString();
}

export function formatCurrency(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function statusBadgeClasses(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'active' || s === 'running' || s === 'completed' || s === 'paid') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s === 'pending' || s === 'unreviewed' || s === 'queued' || s === 'paused') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (s === 'rejected' || s === 'failed' || s === 'deleted' || s === 'error' || s === 'blocked') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export function statusBadge(status) {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadgeClasses(status)}">${status || 'unknown'}</span>`;
}
