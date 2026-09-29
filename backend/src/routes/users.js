import express from 'express';
import { ApiError, isUuid, sanitizeText, validatePlayerInput } from '../utils/rules.js';
import { issueUserToken } from '../utils/token.js';
import { asyncHandler } from '../middleware/error.js';
import { requireUser } from '../middleware/auth.js';
import { getAuthLimiter } from '../middleware/rateLimit.js';
import { attemptSummary } from '../services/quizService.js';
import config from '../config/index.js';

/**
 * Rotas de jogadores: cadastro, perfil, histórico, conquistas e exclusão.
 * v1.0: cadastro simples por nome/apelido (sem senha).
 * v1.2: os campos email/auth_id já existem no banco para o Supabase Auth.
 */
export function createUserRoutes({ repo, achievements }) {
  const router = express.Router();

  /** Perfil público (sem dados pessoais além de nome/apelido). */
  function publicProfile(user) {
    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      role: user.role,
      share_profile: user.share_profile,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at,
    };
  }

  async function buildProfilePayload(id) {
    const [stats, rank, userAchievements, history] = await Promise.all([
      repo.playerStats(id),
      repo
        .playerRank({ userId: id, period: 'all', mode: 'all' })
        .catch(() => ({ rank: 0, total_players: 0, beaten_percentage: 0 })),
      achievements.listFor(id),
      repo.listAttempts({ userId: id, status: 'FINISHED', limit: 50 }),
    ]);
    return { stats, rank, userAchievements, history };
  }

  /* ----------------------------------------------------------------------- */
  /* POST /api/users — cadastro simples                                      */
  /* ----------------------------------------------------------------------- */
  router.post(
    '/',
    getAuthLimiter(),
    asyncHandler(async (req, res) => {
      const { name, nickname } = validatePlayerInput(req.body || {});

      const existing = await repo.getUserByNickname(nickname);
      if (existing) {
        throw new ApiError(409, 'Este apelido já está em uso. Escolha outro ou use "Já tenho cadastro".', {
          field: 'nickname',
        });
      }

      const user = await repo.createUser({ name, nickname });
      const { token, expires_at } = issueUserToken(user.id, config.security.tokenSecret);

      await repo
        .logAudit({ user_id: user.id, action: 'USER_CREATED', detail: { nickname } })
        .catch(() => {});

      res.status(201).json({ user: publicProfile(user), token, expires_at });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* POST /api/users/rejoin — recuperar sessão pelo apelido (v1.0)           */
  /* ----------------------------------------------------------------------- */
  router.post(
    '/rejoin',
    getAuthLimiter(),
    asyncHandler(async (req, res) => {
      const nickname = sanitizeText(req.body?.nickname, 30);
      if (nickname.length < 2) throw new ApiError(400, 'Informe o seu apelido.');

      const user = await repo.getUserByNickname(nickname);
      if (!user) throw new ApiError(404, 'Nenhum jogador encontrado com esse apelido.');

      await repo.touchUser(user.id).catch(() => {});
      const { token, expires_at } = issueUserToken(user.id, config.security.tokenSecret);
      res.json({ user: publicProfile(user), token, expires_at });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* GET /api/users/me/profile — perfil do jogador autenticado                */
  /* (definido antes de /:id para não colidir)                                */
  /* ----------------------------------------------------------------------- */
  router.get(
    '/me/profile',
    requireUser(repo),
    asyncHandler(async (req, res) => {
      const user = req.user;
      const { stats, rank, userAchievements, history } = await buildProfilePayload(user.id);
      res.json({
        user: publicProfile(user),
        rank: rank.rank,
        total_players: rank.total_players,
        beaten_percentage: rank.beaten_percentage,
        stats,
        achievements: userAchievements,
        history: history.items.map((attempt) => attemptSummary(attempt)),
      });
    }),
  );

  router.get(
    '/me/achievements',
    requireUser(repo),
    asyncHandler(async (req, res) => {
      res.json({ items: await achievements.listFor(req.userId) });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* PATCH /api/users/me — privacidade / nome                                */
  /* ----------------------------------------------------------------------- */
  router.patch(
    '/me',
    requireUser(repo),
    asyncHandler(async (req, res) => {
      const updates = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'share_profile')) {
        updates.share_profile = Boolean(req.body.share_profile);
      }
      if (req.body?.name !== undefined) {
        updates.name = sanitizeText(req.body.name, 80);
        if (updates.name.length < 2) throw new ApiError(400, 'Nome inválido.');
      }
      if (!Object.keys(updates).length) throw new ApiError(400, 'Nada para atualizar.');

      const user = await repo.updateUser(req.userId, updates);
      if (!user) throw new ApiError(404, 'Jogador não encontrado.');
      res.json({ user: publicProfile(user) });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* DELETE /api/users/me — "Excluir minha conta"                            */
  /*   mode=anonymize (padrão): mantém estatísticas agregadas, remove identidade
  /*   mode=delete:             remove o jogador e todas as suas partidas      */
  /* ----------------------------------------------------------------------- */
  router.delete(
    '/me',
    requireUser(repo),
    asyncHandler(async (req, res) => {
      const mode = req.query.mode === 'delete' ? 'delete' : 'anonymize';

      if (mode === 'delete') await repo.deleteUser(req.userId);
      else await repo.anonymizeUser(req.userId);

      await repo.logAudit({ user_id: req.userId, action: 'USER_DELETED', detail: { mode } }).catch(() => {});
      res.json({
        ok: true,
        mode,
        message:
          mode === 'delete'
            ? 'Conta e histórico removidos.'
            : 'Dados pessoais anonimizados. Suas partidas deixaram de aparecer no ranking.',
      });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* GET /api/users/:id — perfil público + estatísticas                      */
  /* ----------------------------------------------------------------------- */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador de jogador inválido.');

      const user = await repo.getUserById(id);
      if (!user) throw new ApiError(404, 'Jogador não encontrado.');

      const isSelf = Boolean(req.userId) && req.userId === id;
      if (!isSelf && user.share_profile === false) {
        throw new ApiError(403, 'Este jogador optou por não exibir o perfil publicamente.');
      }

      const { stats, rank, userAchievements, history } = await buildProfilePayload(id);
      res.json({
        user: publicProfile(user),
        rank: rank.rank,
        total_players: rank.total_players,
        beaten_percentage: rank.beaten_percentage,
        stats,
        achievements: userAchievements,
        history: history.items.map((attempt) => attemptSummary(attempt)),
      });
    }),
  );

  /* ----------------------------------------------------------------------- */
  /* GET /api/users/:id/history — histórico do jogador                       */
  /* ----------------------------------------------------------------------- */
  router.get(
    '/:id/history',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      if (!isUuid(id)) throw new ApiError(400, 'Identificador de jogador inválido.');

      const user = await repo.getUserById(id);
      if (!user) throw new ApiError(404, 'Jogador não encontrado.');

      const isSelf = Boolean(req.userId) && req.userId === id;
      if (!isSelf && user.share_profile === false) {
        throw new ApiError(403, 'Histórico indisponível: este jogador não compartilha o perfil.');
      }

      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const status = req.query.status === 'all' ? null : req.query.status || 'FINISHED';

      const { items, total } = await repo.listAttempts({ userId: id, status, limit, offset });
      res.json({ total, items: items.map((attempt) => attemptSummary(attempt)) });
    }),
  );

  return router;
}

export default createUserRoutes;
