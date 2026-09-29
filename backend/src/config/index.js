import 'dotenv/config';
import { randomUUID } from 'node:crypto';

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  port: toInt(process.env.PORT, 8787),
  corsOrigins: toList(process.env.CORS_ORIGIN),
  allowAnyOrigin: (process.env.CORS_ORIGIN || '').includes('*'),

  db: {
    driver: (process.env.DB_DRIVER || 'local').toLowerCase(),
    localFile: process.env.LOCAL_DB_FILE || './data/local-db.json',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  security: {
    tokenSecret: process.env.TOKEN_SECRET || '',
    adminToken: process.env.ADMIN_TOKEN || '',
    httpLog: process.env.HTTP_LOG || 'dev',
  },

  rateLimit: {
    windowMinutes: toInt(process.env.RATE_WINDOW_MINUTES, 15),
    max: toInt(process.env.RATE_MAX, 400),
    maxQuiz: toInt(process.env.RATE_MAX_QUIZ, 180),
    maxAdmin: toInt(process.env.RATE_MAX_ADMIN, 120),
    maxAuth: toInt(process.env.RATE_MAX_AUTH, 20),
    maxStart: toInt(process.env.RATE_MAX_START, 40),
    maxAnswer: toInt(process.env.RATE_MAX_ANSWER, 90),
  },

  game: {
    minAnswerIntervalMs: toInt(process.env.MIN_ANSWER_INTERVAL_MS, 1200),
    attemptTtlSeconds: toInt(process.env.ATTEMPT_TTL_SECONDS, 14400),
    maxDurationSeconds: toInt(process.env.MAX_DURATION_SECONDS, 7200),
    quizSize: toInt(process.env.QUIZ_SIZE, 20),
    quizDistribution: process.env.QUIZ_DISTRIBUTION || '',
  },
};

/**
 * Validação de configuração na inicialização.
 * Inicializa segredos seguros se não forem fornecidos e valida integridade.
 */
export function assertConfig() {
  if (!config.security.tokenSecret || config.security.tokenSecret.includes('troque')) {
    config.security.tokenSecret = devSecret();
    // eslint-disable-next-line no-console
    console.warn('[segurança] TOKEN_SECRET não configurado. Um segredo seguro efêmero foi gerado.');
  }

  if (!config.security.adminToken || config.security.adminToken.includes('troque')) {
    config.security.adminToken = devSecret();
    // eslint-disable-next-line no-console
    console.warn(`[segurança] ADMIN_TOKEN não configurado. Token gerado: ${config.security.adminToken}`);
  }

  if (config.isProduction && config.allowAnyOrigin) {
    // eslint-disable-next-line no-console
    console.warn('[segurança] CORS_ORIGIN está configurado como "*". Em produção, restrinja para a origem do frontend.');
  }

  if (config.db.driver === 'supabase' && (!config.db.supabaseUrl || !config.db.supabaseServiceKey)) {
    // eslint-disable-next-line no-console
    console.warn(
      '[db] DB_DRIVER=supabase configurado sem SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. ' +
        'O serviço usará armazenamento local para manter a aplicação online até que as chaves sejam fornecidas.',
    );
  }

  return true;
}

/** Gera um segredo efêmero quando nenhum foi informado (apenas desenvolvimento). */
export function devSecret() {
  return randomUUID().replace(/-/g, '');
}

export default config;
