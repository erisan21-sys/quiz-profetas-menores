import express from 'express';
import { asyncHandler } from '../middleware/error.js';
import { attemptSummary } from '../services/quizService.js';

/** Estatísticas públicas + catálogo de conquistas. */
export function createStatsRoutes({ repo }) {
  const router = express.Router();

  /* GET /api/stats — dashboard público */
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const [stats, recent] = await Promise.all([
        repo.globalStats(),
        repo.publicRecentAttempts({ limit: 10 }).catch(() => []),
      ]);
      res.json({
        ...stats,
        recent_attempts: recent.map((item) => ({
          nickname: item.nickname,
          score: item.score,
          score_label: item.score.toLocaleString('pt-BR'),
          percentage: item.percentage,
          correct_answers: item.correct_answers,
          total_questions: item.total_questions,
          date_label: new Date(item.finished_at).toLocaleDateString('pt-BR'),
        })),
      });
    }),
  );

  /* GET /api/stats/attempts — últimas partidas (visão administrativa pública) */
  router.get(
    '/attempts',
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const { items, total } = await repo.listAttempts({ status: 'FINISHED', limit });
      res.json({
        total,
        items: items.map((attempt) => attemptSummary(attempt, { nickname: attempt.nickname })),
      });
    }),
  );

  /* GET /api/achievements — catálogo público */
  router.get(
    '/achievements',
    asyncHandler(async (_req, res) => {
      const items = await repo.listAchievements();
      res.json({ items });
    }),
  );

  return router;
}

export default createStatsRoutes;
