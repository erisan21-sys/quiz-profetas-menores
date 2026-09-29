import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Repositório LOCAL (em memória + persistência opcional em JSON).
 * ---------------------------------------------------------------------------
 * Implementa exatamente a mesma interface do repositório Supabase
 * (`supabaseRepo.js`), permitindo:
 *   • rodar o backend sem credenciais (DB_DRIVER=local)
 *   • executar toda a suíte de testes de integração sem banco externo
 *
 * Em produção usa-se DB_DRIVER=supabase. As regras de negócio vivem em
 * `services/` e são idênticas nos dois modos.
 */

const nowIso = () => new Date().toISOString();

function emptyState() {
  return {
    users: [],
    questions: [],
    quiz_attempts: [],
    quiz_answers: [],
    achievements: [],
    user_achievements: [],
    admin_tokens: [],
    audit_log: [],
  };
}

export function createLocalRepo({ file = null, seed = null } = {}) {
  const state = emptyState();
  if (seed) Object.assign(state, seed);

  let persistTimer = null;
  const persistPath = file ? path.resolve(file) : null;

  function load() {
    if (!persistPath) return;
    try {
      if (fs.existsSync(persistPath)) {
        const raw = JSON.parse(fs.readFileSync(persistPath, 'utf8'));
        Object.assign(state, emptyState(), raw);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[local-db] não foi possível ler ${persistPath}: ${err.message}`);
    }
  }

  function persist() {
    if (!persistPath) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(persistPath), { recursive: true });
        fs.writeFileSync(persistPath, JSON.stringify(state, null, 2));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[local-db] falha ao gravar: ${err.message}`);
      }
    }, 60);
  }

  load();

  /* ---------------------------------------------------------------- users */
  function findByNickname(nickname) {
    const key = String(nickname).trim().toLowerCase();
    return state.users.find((u) => u.nickname.toLowerCase() === key) || null;
  }

  /* ------------------------------------------------------------ leaderboard */
  function leaderboard({ period = 'all', mode = 'all', limit = 100, offset = 0 } = {}) {
    const start = periodStart(period);
    const filtered = state.quiz_attempts.filter((a) => {
      if (a.status !== 'FINISHED' || !(a.total_questions > 0)) return false;
      if (start && new Date(a.finished_at) < start) return false;
      if (mode !== 'all' && a.mode !== mode) return false;
      const user = state.users.find((u) => u.id === a.user_id);
      return Boolean(user) && user.share_profile !== false;
    });

    const byUser = new Map();
    for (const attempt of filtered) {
      const current = byUser.get(attempt.user_id);
      if (!current || better(attempt, current)) byUser.set(attempt.user_id, attempt);
    }

    const rows = [...byUser.values()]
      .map((best) => {
        const user = state.users.find((u) => u.id === best.user_id);
        const userAttempts = filtered.filter((a) => a.user_id === best.user_id);
        return {
          user_id: best.user_id,
          name: user.name,
          nickname: user.nickname,
          best_score: best.score,
          best_percentage: Number(best.percentage),
          best_correct: best.correct_answers,
          best_total: best.total_questions,
          attempts_count: userAttempts.length,
          total_correct: userAttempts.reduce((s, a) => s + a.correct_answers, 0),
          last_played_at: userAttempts
            .map((a) => a.finished_at)
            .sort()
            .at(-1),
        };
      })
      .sort(compareRows);

    return rows.map((row, index) => ({ rank: index + 1, ...row })).slice(offset, offset + limit);
  }

  function better(a, b) {
    if (a.score !== b.score) return a.score > b.score;
    if (Number(a.percentage) !== Number(b.percentage)) return Number(a.percentage) > Number(b.percentage);
    if (a.correct_answers !== b.correct_answers) return a.correct_answers > b.correct_answers;
    return new Date(a.finished_at) >= new Date(b.finished_at);
  }

  function compareRows(x, y) {
    if (y.best_score !== x.best_score) return y.best_score - x.best_score;
    if (y.best_percentage !== x.best_percentage) return y.best_percentage - x.best_percentage;
    if (y.best_correct !== x.best_correct) return y.best_correct - x.best_correct;
    return new Date(y.last_played_at) - new Date(x.last_played_at);
  }

  const repo = {
    driver: 'local',

    /* ------------------------------------------------------------ HEALTH */
    async health() {
      return {
        driver: 'local',
        ok: true,
        counts: {
          users: state.users.length,
          questions: state.questions.filter((q) => q.active !== false).length,
          attempts: state.quiz_attempts.length,
          answers: state.quiz_answers.length,
        },
      };
    },

    async ensureSeed(questions, achievements) {
      if (!state.questions.length && questions?.length) {
        state.questions.push(
          ...questions.map((q) => ({
            id: q.id || crypto.randomUUID(),
            active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
            source_type: 'texto_biblico',
            ...q,
          })),
        );
      }
      if (!state.achievements.length && achievements?.length) {
        state.achievements.push(
          ...achievements.map((a) => ({ id: crypto.randomUUID(), created_at: nowIso(), ...a })),
        );
      }
      persist();
      return { questions: state.questions.length, achievements: state.achievements.length };
    },

    /* ------------------------------------------------------------- USERS */
    async createUser({ name, nickname }) {
      const user = {
        id: crypto.randomUUID(),
        name,
        nickname,
        email: null,
        auth_id: null,
        role: 'player',
        share_profile: true,
        created_at: nowIso(),
        last_seen_at: nowIso(),
      };
      state.users.push(user);
      persist();
      return user;
    },

    async getUserById(id) {
      return state.users.find((u) => u.id === id) || null;
    },

    async getUserByNickname(nickname) {
      return findByNickname(nickname);
    },

    async touchUser(id) {
      const user = state.users.find((u) => u.id === id);
      if (user) {
        user.last_seen_at = nowIso();
        persist();
      }
      return user || null;
    },

    async updateUser(id, patch) {
      const user = state.users.find((u) => u.id === id);
      if (!user) return null;
      const allowed = ['name', 'nickname', 'email', 'auth_id', 'role', 'share_profile'];
      for (const key of allowed) {
        if (key in patch) user[key] = patch[key];
      }
      user.last_seen_at = nowIso();
      persist();
      return user;
    },

    async listUsers({ limit = 50, offset = 0, search = '' } = {}) {
      const term = search.trim().toLowerCase();
      const rows = state.users
        .filter((u) => !term || u.name.toLowerCase().includes(term) || u.nickname.toLowerCase().includes(term))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { total: rows.length, items: rows.slice(offset, offset + limit) };
    },

    async deleteUser(id) {
      const index = state.users.findIndex((u) => u.id === id);
      if (index === -1) return false;
      state.quiz_answers = state.quiz_answers.filter((a) => a.user_id !== id);
      state.quiz_attempts = state.quiz_attempts.filter((a) => a.user_id !== id);
      state.user_achievements = state.user_achievements.filter((a) => a.user_id !== id);
      state.admin_tokens = state.admin_tokens.filter((a) => a.user_id !== id);
      state.audit_log = state.audit_log.filter((a) => a.user_id !== id);
      state.users.splice(index, 1);
      persist();
      return true;
    },

    async anonymizeUser(id) {
      const user = state.users.find((u) => u.id === id);
      if (!user) return false;
      user.name = 'Conta excluída';
      user.nickname = `jogador_${String(id).slice(0, 8)}`;
      user.email = null;
      user.auth_id = null;
      user.share_profile = false;
      user.deleted_at = nowIso();
      persist();
      return true;
    },

    async setUserShareProfile(id, share) {
      const user = state.users.find((u) => u.id === id);
      if (!user) return null;
      user.share_profile = Boolean(share);
      persist();
      return user;
    },

    async setRole(id, role) {
      const user = state.users.find((u) => u.id === id);
      if (!user) return null;
      user.role = role;
      persist();
      return user;
    },

    /* ---------------------------------------------------------- QUESTIONS */
    async listActiveQuestions() {
      return state.questions
        .filter((q) => q.active !== false)
        .map((q) => ({ ...q }))
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.chapter - b.chapter);
    },

    async listQuestions({ includeInactive = true } = {}) {
      return state.questions
        .filter((q) => includeInactive || q.active !== false)
        .map((q) => ({ ...q }))
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    },

    async getQuestionById(id) {
      return state.questions.find((q) => q.id === id) || null;
    },

    async createQuestion(data) {
      const question = {
        id: crypto.randomUUID(),
        active: true,
        order_index: state.questions.length + 1,
        created_at: nowIso(),
        updated_at: nowIso(),
        ...data,
      };
      state.questions.push(question);
      persist();
      return question;
    },

    async updateQuestion(id, patch) {
      const question = state.questions.find((q) => q.id === id);
      if (!question) return null;
      Object.assign(question, patch, { updated_at: nowIso() });
      persist();
      return question;
    },

    async deleteQuestion(id) {
      const index = state.questions.findIndex((q) => q.id === id);
      if (index === -1) return false;
      const used = state.quiz_answers.some((a) => a.question_id === id);
      if (used) {
        state.questions[index].active = false;
        state.questions[index].updated_at = nowIso();
        persist();
        return 'deactivated';
      }
      state.questions.splice(index, 1);
      persist();
      return true;
    },

    /* ---------------------------------------------------------- ATTEMPTS */
    async createAttempt(attempt) {
      const row = {
        id: crypto.randomUUID(),
        status: 'STARTED',
        mode: 'mixed',
        difficulty: 'mixed',
        score: 0,
        base_score: 0,
        bonus_score: 0,
        correct_answers: 0,
        wrong_answers: 0,
        answered_count: 0,
        percentage: 0,
        duration_seconds: null,
        question_order: [],
        started_at: nowIso(),
        finished_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        total_questions: 0,
        ...attempt,
      };
      state.quiz_attempts.push(row);
      persist();
      return row;
    },

    async getAttemptById(id) {
      return state.quiz_attempts.find((a) => a.id === id) || null;
    },

    async getActiveAttempt(userId) {
      return (
        state.quiz_attempts.find((a) => a.user_id === userId && a.status === 'STARTED') || null
      );
    },

    async updateAttempt(id, patch) {
      const attempt = state.quiz_attempts.find((a) => a.id === id);
      if (!attempt) return null;
      if (['FINISHED', 'ABANDONED'].includes(attempt.status)) {
        const guarded = [
          'status', 'score', 'base_score', 'bonus_score', 'correct_answers',
          'wrong_answers', 'percentage', 'duration_seconds', 'answered_count',
        ];
        const touched = guarded.filter((key) => key in patch && patch[key] !== attempt[key]);
        if (touched.length) {
          throw new Error(`Partida ${id} já está encerrada e não pode ser alterada (${touched.join(', ')}).`);
        }
      }
      Object.assign(attempt, patch, { updated_at: nowIso() });
      persist();
      return attempt;
    },

    async abandonAttemptsOlderThan(cutoffIso) {
      const cutoff = new Date(cutoffIso).getTime();
      let count = 0;
      for (const attempt of state.quiz_attempts) {
        if (attempt.status === 'STARTED' && new Date(attempt.started_at).getTime() < cutoff) {
          attempt.status = 'ABANDONED';
          attempt.finished_at = nowIso();
          attempt.duration_seconds = Math.max(
            0,
            Math.round((new Date(attempt.finished_at) - new Date(attempt.started_at)) / 1000),
          );
          attempt.updated_at = nowIso();
          count += 1;
        }
      }
      if (count) persist();
      return count;
    },

    async countAttemptsByUserSince(userId, status, sinceIso) {
      const since = new Date(sinceIso).getTime();
      return state.quiz_attempts.filter(
        (a) => a.user_id === userId && a.status === status && new Date(a.created_at).getTime() >= since,
      ).length;
    },

    /* ----------------------------------------------------------- ANSWERS */
    async createAnswer(answer) {
      const duplicated = state.quiz_answers.some(
        (a) => a.attempt_id === answer.attempt_id && a.question_id === answer.question_id,
      );
      if (duplicated) {
        const err = new Error('duplicate_answer');
        err.code = 'DUPLICATE_ANSWER';
        throw err;
      }
      const row = {
        id: crypto.randomUUID(),
        points: 0,
        time_spent_ms: 0,
        used_hint: false,
        answered_at: nowIso(),
        ...answer,
      };
      state.quiz_answers.push(row);
      persist();
      return row;
    },

    async getAnswer(attemptId, questionId) {
      return (
        state.quiz_answers.find(
          (a) => a.attempt_id === attemptId && a.question_id === questionId,
        ) || null
      );
    },

    async listAnswersByAttempt(attemptId) {
      return state.quiz_answers
        .filter((a) => a.attempt_id === attemptId)
        .map((a) => ({ ...a }))
        .sort((x, y) => x.position - y.position);
    },

    async lastAnswerOfAttempt(attemptId) {
      const answers = await repo.listAnswersByAttempt(attemptId);
      return answers.length ? answers[answers.length - 1] : null;
    },

    /* ------------------------------------------------------- ACHIEVEMENTS */
    async listAchievements() {
      return state.achievements.map((a) => ({ ...a }));
    },

    async listUserAchievements(userId) {
      return state.user_achievements
        .filter((ua) => ua.user_id === userId)
        .map((ua) => {
          const achievement = state.achievements.find((a) => a.id === ua.achievement_id);
          return { ...ua, ...(achievement || {}) };
        })
        .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at));
    },

    async unlockAchievement({ userId, achievementId, attemptId = null }) {
      const exists = state.user_achievements.some(
        (ua) => ua.user_id === userId && ua.achievement_id === achievementId,
      );
      if (exists) return null;
      const row = {
        id: crypto.randomUUID(),
        user_id: userId,
        achievement_id: achievementId,
        attempt_id: attemptId,
        unlocked_at: nowIso(),
      };
      state.user_achievements.push(row);
      persist();
      const achievement = state.achievements.find((a) => a.id === achievementId);
      return { ...row, ...(achievement || {}) };
    },

    /* -------------------------------------------------------- ADMIN TOKENS */
    async createAdminToken({ userId, tokenHash, expiresAt }) {
      const row = {
        id: crypto.randomUUID(),
        user_id: userId,
        token_hash: tokenHash,
        created_at: nowIso(),
        expires_at: expiresAt,
        revoked_at: null,
      };
      state.admin_tokens.push(row);
      persist();
      return row;
    },

    async getAdminTokenByHash(rawToken) {
      const hash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
      return state.admin_tokens.find((t) => t.token_hash === hash) || null;
    },

    /* ------------------------------------------------------------ AUDIT */
    async logAudit(entry) {
      state.audit_log.push({ id: state.audit_log.length + 1, created_at: nowIso(), ...entry });
      persist();
    },

    /* ------------------------------------------------------ LEADERBOARD */
    async leaderboard(params) {
      return leaderboard(params);
    },

    async playerRank({ userId, period = 'all', mode = 'all' }) {
      const rows = leaderboard({ period, mode, limit: 500, offset: 0 });
      const me = rows.find((row) => row.user_id === userId);
      const total = rows.length;
      if (!me) return { rank: 0, total_players: total, beaten_percentage: 0 };
      const beaten = total <= 1 ? 100 : Math.round(((total - me.rank) / (total - 1)) * 1000) / 10;
      return { rank: me.rank, total_players: total, beaten_percentage: beaten };
    },

    /* ----------------------------------------------------------- STATS */
    async globalStats() {
      const finished = state.quiz_attempts.filter((a) => a.status === 'FINISHED');
      const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);

      const perQuestion = new Map();
      for (const answer of state.quiz_answers) {
        const entry = perQuestion.get(answer.question_id) || { correct: 0, wrong: 0 };
        if (answer.is_correct) entry.correct += 1;
        else entry.wrong += 1;
        perQuestion.set(answer.question_id, entry);
      }

      const questionStats = [...perQuestion.entries()].map(([questionId, s]) => {
        const question = state.questions.find((q) => q.id === questionId);
        const totalAnswers = s.correct + s.wrong;
        return {
          question_id: questionId,
          text: question ? question.question : '(questão removida)',
          chapter: question ? question.chapter : null,
          correct: s.correct,
          wrong: s.wrong,
          accuracy: totalAnswers ? Math.round((s.correct / totalAnswers) * 1000) / 10 : 0,
        };
      });

      return {
        total_players: state.users.length,
        total_attempts: finished.length,
        total_answers: state.quiz_answers.length,
        total_questions: state.questions.filter((q) => q.active !== false).length,
        best_score: finished.length ? Math.max(...finished.map((a) => a.score)) : 0,
        best_percentage: finished.length ? Math.max(...finished.map((a) => Number(a.percentage))) : 0,
        avg_score: Math.round(avg(finished.map((a) => a.score))),
        avg_correct: Math.round(avg(finished.map((a) => a.correct_answers)) * 10) / 10,
        avg_percentage: Math.round(avg(finished.map((a) => Number(a.percentage))) * 10) / 10,
        most_correct_question: [...questionStats].sort((a, b) => b.accuracy - a.accuracy).slice(0, 5),
        most_wrong_question: [...questionStats].sort((a, b) => b.wrong - a.wrong).slice(0, 5),
      };
    },

    async playerStats(userId) {
      const finished = state.quiz_attempts.filter(
        (a) => a.user_id === userId && a.status === 'FINISHED',
      );
      const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
      return {
        attempts: finished.length,
        total_correct: finished.reduce((s, a) => s + a.correct_answers, 0),
        total_wrong: finished.reduce((s, a) => s + a.wrong_answers, 0),
        best_score: finished.length ? Math.max(...finished.map((a) => a.score)) : 0,
        best_percentage: finished.length ? Math.max(...finished.map((a) => Number(a.percentage))) : 0,
        avg_score: Math.round(avg(finished.map((a) => a.score))),
        avg_correct: Math.round(avg(finished.map((a) => a.correct_answers)) * 10) / 10,
        total_duration: finished.reduce((s, a) => s + (a.duration_seconds || 0), 0),
        last_attempt_at: finished.length
          ? finished.map((a) => a.finished_at).sort().at(-1)
          : null,
        evolution: [...finished]
          .sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
          .slice(-30)
          .map((a) => ({
            date: new Date(a.finished_at).toLocaleDateString('pt-BR'),
            score: a.score,
            percentage: Number(a.percentage),
            correct: a.correct_answers,
            total: a.total_questions,
          })),
      };
    },

    async listAttempts({ limit = 50, offset = 0, userId = null, status = null } = {}) {
      let rows = [...state.quiz_attempts];
      if (userId) rows = rows.filter((a) => a.user_id === userId);
      if (status) rows = rows.filter((a) => a.status === status);
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const items = rows.slice(offset, offset + limit).map((attempt) => {
        const user = state.users.find((u) => u.id === attempt.user_id);
        return { ...attempt, name: user?.name || '—', nickname: user?.nickname || '—' };
      });
      return { total: rows.length, items };
    },

    async publicRecentAttempts({ limit = 30 } = {}) {
      return state.quiz_attempts
        .filter((a) => a.status === 'FINISHED')
        .filter((a) => {
          const user = state.users.find((u) => u.id === a.user_id);
          return Boolean(user) && user.share_profile !== false;
        })
        .sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))
        .slice(0, limit)
        .map((a) => {
          const user = state.users.find((u) => u.id === a.user_id);
          return {
            nickname: user.nickname,
            score: a.score,
            correct_answers: a.correct_answers,
            total_questions: a.total_questions,
            percentage: Number(a.percentage),
            finished_at: a.finished_at,
          };
        });
    },

    /* apenas para testes/inspeção */
    _state: state,
    _reset() {
      Object.assign(state, emptyState());
      persist();
    },
  };

  return repo;
}

function periodStart(period) {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    const day = (now.getDay() + 6) % 7; // semana começa na segunda
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - day);
    return start;
  }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

export default createLocalRepo;
