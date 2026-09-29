import express from 'express';
import { ApiError, formatScore, normalizeMode, normalizePeriod } from '../utils/rules.js';
import { asyncHandler } from '../middleware/error.js';
import { optionalUser, requireUser } from '../middleware/auth.js';

/**
 * Ranking público.
 * Critério de classificação (definido no banco / no repositório, nunca no cliente):
 *   1) maior pontuação  2) maior percentual  3) mais acertos  4) resultado mais recente
 *
 * Filtros de período: hoje | semana | mês | geral
 * Filtros de modo:    todas | fácil | médio | difícil
 */
export function createRankingRoutes({ repo }) {
  const router = express.Router();

  function parseFilters(query = {}) {
    const period = normalizePeriod(query.period);
    if (!period) throw new ApiError(400, 'Período inválido. Use all/hoje, today/hoje, week/semana ou month/mes.');

    let mode = 'all';
    if (query.difficulty !== undefined || query.mode !== undefined) {
      const raw = (query.difficulty ?? query.mode ?? '').toString().toLowerCase();
      if (raw && !['all', 'todas', 'todos', ''].includes(raw)) {
        const normalized = normalizeMode(raw);
        if (!normalized) throw new ApiError(400, 'Dificuldade inválida. Use all, facil, medio ou dificil.');
        mode = normalized;
      }
    }

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return { period, mode, limit, offset };
  }

  function decorate(row) {
    return {
      ...row,
      best_percentage: Number(row.best_percentage),
      score_label: formatScore(row.best_score),
      medal: row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null,
      position_label: `${row.rank}º`,
    };
  }

  async function handle(req, res, periodOverride) {
    const filters = parseFilters(req.query);
    const period = periodOverride || filters.period;
    const rows = await repo.leaderboard({ ...filters, period });
    const decorated = rows.map(decorate);

    // Posição do jogador autenticado (mesmo quando ele está fora da página exibida)
    let me = null;
    if (req.userId) {
      const inPage = decorated.find((row) => row.user_id === req.userId);
      if (inPage) {
        me = inPage;
      } else {
        const info = await repo
          .playerRank({ userId: req.userId, period, mode: filters.mode })
          .catch(() => ({ rank: 0, total_players: 0, beaten_percentage: 0 }));
        if (info.rank) me = { rank: info.rank, user_id: req.userId, outside_page: true };
      }
    }

    res.json({
      period,
      mode: filters.mode,
      total: rows.length,
      items: decorated,
      me,
    });
  }

  router.get('/', optionalUser(repo), asyncHandler((req, res) => handle(req, res)));
  router.get('/today', optionalUser(repo), asyncHandler((req, res) => handle(req, res, 'today')));
  router.get('/week', optionalUser(repo), asyncHandler((req, res) => handle(req, res, 'week')));
  router.get('/month', optionalUser(repo), asyncHandler((req, res) => handle(req, res, 'month')));
  router.get('/all', optionalUser(repo), asyncHandler((req, res) => handle(req, res, 'all')));

  /** Posição do jogador autenticado. */
  router.get(
    '/me',
    requireUser(repo),
    asyncHandler(async (req, res) => {
      const filters = parseFilters(req.query);
      const info = await repo.playerRank({ userId: req.userId, period: filters.period, mode: filters.mode });
      res.json({
        ...info,
        position_label: info.rank ? `${info.rank}º lugar` : 'fora do ranking',
      });
    }),
  );

  return router;
}

export default createRankingRoutes;
