import { ApiError, isUuid } from '../utils/rules.js';
import { extractToken, verifyUserToken, constantTimeEqual } from '../utils/token.js';
import config from '../config/index.js';

/**
 * Exige sessão válida do jogador e carrega o usuário do banco.
 * Também atualiza `last_seen_at`.
 */
export function requireUser(repo) {
  return async (req, _res, next) => {
    try {
      const token = extractToken(req);
      if (!token) throw new ApiError(401, 'Você precisa entrar para usar este recurso.');

      let userId;
      try {
        userId = verifyUserToken(token, config.security.tokenSecret);
      } catch {
        throw new ApiError(401, 'Sessão inválida. Entre novamente.');
      }
      if (!isUuid(userId)) throw new ApiError(401, 'Sessão inválida. Entre novamente.');

      const user = await repo.getUserById(userId);
      if (!user) throw new ApiError(404, 'Jogador não encontrado.');

      await repo.touchUser(userId).catch(() => {});
      req.userId = user.id;
      req.user = user;
      req.userToken = token;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Sessão opcional: se houver token válido, popula req.userId; caso contrário
 * segue como visitante (usado no ranking público e em /api/users/:id).
 */
export function optionalUser(repo) {
  return async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
      const userId = verifyUserToken(token, config.security.tokenSecret);
      if (isUuid(userId)) {
        const user = await repo.getUserById(userId);
        if (user) {
          req.userId = user.id;
          req.user = user;
        }
      }
    } catch {
      /* token inválido => continua como visitante */
    }
    return next();
  };
}

/**
 * Protege a área administrativa.
 * Aceita:
 *   • Authorization: Bearer <ADMIN_TOKEN>  (v1.0 — token de configuração)
 *   • registro em admin_tokens cujo hash confira e ainda esteja válido (v1.1+)
 */
export function requireAdmin(repo) {
  return async (req, _res, next) => {
    try {
      const token = extractToken(req);
      if (!token) throw new ApiError(401, 'Acesso restrito ao administrador.');

      const configured = config.security.adminToken;
      if (configured && configured.length >= 16 && constantTimeEqual(token, configured)) {
        req.isAdmin = true;
        req.adminVia = 'ADMIN_TOKEN';
        return next();
      }

      const record = await repo.getAdminTokenByHash?.(token).catch(() => null);
      if (record && !record.revoked_at && new Date(record.expires_at) > new Date()) {
        req.isAdmin = true;
        req.adminVia = 'admin_tokens';
        req.adminUserId = record.user_id;
        return next();
      }

      throw new ApiError(403, 'Credencial de administrador inválida.');
    } catch (err) {
      next(err);
    }
  };
}
