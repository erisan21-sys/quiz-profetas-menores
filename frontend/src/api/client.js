import { sessionStore } from '../lib/storage.js';

/**
 * Cliente da API do Quiz Bíblico — Profetas Menores.
 * ---------------------------------------------------------------------------
 * • Base: VITE_API_URL (produção) ou mesma origem (dev usa o proxy do Vite).
 * • O token de sessão vai no cabeçalho Authorization.
 * • O navegador NUNCA recebe o gabarito antes de responder e NUNCA calcula
 *   a pontuação oficial: apenas exibe o que o servidor devolve.
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export class OfflineError extends Error {
  constructor(message = 'Sem conexão com o servidor.') {
    super(message);
    this.name = 'OfflineError';
  }
}

async function request(method, path, { body, token, retry = true, signal } = {}) {
  const headers = { 'content-type': 'application/json' };
  const authToken = token === undefined ? sessionStore.read()?.token : token;
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new OfflineError();
  }

  if (response.status === 429 && retry) {
    const data = await safeJson(response);
    const retryAfter = Number(data?.retry_after_seconds || 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 5) * 1000));
    return request(method, path, { body, token, retry: false, signal });
  }

  const data = await safeJson(response);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || `Erro ${response.status}`, data?.details);
  }
  return data;
}

async function safeJson(response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export const api = {
  /* ------------------------------------------------------------ sessão */
  register: (payload) => request('POST', '/users', { body: payload, token: null }),
  rejoin: (payload) => request('POST', '/users/rejoin', { body: payload, token: null }),
  myProfile: () => request('GET', '/users/me/profile'),
  myAchievements: () => request('GET', '/users/me/achievements'),
  updateMe: (payload) => request('PATCH', '/users/me', { body: payload }),
  deleteMe: (mode) => request('DELETE', `/users/me?mode=${mode}`),

  /* ------------------------------------------------------------- público */
  profile: (id) => request('GET', `/users/${id}`),
  history: (id, params = {}) =>
    request('GET', `/users/${id}/history?${new URLSearchParams(params)}`),
  stats: () => request('GET', '/stats'),
  publicAttempts: () => request('GET', '/attempts/public'),
  attempt: (id) => request('GET', `/attempts/${id}`),
  questionsCatalog: () => request('GET', '/questions'),
  rules: () => request('GET', '/quiz/rules'),
  achievementsCatalog: () => request('GET', '/stats/achievements'),
  health: () => request('GET', '/health', { token: null }),

  /* ------------------------------------------------------------- ranking */
  ranking: (params = {}) => request('GET', `/ranking?${new URLSearchParams(params)}`),
  myRank: (params = {}) => request('GET', `/ranking/me?${new URLSearchParams(params)}`),

  /* ---------------------------------------------------------------- jogo */
  start: (mode, prophet = 'todos') => request('POST', '/quiz/start', { body: { mode, prophet } }),
  answer: (payload) => request('POST', '/quiz/answer', { body: payload, retry: false }),
  finish: (attemptId) => request('POST', '/quiz/finish', { body: { attempt_id: attemptId } }),

  /* --------------------------------------------------------------- admin */
  adminOverview: (token) => request('GET', '/admin/overview', { token }),
  adminUsers: (params, token) => request('GET', `/admin/users?${new URLSearchParams(params)}`, { token }),
  adminSetRole: (id, role, token) => request('PATCH', `/admin/users/${id}/role`, { body: { role }, token }),
  adminRemoveUser: (id, mode, token) => request('DELETE', `/admin/users/${id}?mode=${mode}`, { token }),
  adminQuestions: (token) => request('GET', '/admin/questions', { token }),
  adminCreateQuestion: (payload, token) => request('POST', '/admin/questions', { body: payload, token }),
  adminUpdateQuestion: (id, payload, token) => request('PUT', `/admin/questions/${id}`, { body: payload, token }),
  adminDeleteQuestion: (id, token) => request('DELETE', `/admin/questions/${id}`, { token }),
  adminAttempts: (params, token) => request('GET', `/admin/attempts?${new URLSearchParams(params)}`, { token }),
  adminRanking: (params, token) => request('GET', `/admin/ranking?${new URLSearchParams(params)}`, { token }),
  adminStats: (token) => request('GET', '/admin/stats', { token }),
};

/* ---------------------------------------------------------------------------
 * Compartilhamento (WhatsApp / copiar)
 * ------------------------------------------------------------------------- */

export function buildShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function shareResult(message) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Quiz Bíblico — Profetas Menores', text: message });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  window.open(buildShareUrl(message), '_blank', 'noopener');
  return 'whatsapp';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
