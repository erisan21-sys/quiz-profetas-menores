import express from 'express';
import { ApiError, isUuid, formatDuration, formatScore, normalizeMode } from '../utils/rules.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/auth.js';
import { getAdminLimiter } from '../middleware/rateLimit.js';
import { validateQuestionPayload } from '../utils/validation.js';
import { attemptSummary } from '../services/quizService.js';

/**
 * Área administrativa (/admin no frontend → /api/admin na API).
 * Protegida por ADMIN_TOKEN (v1.0) ou por registro em admin_tokens (v1.1+).
 */
export function createAdminRoutes({ repo }) {
  const router = express.Router();

  router.use(requireAdmin(repo));
  router.use(getAdminLimiter());

  /* ----------------------------------------------------------- dashboard */
  router.get(
    '/overview',
    asyncHandler(async (_req, res) => {
      const [stats, users, attempts, questions] = await Promise.all([
        repo.globalStats(),
        repo.listUsers({ limit: 5 }),
        repo.listAttempts({ limit: 5 }),
        repo.listQuestions({ includeInactive: true }),
      ]);

      const distribution = questions.reduce(
        (acc, q) => {
          const key = q.active === false ? 'inativas' : q.difficulty;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { facil: 0, medio: 0, dificil: 0, inativas: 0 },
      );

      res.json({
        stats,
        distribution,
        latest_users: users.items.map((u) => ({
          id: u.id, name: u.name, nickname: u.nickname, role: u.role,
          created_at: u.created_at, last_seen_at: u.last_seen_at,
        })),
        latest_attempts: attempts.items.map((a) => attemptSummary(a, { nickname: a.nickname })),
      });
    }),
  );

  /* --------------------------------------------------------------- users */
  router.get(
    '/users',
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const { items, total } = await repo.listUsers({ limit, offset, search: req.query.search || '' });

      const enriched = await Promise.all(
        items.map(async (user) => {
          const stats = await repo.playerStats(user.id).catch(() => null);
          return {
            id: user.id,
            name: user.name,
            nickname: user.nickname,
            email: user.email,
            role: user.role,
            share_profile: user.share_profile,
            created_at: user.created_at,
            last_seen_at: user.last_seen_at,
            attempts: stats?.attempts ?? 0,
            best_score: stats?.best_score ?? 0,
            best_score_label: formatScore(stats?.best_score ?? 0),
            avg_score: stats?.avg_score ?? 0,
          };
        }),
      );

      res.json({ total, items: enriched });
    }),
  );

  router.patch(
    '/users/:id/role',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador inválido.');
      const role = req.body?.role === 'admin' ? 'admin' : 'player';
      const user = await repo.setRole(id, role);
      if (!user) throw new ApiError(404, 'Jogador não encontrado.');
      await repo.logAudit({ user_id: id, action: 'ROLE_CHANGED', detail: { role } }).catch(() => {});
      res.json({ id: user.id, nickname: user.nickname, role: user.role });
    }),
  );

  router.delete(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador inválido.');
      const mode = req.query.mode === 'delete' ? 'delete' : 'anonymize';
      if (mode === 'delete') await repo.deleteUser(id);
      else await repo.anonymizeUser(id);
      await repo.logAudit({ user_id: id, action: 'ADMIN_USER_REMOVED', detail: { mode } }).catch(() => {});
      res.json({ ok: true, mode });
    }),
  );

  /* ----------------------------------------------------------- questions */
  router.get(
    '/questions',
    asyncHandler(async (req, res) => {
      const mode = normalizeMode(req.query.difficulty);
      const all = await repo.listQuestions({ includeInactive: true });
      const items = mode && mode !== 'mixed' ? all.filter((q) => q.difficulty === mode) : all;
      res.json({ total: items.length, items });
    }),
  );

  router.post(
    '/questions',
    asyncHandler(async (req, res) => {
      const payload = validateQuestionPayload(req.body || {});
      const question = await repo.createQuestion(payload);
      await repo.logAudit({ action: 'QUESTION_CREATED', detail: { id: question.id } }).catch(() => {});
      res.status(201).json({ question });
    }),
  );

  router.put(
    '/questions/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador inválido.');
      const payload = validateQuestionPayload(req.body || {}, { partial: true });
      if (!Object.keys(payload).length) throw new ApiError(400, 'Nada para atualizar.');
      const question = await repo.updateQuestion(id, payload);
      if (!question) throw new ApiError(404, 'Questão não encontrada.');
      await repo.logAudit({ action: 'QUESTION_UPDATED', detail: { id, fields: Object.keys(payload) } }).catch(() => {});
      res.json({ question });
    }),
  );

  router.delete(
    '/questions/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador inválido.');
      const result = await repo.deleteQuestion(id);
      await repo.logAudit({ action: 'QUESTION_DELETED', detail: { id, result } }).catch(() => {});
      res.json({
        ok: true,
        result,
        message: result === 'deactivated'
          ? 'A questão já foi respondida em partidas: ela foi desativada (o histórico é preservado).'
          : 'Questão removida.',
      });
    }),
  );

  /* ------------------------------------------------------------ attempts */
  router.get(
    '/attempts',
    asyncHandler(async (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const status = req.query.status || null;
      const userId = req.query.user_id && isUuid(req.query.user_id) ? req.query.user_id : null;
      const { items, total } = await repo.listAttempts({ limit, offset, status, userId });

      res.json({
        total,
        items: items.map((a) => attemptSummary(a, {
          nickname: a.nickname,
          name: a.name,
          duration_label: a.duration_seconds === null ? '—' : formatDuration(a.duration_seconds),
          score_label: formatScore(a.score),
        })),
      });
    }),
  );

  /* ------------------------------------------------------------- ranking */
  router.get(
    '/ranking',
    asyncHandler(async (req, res) => {
      const period = ['today', 'week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'all';
      const mode = normalizeMode(req.query.difficulty) || 'all';
      const items = await repo.leaderboard({ period, mode: mode === 'mixed' ? 'all' : mode, limit: 200 });
      res.json({ period, mode, items });
    }),
  );

  /* --------------------------------------------------------------- stats */
  router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
      res.json(await repo.globalStats());
    }),
  );

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      res.json(await repo.health());
    }),
  );

  return router;
}

export default createAdminRoutes;
