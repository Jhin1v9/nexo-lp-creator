export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3460/api/nexo-lp';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
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
        ...options,
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
export async function getTemplates(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  const result = await request(`/templates${query ? '?' + query : ''}`);
  return result.data;
}

export async function getTemplate(templateId) {
  const result = await request(`/templates/${templateId}`);
  return result.data;
}

export async function useTemplate(sessionId, templateId, userId) {
  const result = await request(`/templates/${templateId}/use`, {
    method: 'POST',
    body: { userId },
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
