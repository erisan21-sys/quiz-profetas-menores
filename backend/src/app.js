import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config, { assertConfig } from './config/index.js';
import { createRepo } from './db/index.js';
import { createApiRouter } from './routes/index.js';
import * as quizService from './services/quizService.js';
import { createAchievementService } from './services/achievementService.js';
import { getApiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { QUESTIONS, ACHIEVEMENTS } from './db/seedData.js';

/**
 * Fábrica da aplicação Express.
 * Receber dependências por parâmetro (repo, services) torna o app testável:
 * os testes injetam o repositório local e fazem requisições HTTP reais.
 */
export function createApp(options = {}) {
  const cfg = options.config || config;
  if (options.assertConfig !== false) assertConfig();

  const repo = options.repo || createRepo({ driver: cfg.db.driver });
  const achievements = options.achievements || createAchievementService(repo);
  const quiz = options.quiz || quizService;

  const app = express();

  app.set('trust proxy', 1); // necessário atrás do proxy da Vercel/Render
  app.disable('x-powered-by');

  /* ---------------------------------------------------------------- segurança */
  app.use(
    helmet({
      contentSecurityPolicy: cfg.isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", ...(cfg.corsOrigins || [])],
              manifestSrc: ["'self'"],
              workerSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || cfg.allowAnyOrigin) return callback(null, true);
        const allowed = (cfg.corsOrigins || []).map((o) => o.replace(/\/$/, ''));
        if (allowed.includes(origin.replace(/\/$/, ''))) return callback(null, true);
        // Em produção o frontend é servido pelo próprio backend (mesma origem).
        return callback(null, cfg.isProduction ? false : true);
      },
      credentials: false,
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '128kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  if (cfg.security.httpLog !== 'off') {
    app.use(morgan(cfg.isProduction ? 'combined' : cfg.security.httpLog, {
      skip: (req) => req.path === '/api/health',
    }));
  }

  /* ------------------------------------------------------------------- limites */
  app.use('/api', getApiLimiter());

  /* -------------------------------------------------------------------- saúde */
  // Health check raiz (exigido por plataformas como Render/Railway):
  // resposta simples, sem qualquer informação sensível.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const info = await repo.health();
      res.json({ ok: true, service: 'quiz-profetas-menores-api', version: '1.0.0', db: info });
    } catch (err) {
      res.status(503).json({ ok: false, service: 'quiz-profetas-menores-api', error: err.message });
    }
  });

  /* ----------------------------------------------------------------- rotas API */
  app.use('/api', createApiRouter({ repo, quiz, achievements }));

  /* ------------------------------------------------- frontend build (produção) */
  if (options.staticDir) {
    app.use(
      express.static(options.staticDir, {
        extensions: ['html'],
        // Arquivos dentro de /assets/ saem do build do Vite com hash no nome
        // (ex.: index-93af1c.js) — o conteúdo nunca muda sob o mesmo nome,
        // então podem ficar em cache por 1 ano no navegador. index.html e o
        // service worker continuam sempre revalidados para que atualizações
        // do app cheguem aos jogadores assim que publicadas.
        maxAge: '1y',
        immutable: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
          if (filePath.endsWith('manifest.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
          if (!filePath.includes(`${path.sep}assets${path.sep}`) && !filePath.endsWith('sw.js')
            && !filePath.endsWith('index.html') && !filePath.endsWith('manifest.webmanifest')) {
            // ícones e outros arquivos fora de /assets/ (sem hash no nome):
            // cache mais curto, só para não ficarem presos a uma versão antiga.
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      }),
    );
    app.get(/^\/(?!api\/).*/, (_req, res, next) => {
      res.sendFile(path.resolve(options.staticDir, 'index.html'), (err) => err && next(err));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  app.locals.repo = repo;
  app.locals.achievements = achievements;

  return app;
}

/** Garante conteúdo inicial (útil apenas para o driver local). */
export async function ensureSeedData(repo) {
  if (typeof repo.ensureSeed === 'function') {
    return repo.ensureSeed(QUESTIONS, ACHIEVEMENTS);
  }
  const count = await repo.listActiveQuestions();
  return { questions: count.length, achievements: (await repo.listAchievements()).length };
}

export default createApp;
