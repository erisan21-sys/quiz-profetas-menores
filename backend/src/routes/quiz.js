import express from 'express';
import {
  ApiError,
  BONUS_TABLE,
  MIXED_DISTRIBUTION,
  POINTS,
  maxBaseScore,
  formatDuration,
  formatScore,
  isUuid,
} from '../utils/rules.js';
import { asyncHandler } from '../middleware/error.js';
import { requireUser } from '../middleware/auth.js';
import { getAnswerLimiter, getQuizLimiter, getStartLimiter } from '../middleware/rateLimit.js';
import { attemptSummary, questionReveal } from '../services/quizService.js';
import config from '../config/index.js';

/**
 * Rotas de jogo (/api/quiz/*).
 * O navegador envia apenas attempt_id + question_id + selected_answer;
 * is_correct, pontos, bônus, percentual e duração são calculados no servidor.
 */
export function createQuizRoutes({ repo, quiz, achievements }) {
  const router = express.Router();

  /* ----------------------------------------------------------------------- */
  /* GET /api/quiz/rules — regras públicas (transparência)                    */
  /* ----------------------------------------------------------------------- */
  router.get('/rules', (_req, res) => {
    res.json({
      points: POINTS,
      distribution: MIXED_DISTRIBUTION,
      quiz_size: config.game.quizSize,
      bonus: BONUS_TABLE,
      max_base_score: maxBaseScore(MIXED_DISTRIBUTION),
      attempt_ttl_seconds: config.game.attemptTtlSeconds,
      note: 'A pontuação oficial é calculada e validada pelo servidor. O cronômetro oficial é o relógio do servidor.',
    });
  });

  /* ----------------------------------------------------------------------- */
  /* POST /api/quiz/start                                                    */
  /* ----------------------------------------------------------------------- */
  router.post(
    '/start',
    requireUser(repo),
    getStartLimiter(),
    getQuizLimiter(),
    asyncHandler(async (req, res) => {
      const result = await quiz.startAttempt({
        repo,
        userId: req.userId,
        mode: req.body?.mode,
        prophet: req.body?.prophet,
        quizSize: config.game.quizSize,
        ttlSeconds: config.game.attemptTtlSeconds,
      });
      res.status(result.resumed ? 200 : 201).json(result);
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* POST /api/quiz/answer                                                   */
  /* ----------------------------------------------------------------------- */
  router.post(
    '/answer',
    requireUser(repo),
    getAnswerLimiter(),
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const result = await quiz.answerQuestion({
        repo,
        userId: req.userId,
        attemptId: body.attempt_id,
        questionId: body.question_id,
        selectedAnswer: body.selected_answer,
        minIntervalMs: config.game.minAnswerIntervalMs,
      });
      res.json(result);
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* POST /api/quiz/finish                                                   */
  /* ----------------------------------------------------------------------- */
  router.post(
    '/finish',
    requireUser(repo),
    getQuizLimiter(),
    asyncHandler(async (req, res) => {
      const attemptId = req.body?.attempt_id;
      if (!isUuid(attemptId)) throw new ApiError(400, 'ID de partida inválido.');

      const result = await quiz.finishAttempt({
        repo,
        userId: req.userId,
        attemptId,
        maxDurationSeconds: config.game.maxDurationSeconds,
        achievements,
      });
      res.json(result);
    }),
  );

  return router;
}

/**
 * Rotas de partidas (/api/attempts/*).
 *   GET /api/attempts/public — histórico público de partidas
 *   GET /api/attempts/:id    — detalhe de uma partida
 */
export function createAttemptsRoutes({ repo }) {
  const router = express.Router();

  router.get(
    '/public',
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
      const items = await repo.publicRecentAttempts({ limit });
      res.json({
        total: items.length,
        items: items.map((item) => ({
          ...item,
          score_label: formatScore(item.score),
          date_label: new Date(item.finished_at).toLocaleDateString('pt-BR'),
          time_label: new Date(item.finished_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
      });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador de partida inválido.');

      const attempt = await repo.getAttemptById(id);
      if (!attempt) throw new ApiError(404, 'Partida não encontrada.');

      const isOwner = Boolean(req.userId) && req.userId === attempt.user_id;
      if (!isOwner && attempt.status !== 'FINISHED') {
        throw new ApiError(403, 'Esta partida ainda está em andamento.');
      }

      const [answers, questions, user] = await Promise.all([
        repo.listAnswersByAttempt(id),
        repo.listQuestions({ includeInactive: true }),
        repo.getUserById(attempt.user_id),
      ]);
      const byId = new Map(questions.map((q) => [q.id, q]));

      if (!isOwner && user?.share_profile === false) {
        throw new ApiError(403, 'Este jogador não compartilha resultados publicamente.');
      }

      res.json({
        attempt: attemptSummary(attempt, {
          nickname: user?.nickname ?? '—',
          name: user?.name ?? '—',
          duration_label: formatDuration(attempt.duration_seconds ?? 0),
          score_label: formatScore(attempt.score),
        }),
        answers: answers.map((answer) => {
          const question = byId.get(answer.question_id);
          const base = {
            position: answer.position,
            question_id: answer.question_id,
            selected_answer: answer.selected_answer,
            is_correct: answer.is_correct,
            points: answer.points,
            question: question?.question ?? '(questão indisponível)',
            book: question?.book ?? null,
            book_name: question?.book_name ?? null,
            chapter: question?.chapter ?? null,
            difficulty: question?.difficulty ?? 'facil',
          };
          // Gabarito e explicação: liberados apenas para partidas FINALIZADAS.
          if (isOwner || attempt.status === 'FINISHED') {
            return { ...base, ...(question ? questionReveal(question) : {}) };
          }
          return base;
        }),
      });
    }),
  );

  return router;
}

export default createQuizRoutes;
