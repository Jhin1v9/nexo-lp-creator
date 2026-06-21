export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3460/api/nexo-lp';

const ADMIN_TOKEN_KEY = 'nexo_admin_token';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const { headers: customHeaders, signal, ...restOptions } = options;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    ...restOptions,
  };

  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (adminToken && endpoint.startsWith('/admin')) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, { ...config, signal });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        data?.error?.message || data?.error || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || 'Network error', 0, null);
  }
}

// ===== Session API =====
export async function createSession(projectName = 'Untitled Project') {
  const result = await request('/sessions', {
    method: 'POST',
    body: {
      userId: `user-${Date.now()}`,
      initialPrompt: projectName,
      stack: 'static-html-tailwind',
    },
  });
  return { sessionId: result.data.id, ...result.data };
}

export async function getSession(sessionId) {
  const result = await request(`/sessions/${sessionId}`);
  return result.data;
}

export async function getSessionByKimiChatId(chatId) {
  const result = await request(`/sessions/by-chat/${encodeURIComponent(chatId)}`);
  return result.data;
}

export async function getMessages(sessionId) {
  const result = await request(`/sessions/${sessionId}/messages`);
  return result.data || [];
}

export async function addMessage(sessionId, message) {
  const result = await request(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: message,
  });
  return result.data;
}

export async function listSessions(page = 1, limit = 50) {
  const result = await request(`/sessions?page=${page}&limit=${limit}`);
  return result.data || { sessions: [], total: 0 };
}

export async function searchSessions(query, limit = 50) {
  const result = await request(`/sessions/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return result.data || { sessions: [] };
}

export async function renameSession(sessionId, title) {
  const result = await request(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { title },
  });
  return result.data;
}

export async function deleteSession(sessionId) {
  const result = await request(`/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  return result.data;
}

export function getSessionDownloadUrl(sessionId) {
  return `${API_BASE}/sessions/${sessionId}/download`;
}

// ===== Generation API =====
export async function generate(sessionId, prompt, options = {}) {
  return request('/generate', {
    method: 'POST',
    body: {
      sessionId,
      prompt,
      stack: options.stack || 'static-html-tailwind',
      options: {
        mode: options.mode || 'stars',
        generationMode: options.generationMode || options.generationPageMode,
      },
    },
  });
}

export function sendMessage(sessionId, message, stream = false) {
  // Frontend chat uses the generate endpoint; the backend runs it in background.
  // For streaming, we return an SSE stream URL that callers can consume.
  // IMPORTANT: the caller must start generation separately with generate().
  if (stream) {
    return new EventSource(`${API_BASE}/events/${sessionId}`);
  }
  return generate(sessionId, message);
}

// ===== Preview API =====
export async function getPreview(sessionId) {
  const result = await request(`/preview/${sessionId}`);
  return result.data;
}

export async function savePreview(sessionId, html) {
  const result = await request(`/preview/${sessionId}`, {
    method: 'POST',
    body: { html },
  });
  return result.data;
}

// ===== Bug Detection API =====
export async function detectBugs(sessionId, html) {
  const result = await request('/bug-detect', {
    method: 'POST',
    body: { sessionId, html },
  });
  return result.data;
}

// ===== Deploy API =====
export async function deploy(sessionId, platform, deployConfig = {}) {
  const endpoint = platform === 'zip' ? '/deploy/zip' : '/deploy/github';
  const result = await request(endpoint, {
    method: 'POST',
    body: { sessionId, ...deployConfig },
  });
  return result.data;
}

export async function getDeployStatus(deploymentId) {
  // Not exposed as a top-level route; session deployments are available via session.
  return { deploymentId, status: 'unknown' };
}

// ===== Templates API =====
export async function getTemplates(filters = {}, signal = null) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.subcategory && filters.subcategory !== 'all') params.set('subcategory', filters.subcategory);
  if (filters.stack && filters.stack !== 'all') params.set('stack', filters.stack);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  const result = await request(`/templates${query ? '?' + query : ''}`, { signal });
  return result.data;
}

export async function getSubcategories(category) {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  const query = params.toString();
  const result = await request(`/templates/subcategories${query ? '?' + query : ''}`);
  return result.data;
}

export async function getTemplate(templateId) {
  const result = await request(`/templates/${templateId}`);
  return result.data;
}

export async function useTemplate(sessionId, templateId, userId) {
  const result = await request(`/templates/${templateId}/use`, {
    method: 'POST',
    body: { userId, sessionId },
  });
  return result.data;
}

export async function buyTemplate(templateId, userId) {
  const result = await request(`/templates/${templateId}/buy`, {
    method: 'POST',
    body: { userId },
  });
  return result.data;
}

export async function getTemplatePrompt(templateId, userId) {
  const result = await request(`/templates/${templateId}/prompt?userId=${encodeURIComponent(userId)}`);
  return result.data;
}

// ===== Tokens API (legacy) =====
export async function getTokenBalance(userId = null) {
  const uid = userId || `user-${Date.now()}`;
  const result = await request(`/tokens/balance?userId=${encodeURIComponent(uid)}`);
  return result.data;
}

export async function deductTokens(amount, reason, userId = null) {
  const uid = userId || `user-${Date.now()}`;
  const result = await request('/tokens/deduct', {
    method: 'POST',
    body: { userId: uid, amount, action: reason },
  });
  return result.data;
}

// ===== Currencies API =====
export async function getCurrencyBalance(userId) {
  const result = await request(`/currencies/balance?userId=${encodeURIComponent(userId)}`);
  return result.data;
}

export async function deductCurrency(userId, operation, mode = 'stars') {
  const result = await request('/currencies/deduct', {
    method: 'POST',
    body: { userId, operation, mode },
  });
  return result.data;
}

// ===== Versions API =====
export async function saveVersion(sessionId, html, note = '') {
  const result = await request(`/sessions/${sessionId}/versions`, {
    method: 'POST',
    body: { html, note },
  });
  return result.data;
}

export async function getVersions(sessionId) {
  const result = await request(`/sessions/${sessionId}/versions`);
  return result.data || [];
}

export async function rollbackVersion(sessionId, versionId) {
  const result = await request(`/sessions/${sessionId}/versions/${versionId}/rollback`, {
    method: 'POST',
  });
  return result.data;
}

// ===== GitHub OAuth =====
export async function startGithubAuth() {
  throw new ApiError('GitHub OAuth not implemented', 501);
}

export async function checkGithubAuth(deviceCode) {
  throw new ApiError('GitHub OAuth not implemented', 501);
}

// ===== Admin API =====
function buildAdminQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function adminRequest(endpoint, options = {}) {
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!adminToken) {
    throw new ApiError('Admin token not found. Please log in as admin.', 401);
  }
  return request(endpoint, options);
}

export async function getAdminStats() {
  const result = await adminRequest('/admin/stats');
  return result.data;
}

export async function listAdminTemplates(filters = {}) {
  const result = await adminRequest(`/admin/templates${buildAdminQuery(filters)}`);
  return result.data;
}

export async function updateAdminTemplate(id, data) {
  const result = await adminRequest(`/admin/templates/${id}`, {
    method: 'PATCH',
    body: data,
  });
  return result.data;
}

export async function approveAdminTemplate(id) {
  const result = await adminRequest(`/admin/templates/${id}/approve`, {
    method: 'POST',
  });
  return result.data;
}

export async function deleteAdminTemplate(id) {
  const result = await adminRequest(`/admin/templates/${id}`, {
    method: 'DELETE',
  });
  return result.data;
}

export async function sanitizeAdminTemplate(id) {
  const result = await adminRequest(`/admin/templates/${id}/sanitize`, {
    method: 'POST',
  });
  return result.data;
}

export async function listAdminSessions(filters = {}) {
  const result = await adminRequest(`/admin/sessions${buildAdminQuery(filters)}`);
  return result.data;
}

export async function regenerateAdminSession(id) {
  const result = await adminRequest(`/admin/sessions/${id}/regenerate`, {
    method: 'POST',
  });
  return result.data;
}

export async function deleteAdminSession(id) {
  const result = await adminRequest(`/admin/sessions/${id}`, {
    method: 'DELETE',
  });
  return result.data;
}

export async function listAdminPurchases(filters = {}) {
  const result = await adminRequest(`/admin/purchases${buildAdminQuery(filters)}`);
  return result.data;
}

export async function creditAdminCurrency(userId, currency, amount) {
  const result = await adminRequest('/admin/currency/credit', {
    method: 'POST',
    body: { userId, currency, amount },
  });
  return result.data;
}

export async function deductAdminCurrency(userId, currency, amount) {
  const result = await adminRequest('/admin/currency/deduct', {
    method: 'POST',
    body: { userId, currency, amount },
  });
  return result.data;
}

export async function listAdminMiningJobs(filters = {}) {
  const result = await adminRequest(`/admin/mining-jobs${buildAdminQuery(filters)}`);
  return result.data;
}

export async function retryAdminMiningJob(id) {
  const result = await adminRequest(`/admin/mining-jobs/${id}/retry`, {
    method: 'POST',
  });
  return result.data;
}

export async function pauseAdminMiningJob(id) {
  const result = await adminRequest(`/admin/mining-jobs/${id}/pause`, {
    method: 'POST',
  });
  return result.data;
}

export async function resumeAdminMiningJob(id) {
  const result = await adminRequest(`/admin/mining-jobs/${id}/resume`, {
    method: 'POST',
  });
  return result.data;
}

export async function getAdminSettings() {
  // Settings are public so the editor's generation mode switch can read them
  // even when the user is not logged in as admin.
  const result = await request('/admin/settings');
  return result.data;
}

export async function updateAdminSettings(settings) {
  const result = await adminRequest('/admin/settings', {
    method: 'PATCH',
    body: settings,
  });
  return result.data;
}

// ===== Admin Users API =====
export async function listAdminUsers(filters = {}) {
  const result = await adminRequest(`/admin/users${buildAdminQuery(filters)}`);
  return result.data;
}

export async function getAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}`);
  return result.data;
}

export async function updateAdminUser(id, data) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  });
  return result.data;
}

export async function blockAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/block`, {
    method: 'POST',
  });
  return result.data;
}

export async function unblockAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/unblock`, {
    method: 'POST',
  });
  return result.data;
}

export async function impersonateAdminUser(id) {
  const result = await adminRequest(`/admin/users/${encodeURIComponent(id)}/impersonate`, {
    method: 'POST',
  });
  return result.data;
}
