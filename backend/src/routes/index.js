import express from 'express';
import { createUserRoutes } from './users.js';
import { createQuizRoutes, createAttemptsRoutes } from './quiz.js';
import { createRankingRoutes } from './ranking.js';
import { createStatsRoutes } from './stats.js';
import { createQuestionsRoutes } from './questions.js';
import { createAdminRoutes } from './admin.js';
import { optionalUser } from '../middleware/auth.js';

/**
 * Monta todas as rotas da API em um único Router.
 * `optionalUser` roda antes de tudo: quando existe um token válido ele popula
 * req.userId, o que permite personalizar respostas públicas (ex.: destacar a
 * própria posição no ranking ou liberar o histórico privado ao dono).
 */
export function createApiRouter({ repo, quiz, achievements }) {
  const api = express.Router();

  api.get('/', (_req, res) => {
    res.json({
      name: 'Quiz Bíblico — Profetas Menores',
      version: '1.0.0',
      docs: '/api/health',
      endpoints: [
        'POST   /api/users',
        'POST   /api/users/rejoin',
        'GET    /api/users/me/profile',
        'GET    /api/users/me/achievements',
        'PATCH  /api/users/me',
        'DELETE /api/users/me',
        'GET    /api/users/:id',
        'GET    /api/users/:id/history',
        'GET    /api/quiz/rules',
        'POST   /api/quiz/start',
        'POST   /api/quiz/answer',
        'POST   /api/quiz/finish',
        'GET    /api/attempts/public',
        'GET    /api/attempts/:id',
        'GET    /api/ranking  (?period=hoje|semana|mes|geral&difficulty=todas|facil|medio|dificil)',
        'GET    /api/ranking/today',
        'GET    /api/ranking/week',
        'GET    /api/ranking/month',
        'GET    /api/ranking/me',
        'GET    /api/stats',
        'GET    /api/stats/attempts',
        'GET    /api/stats/achievements',
        'GET    /api/questions',
        'ANY    /api/admin/*   (Authorization: Bearer ADMIN_TOKEN)',
      ],
    });
  });

  api.use(optionalUser(repo));

  api.use('/users', createUserRoutes({ repo, achievements }));
  api.use('/quiz', createQuizRoutes({ repo, quiz, achievements }));
  api.use('/attempts', createAttemptsRoutes({ repo }));
  api.use('/ranking', createRankingRoutes({ repo }));
  api.use('/stats', createStatsRoutes({ repo }));
  api.use('/questions', createQuestionsRoutes({ repo }));
  api.use('/admin', createAdminRoutes({ repo }));

  return api;
}

export default createApiRouter;
