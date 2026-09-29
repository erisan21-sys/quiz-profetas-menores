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
 * Falha rápida e clara se algo essencial estiver faltando em produção.
 * Em desenvolvimento (DB_DRIVER=local) o app sobe sem Supabase configurado.
 */
export function assertConfig() {
  const problems = [];

  if (config.isProduction) {
    if (!config.security.tokenSecret || config.security.tokenSecret.includes('troque')) {
      problems.push('TOKEN_SECRET deve ser definido com um valor aleatório forte em produção.');
    }
    if (!config.security.adminToken || config.security.adminToken.includes('troque')) {
      problems.push('ADMIN_TOKEN deve ser definido com um valor aleatório forte em produção.');
    }
    if (config.allowAnyOrigin) {
      problems.push('CORS_ORIGIN não deve ser "*" em produção.');
    }
  }

  if (config.db.driver === 'supabase') {
    if (!config.db.supabaseUrl) problems.push('SUPABASE_URL está vazio (DB_DRIVER=supabase).');
    if (!config.db.supabaseServiceKey) {
      problems.push('SUPABASE_SERVICE_ROLE_KEY está vazio (DB_DRIVER=supabase).');
    }
    if (!config.security.tokenSecret) problems.push('TOKEN_SECRET está vazio.');
  }

  if (!config.security.tokenSecret && config.db.driver !== 'local') {
    problems.push('TOKEN_SECRET está vazio.');
  }

  if (problems.length) {
    throw new Error(`Configuração inválida:\n- ${problems.join('\n- ')}`);
  }

  return true;
}

/** Gera um segredo efêmero quando nenhum foi informado (apenas desenvolvimento). */
export function devSecret() {
  return randomUUID().replace(/-/g, '');
}

export default config;
