import { createClient } from '@supabase/supabase-js';
import NodeWebSocket from 'ws';
import crypto from 'node:crypto';
import { ApiError } from '../utils/rules.js';

/**
 * Repositório SUPABASE (PostgreSQL) — usado em produção.
 * ---------------------------------------------------------------------------
 * Conexão com a SERVICE ROLE KEY (mantida somente no backend). O frontend
 * nunca fala com o Supabase diretamente para operações de jogo.
 *
 * Ranking, estatísticas e posição do jogador são calculados por funções SQL
 * (database/schema.sql): leaderboard(), player_rank(), global_stats(),
 * player_stats().
 */

function unwrap({ data, error }, context = 'consulta') {
  if (error) {
    const status = /duplicate key|unique/i.test(error.message) ? 409 : 400;
    throw new ApiError(status, `Falha no banco (${context}): ${error.message}`);
  }
  return data;
}

export function createSupabaseRepo({ url, serviceKey }) {
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios quando DB_DRIVER=supabase.',
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'quiz-profetas-menores-api' } },
    // Node < 22 não tem WebSocket nativo (exigido pelo canal realtime do
    // supabase-js); fornecemos o pacote `ws` como transporte quando necessário.
    realtime:
      typeof globalThis.WebSocket === 'function'
        ? undefined
        : { transport: NodeWebSocket },
  });

  const repo = {
    driver: 'supabase',
    client: db,

    /* ------------------------------------------------------------ HEALTH */
    async health() {
      const { count: questions, error } = await db
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);
      if (error) throw new ApiError(503, `Supabase indisponível: ${error.message}`);
      const { count: users } = await db
        .from('users')
        .select('id', { count: 'exact', head: true });
      const { count: attempts } = await db
        .from('quiz_attempts')
        .select('id', { count: 'exact', head: true });
      const { count: answers } = await db
        .from('quiz_answers')
        .select('id', { count: 'exact', head: true });
      return {
        driver: 'supabase',
        ok: true,
        counts: { users: users ?? 0, questions: questions ?? 0, attempts: attempts ?? 0, answers: answers ?? 0 },
      };
    },

    /* -------------------------------------------------------------- USERS */
    async createUser({ name, nickname }) {
      const { data, error } = await db
        .from('users')
        .insert({ name, nickname })
        .select('*')
        .single();
      if (error) {
        if (/users_nickname_key|duplicate key/i.test(error.message)) {
          throw new ApiError(409, 'Este apelido já está em uso. Escolha outro.');
        }
        throw new ApiError(400, `Não foi possível criar o cadastro: ${error.message}`);
      }
      return data;
    },

    async getUserById(id) {
      const { data, error } = await db.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async getUserByNickname(nickname) {
      const { data, error } = await db
        .from('users')
        .select('*')
        .ilike('nickname', String(nickname).trim())
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async touchUser(id) {
      const { data, error } = await db
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) return null;
      return data;
    },

    async updateUser(id, patch) {
      const allowed = ['name', 'nickname', 'email', 'auth_id', 'role', 'share_profile'];
      const payload = Object.fromEntries(
        Object.entries(patch || {}).filter(([key]) => allowed.includes(key)),
      );
      if (!Object.keys(payload).length) return repo.getUserById(id);
      const { data, error } = await db
        .from('users')
        .update({ ...payload, last_seen_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        if (/users_nickname_key|duplicate key/i.test(error.message)) {
          throw new ApiError(409, 'Este apelido já está em uso.');
        }
        throw new ApiError(400, error.message);
      }
      return data;
    },

    async listUsers({ limit = 50, offset = 0, search = '' } = {}) {
      let query = db.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false });
      if (search?.trim()) {
        const term = search.trim().replace(/[%_]/g, '');
        query = query.or(`name.ilike.%${term}%,nickname.ilike.%${term}%`);
      }
      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) throw new ApiError(400, error.message);
      return { total: count ?? data.length, items: data ?? [] };
    },

    async deleteUser(id) {
      const { error } = await db.from('users').delete().eq('id', id);
      if (error) throw new ApiError(400, error.message);
      return true;
    },

    async anonymizeUser(id) {
      const { data, error } = await db
        .from('users')
        .update({
          name: 'Conta excluída',
          nickname: `jogador_${String(id).slice(0, 8)}`,
          email: null,
          auth_id: null,
          share_profile: false,
        })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return Boolean(data);
    },

    async setUserShareProfile(id, share) {
      const { data, error } = await db
        .from('users')
        .update({ share_profile: Boolean(share) })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async setRole(id, role) {
      const { data, error } = await db
        .from('users')
        .update({ role })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    /* ---------------------------------------------------------- QUESTIONS */
    async listActiveQuestions() {
      const { data, error } = await db
        .from('questions')
        .select('*')
        .eq('active', true)
        .order('order_index', { ascending: true })
        .order('chapter', { ascending: true });
      if (error) throw new ApiError(400, error.message);
      return data ?? [];
    },

    async listQuestions({ includeInactive = true } = {}) {
      let query = db.from('questions').select('*').order('order_index', { ascending: true });
      if (!includeInactive) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw new ApiError(400, error.message);
      return data ?? [];
    },

    async getQuestionById(id) {
      const { data, error } = await db.from('questions').select('*').eq('id', id).maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async createQuestion(payload) {
      const { data, error } = await db.from('questions').insert(payload).select('*').single();
      if (error) throw new ApiError(400, `Não foi possível criar a questão: ${error.message}`);
      return data;
    },

    async updateQuestion(id, patch) {
      const { data, error } = await db
        .from('questions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new ApiError(400, `Não foi possível atualizar a questão: ${error.message}`);
      return data;
    },

    async deleteQuestion(id) {
      const { count } = await db
        .from('quiz_answers')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', id);
      if (count) {
        await db.from('questions').update({ active: false }).eq('id', id);
        return 'deactivated';
      }
      const { error } = await db.from('questions').delete().eq('id', id);
      if (error) throw new ApiError(400, error.message);
      return true;
    },

    /* ----------------------------------------------------------- ATTEMPTS */
    async createAttempt(payload) {
      const { data, error } = await db
        .from('quiz_attempts')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new ApiError(400, `Não foi possível iniciar a partida: ${error.message}`);
      return data;
    },

    async getAttemptById(id) {
      const { data, error } = await db
        .from('quiz_attempts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async getActiveAttempt(userId) {
      const { data, error } = await db
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'STARTED')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async updateAttempt(id, patch) {
      const { data, error } = await db
        .from('quiz_attempts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        if (/já está encerrado/i.test(error.message)) {
          throw new ApiError(409, 'Esta partida já foi finalizada e não pode ser alterada.');
        }
        throw new ApiError(400, `Não foi possível atualizar a partida: ${error.message}`);
      }
      return data;
    },

    async abandonAttemptsOlderThan(cutoffIso) {
      const { error } = await db
        .from('quiz_attempts')
        .update({ status: 'ABANDONED', finished_at: new Date().toISOString() })
        .eq('status', 'STARTED')
        .lt('started_at', cutoffIso);
      if (error) return 0;
      return -1; // quantidade exata não é crítica aqui
    },

    async countAttemptsByUserSince(userId, status, sinceIso) {
      const { count, error } = await db
        .from('quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', status)
        .gte('created_at', sinceIso);
      if (error) throw new ApiError(400, error.message);
      return count ?? 0;
    },

    /* ------------------------------------------------------------ ANSWERS */
    async createAnswer(payload) {
      const { data, error } = await db.from('quiz_answers').insert(payload).select('*').single();
      if (error) {
        if (/answers_unique_per_question|duplicate key/i.test(error.message)) {
          const err = new ApiError(409, 'Esta questão já foi respondida nesta partida.');
          err.code = 'DUPLICATE_ANSWER';
          throw err;
        }
        if (/não é possível responder|ordem de resposta|fora da ordem/i.test(error.message)) {
          throw new ApiError(409, error.message.replace(/^.*?:\s*/, ''));
        }
        throw new ApiError(400, `Não foi possível registrar a resposta: ${error.message}`);
      }
      return data;
    },

    async getAnswer(attemptId, questionId) {
      const { data, error } = await db
        .from('quiz_answers')
        .select('*')
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId)
        .maybeSingle();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async listAnswersByAttempt(attemptId) {
      const { data, error } = await db
        .from('quiz_answers')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('position', { ascending: true });
      if (error) throw new ApiError(400, error.message);
      return data ?? [];
    },

    async lastAnswerOfAttempt(attemptId) {
      const { data, error } = await db
        .from('quiz_answers')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('answered_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },

    /* ------------------------------------------------------- ACHIEVEMENTS */
    async listAchievements() {
      const { data, error } = await db.from('achievements').select('*').order('created_at');
      if (error) throw new ApiError(400, error.message);
      return data ?? [];
    },

    async listUserAchievements(userId) {
      const { data, error } = await db
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });
      if (error) throw new ApiError(400, error.message);
      return (data ?? []).map((row) => ({ ...row, ...(row.achievements || {}) }));
    },

    async unlockAchievement({ userId, achievementId, attemptId = null }) {
      const { data, error } = await db
        .from('user_achievements')
        .insert({ user_id: userId, achievement_id: achievementId, attempt_id: attemptId })
        .select('*, achievements(*)')
        .single();
      if (error) {
        if (/user_achievements_unique|duplicate key/i.test(error.message)) return null;
        throw new ApiError(400, error.message);
      }
      return { ...data, ...(data.achievements || {}) };
    },

    /* -------------------------------------------------------- ADMIN TOKENS */
    async createAdminToken({ userId, tokenHash, expiresAt }) {
      const { data, error } = await db
        .from('admin_tokens')
        .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
        .select('*')
        .single();
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async getAdminTokenByHash(rawToken) {
      const hash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
      const { data, error } = await db
        .from('admin_tokens')
        .select('*')
        .eq('token_hash', hash)
        .maybeSingle();
      if (error) return null;
      return data;
    },

    /* -------------------------------------------------------------- AUDIT */
    async logAudit(entry) {
      await db.from('audit_log').insert(entry);
    },

    /* -------------------------------------------------------- LEADERBOARD */
    async leaderboard({ period = 'all', mode = 'all', limit = 100, offset = 0 } = {}) {
      const { data, error } = await db.rpc('leaderboard', {
        p_period: period,
        p_mode: mode,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw new ApiError(400, `Não foi possível carregar o ranking: ${error.message}`);
      return (data ?? []).map((row) => ({ ...row, rank: Number(row.rank) }));
    },

    async playerRank({ userId, period = 'all', mode = 'all' }) {
      const { data, error } = await db.rpc('player_rank', {
        p_user: userId,
        p_period: period,
        p_mode: mode,
      });
      if (error) throw new ApiError(400, error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        rank: Number(row?.rank ?? 0),
        total_players: Number(row?.total_players ?? 0),
        beaten_percentage: Number(row?.beaten_percentage ?? 0),
      };
    },

    /* -------------------------------------------------------------- STATS */
    async globalStats() {
      const { data, error } = await db.rpc('global_stats');
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async playerStats(userId) {
      const { data, error } = await db.rpc('player_stats', { p_user: userId });
      if (error) throw new ApiError(400, error.message);
      return data;
    },

    async listAttempts({ limit = 50, offset = 0, userId = null, status = null } = {}) {
      let query = db
        .from('quiz_attempts')
        .select('*, users(name, nickname)', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      if (status) query = query.eq('status', status);
      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) throw new ApiError(400, error.message);
      return {
        total: count ?? 0,
        items: (data ?? []).map((row) => ({
          ...row,
          name: row.users?.name ?? '—',
          nickname: row.users?.nickname ?? '—',
          users: undefined,
        })),
      };
    },

    async publicRecentAttempts({ limit = 30 } = {}) {
      const { data, error } = await db
        .from('quiz_attempts')
        .select('score, correct_answers, total_questions, percentage, finished_at, users(nickname, share_profile)')
        .eq('status', 'FINISHED')
        .order('finished_at', { ascending: false })
        .limit(limit * 2);
      if (error) throw new ApiError(400, error.message);
      return (data ?? [])
        .filter((row) => row.users?.share_profile !== false)
        .slice(0, limit)
        .map((row) => ({
          nickname: row.users.nickname,
          score: row.score,
          correct_answers: row.correct_answers,
          total_questions: row.total_questions,
          percentage: Number(row.percentage),
          finished_at: row.finished_at,
        }));
    },
  };

  return repo;
}

export default createSupabaseRepo;
