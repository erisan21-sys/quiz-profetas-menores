import http from 'node:http';
import config from '../../src/config/index.js';
import { createApp, ensureSeedData } from '../../src/app.js';
import { createLocalRepo } from '../../src/db/localRepo.js';
import { QUESTIONS, ACHIEVEMENTS } from '../../src/db/seedData.js';
import { resetLimiters } from '../../src/middleware/rateLimit.js';

/**
 * Kit de testes: sobe a aplicação Express real com o repositório local
 * (mesma interface do repositório Supabase) e expõe helpers de requisição.
 */

export const ADMIN_TOKEN = 'test-admin-token-super-secreto';

export const LETTERS = ['A', 'B', 'C', 'D'];

/** Devolve a primeira letra diferente do gabarito (resposta errada determinística). */
export function wrongLetterFor(correctLetter) {
  return LETTERS.find((letter) => letter !== correctLetter);
}
export const TOKEN_SECRET = 'test-token-secret-super-secreto';

export function applyTestConfig(overrides = {}) {
  config.env = 'test';
  config.isProduction = false;
  config.corsOrigins = ['*'];
  config.allowAnyOrigin = true;
  config.security.tokenSecret = TOKEN_SECRET;
  config.security.adminToken = ADMIN_TOKEN;
  config.security.httpLog = 'off';
  config.db.driver = 'local';
  config.game.minAnswerIntervalMs = 0;
  config.game.attemptTtlSeconds = 14400;
  config.game.maxDurationSeconds = 7200;
  config.game.quizSize = 20;
  config.rateLimit.windowMinutes = 15;
  config.rateLimit.max = 100000;
  config.rateLimit.maxQuiz = 100000;
  config.rateLimit.maxAdmin = 100000;
  config.rateLimit.maxAuth = 100000;
  config.rateLimit.maxStart = 100000;
  config.rateLimit.maxAnswer = 100000;
  Object.assign(config.game, overrides.game || {});
  Object.assign(config.rateLimit, overrides.rateLimit || {});
  Object.assign(config.security, overrides.security || {});
  return config;
}

export async function startTestApp(options = {}) {
  applyTestConfig(options.config);
  resetLimiters();
  const repo = options.repo || createLocalRepo({ file: null });
  await repo.ensureSeed(QUESTIONS, ACHIEVEMENTS);

  const app = createApp({ repo, assertConfig: false, staticDir: null });
  await ensureSeedData(repo);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  let ipCounter = 10;
  const fakeIp = () => `203.0.113.${ipCounter++}`;

  const api = async (method, url, { body, token, ip, headers } = {}) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(ip ? { 'x-forwarded-for': ip } : {}),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { status: res.status, body: data, headers: res.headers };
  };

  const client = {
    repo,
    app,
    config,
    baseUrl,
    fakeIp,
    questions: QUESTIONS,
    get: (url, opts) => api('GET', url, opts),
    post: (url, body, opts) => api('POST', url, { ...opts, body }),
    patch: (url, body, opts) => api('PATCH', url, { ...opts, body }),
    put: (url, body, opts) => api('PUT', url, { ...opts, body }),
    del: (url, opts) => api('DELETE', url, opts),

    async register({ name = 'Jogador Teste', nickname = `jogador_${Math.random().toString(36).slice(2, 8)}` } = {}) {
      const res = await api('POST', '/api/users', { body: { name, nickname } });
      return { ...res, user: res.body?.user, token: res.body?.token, nickname };
    },

    async start(token, { mode = 'mixed' } = {}) {
      return api('POST', '/api/quiz/start', { body: { mode }, token });
    },

    async answer(token, attemptId, questionId, selected, extra = {}) {
      return api('POST', '/api/quiz/answer', {
        body: { attempt_id: attemptId, question_id: questionId, selected_answer: selected, ...extra },
        token,
      });
    },

    async finish(token, attemptId, extra = {}) {
      return api('POST', '/api/quiz/finish', { body: { attempt_id: attemptId, ...extra }, token });
    },

    /**
     * Joga uma partida inteira usando o gabarito conhecido dos testes
     * (acertos controlados por `wrongAt` — posições, 1-based, a errar).
     */
    async playGame(token, { wrongAt = [], wrongDifficulties = null, mode = 'mixed' } = {}) {
      const started = await client.start(token, { mode });
      if (started.status >= 300) return { ok: false, started };

      const attemptId = started.body.attempt.id;
      const questions = started.body.questions;

      // `wrongAt`      -> posições (1-based) a errar
      // `wrongDifficulties` -> quantidade de erros por nível (placar determinístico)
      const wrong = new Set(wrongAt);
      if (wrongDifficulties) {
        const quota = { ...wrongDifficulties };
        for (const question of questions) {
          if ((quota[question.difficulty] ?? 0) > 0) {
            wrong.add(question.position);
            quota[question.difficulty] -= 1;
          }
        }
      }

      for (const question of questions) {
        const seeded = QUESTIONS.find((q) => q.id === question.id);
        const letter = wrong.has(question.position)
          ? wrongLetterFor(seeded.correct_answer)
          : seeded.correct_answer;
        const res = await client.answer(token, attemptId, question.id, letter);
        if (res.status >= 300) return { ok: false, step: 'answer', question, res };
      }

      const finished = await client.finish(token, attemptId);
      return { ok: finished.status < 300, attemptId, started, finished };
    },

    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };

  return client;
}

export default startTestApp;
