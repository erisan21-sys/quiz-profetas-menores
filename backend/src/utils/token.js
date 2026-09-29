import crypto from 'node:crypto';
import { ApiError } from '../utils/rules.js';

/**
 * Token de sessão do jogador — HMAC-SHA256.
 * Formato:  v1.<userId>.<issuedAt>.<hmac>
 *
 * Objetivo na v1.0: garantir que apenas o dono do user_id consiga iniciar,
 * responder e finalizar partidas. Quando o Supabase Auth entrar (v1.2), este
 * módulo é trocado por verificação de JWT do Supabase sem alterar as rotas.
 */

const PREFIX = 'v1';

function hmac(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueUserToken(userId, secret, ttlSeconds = 60 * 60 * 24 * 365) {
  if (!userId) throw new ApiError(500, 'Não foi possível emitir o token do jogador.');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlSeconds * 1000;
  const payload = `${PREFIX}.${userId}.${issuedAt}.${expiresAt}`;
  return { token: `${payload}.${hmac(payload, secret)}`, expires_at: new Date(expiresAt).toISOString() };
}

export function verifyUserToken(token, secret) {
  if (typeof token !== 'string') throw new ApiError(401, 'Sessão inválida. Entre novamente.');
  const parts = token.trim().split('.');
  if (parts.length !== 5 || parts[0] !== PREFIX) {
    throw new ApiError(401, 'Sessão inválida. Entre novamente.');
  }
  const [, userId, issuedAt, expiresAt, signature] = parts;
  const payload = `${PREFIX}.${userId}.${issuedAt}.${expiresAt}`;

  const expected = hmac(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ApiError(401, 'Sessão inválida. Entre novamente.');
  }
  if (Number(expiresAt) < Date.now()) {
    throw new ApiError(401, 'Sessão expirada. Entre novamente.');
  }
  return userId;
}

/** Extrai o Bearer token do cabeçalho Authorization (ou x-user-token). */
export function extractToken(req) {
  const header = req.get('authorization') || req.get('x-user-token') || '';
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : header.trim();
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
