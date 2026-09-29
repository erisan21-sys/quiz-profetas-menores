import express from 'express';
import { ApiError, normalizeMode } from '../utils/rules.js';
import { asyncHandler } from '../middleware/error.js';

/**
 * Catálogo público de questões — SEM gabarito e SEM explicação.
 * Serve para a tela "Estudar" e para conferência do número de questões ativas.
 */
export function createQuestionsRoutes({ repo }) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const mode = normalizeMode(req.query.difficulty ?? req.query.mode);
      if (req.query.difficulty !== undefined && req.query.difficulty !== '' && !mode) {
        throw new ApiError(400, 'Dificuldade inválida.');
      }

      const questions = await repo.listActiveQuestions();
      const prophet = req.query.prophet ? String(req.query.prophet).toLowerCase() : null;
      const byProphet = prophet && prophet !== 'todos' ? questions.filter((q) => q.book === prophet) : questions;
      const filtered = mode && mode !== 'mixed'
        ? byProphet.filter((q) => q.difficulty === mode)
        : byProphet;

      const distribution = filtered.reduce(
        (acc, q) => ({ ...acc, [q.difficulty]: (acc[q.difficulty] || 0) + 1 }),
        { facil: 0, medio: 0, dificil: 0 },
      );

      res.json({
        total: filtered.length,
        distribution,
        chapters: [...new Set(filtered.map((q) => q.chapter))].sort((a, b) => a - b),
        items: filtered.map((q, index) => ({
          id: q.id,
          position: index + 1,
          book: q.book,
          book_name: q.book_name,
          chapter: q.chapter,
          difficulty: q.difficulty,
          source_type: q.source_type || 'texto_biblico',
          question: q.question,
        })),
      });
    }),
  );

  return router;
}

export default createQuestionsRoutes;
