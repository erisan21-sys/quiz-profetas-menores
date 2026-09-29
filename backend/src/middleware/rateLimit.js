import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

/**
 * Proteções contra abuso (item 23 do escopo):
 *  • spam de requisições
 *  • criação excessiva de partidas
 *  • envio repetido de respostas
 *  • chamadas abusivas à API em geral
 *
 * A chave é o IP; quando há sessão válida, o limite passa a ser por jogador
 * (evita punir várias pessoas atrás do mesmo NAT).
 *
 * Os limitadores são criados sob demanda (fábricas) para que os valores de
 * configuração — inclusive os ajustados em teste — sejam respeitados.
 */

function keyGenerator(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return req.userId ? `user:${req.userId}` : `ip:${ip}`;
}

const cache = new Map();

function limiter(name, factory) {
  if (!cache.has(name)) cache.set(name, factory());
  return cache.get(name);
}

function jsonHandler(message) {
  return (_req, res, _next, options) => {
    res.status(429).json({
      error: message,
      retry_after_seconds: Math.max(1, Math.ceil((options?.windowMs || 60000) / 1000)),
    });
  };
}

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
};

/** Limite geral da API. */
export const getApiLimiter = () =>
  limiter('api', () =>
    rateLimit({
      ...base,
      windowMs: config.rateLimit.windowMinutes * 60 * 1000,
      limit: config.rateLimit.max,
      handler: jsonHandler('Muitas requisições. Aguarde alguns instantes e tente novamente.'),
    }),
  );

/** Cadastro / recuperação de sessão (evita força bruta e spam de contas). */
export const getAuthLimiter = () =>
  limiter('auth', () =>
    rateLimit({
      ...base,
      windowMs: 10 * 60 * 1000,
      limit: config.rateLimit.maxAuth ?? 20,
      handler: jsonHandler('Muitas tentativas de cadastro. Aguarde 10 minutos e tente novamente.'),
    }),
  );

/** Fluxo de jogo (start/answer/finish). */
export const getQuizLimiter = () =>
  limiter('quiz', () =>
    rateLimit({
      ...base,
      windowMs: 10 * 60 * 1000,
      limit: config.rateLimit.maxQuiz,
      handler: jsonHandler('Limite de jogadas atingido. Aguarde alguns minutos antes de continuar.'),
    }),
  );

/** Criação de partidas. */
export const getStartLimiter = () =>
  limiter('start', () =>
    rateLimit({
      ...base,
      windowMs: 60 * 60 * 1000,
      limit: config.rateLimit.maxStart ?? 40,
      handler: jsonHandler('Você iniciou muitas partidas na última hora. Aguarde um pouco.'),
    }),
  );

/** Envio de respostas. */
export const getAnswerLimiter = () =>
  limiter('answer', () =>
    rateLimit({
      ...base,
      windowMs: 10 * 60 * 1000,
      limit: config.rateLimit.maxAnswer ?? 90,
      handler: jsonHandler('Respostas enviadas rápido demais. Aguarde um instante.'),
    }),
  );

/** Área administrativa. */
export const getAdminLimiter = () =>
  limiter('admin', () =>
    rateLimit({
      ...base,
      windowMs: 15 * 60 * 1000,
      limit: config.rateLimit.maxAdmin,
      handler: jsonHandler('Limite administrativo atingido. Aguarde alguns minutos.'),
    }),
  );

/** Testes podem zerar os limitadores entre cenários. */
export function resetLimiters() {
  cache.clear();
}

export default getApiLimiter;
