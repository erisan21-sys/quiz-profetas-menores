import { toPercentage } from '../utils/rules.js';

/**
 * Serviço de conquistas (v1.1 do roadmap, já incluído na v1.0).
 * ---------------------------------------------------------------------------
 * As conquistas são avaliadas SEMPRE no servidor, ao final de cada partida.
 * Os critérios ficam armazenados no banco (tabela achievements.criteria), o que
 * permite criar novas conquistas sem alterar código.
 */

export function createAchievementService(repo) {
  async function evaluate({ userId, attempt, attemptId = attempt?.id }) {
    const catalog = await repo.listAchievements();
    if (!catalog.length) return [];

    const already = await repo.listUserAchievements(userId);
    const owned = new Set(already.map((a) => a.code));
    const pending = catalog.filter((a) => !owned.has(a.code));
    if (!pending.length) return [];

    const stats = await repo.playerStats(userId);
    const rankInfo = await repo
      .playerRank({ userId, period: 'all', mode: 'all' })
      .catch(() => ({ rank: 0, total_players: 0, beaten_percentage: 0 }));

    const accuracy = toPercentage(stats.total_correct, stats.total_correct + stats.total_wrong);
    const context = {
      userId,
      attempt,
      stats,
      rank: rankInfo.rank,
      accuracy,
      correctTotal: stats.total_correct,
    };

    const unlocked = [];
    for (const achievement of pending) {
      if (isUnlocked(achievement.criteria || {}, context)) {
        const row = await repo.unlockAchievement({
          userId,
          achievementId: achievement.id,
          attemptId,
        });
        if (row) unlocked.push({ ...achievement, unlocked_at: row.unlocked_at });
      }
    }
    return unlocked;
  }

  async function listFor(userId) {
    const [catalog, owned] = await Promise.all([
      repo.listAchievements(),
      repo.listUserAchievements(userId),
    ]);
    const ownedByCode = new Map(owned.map((o) => [o.code, o]));
    return catalog.map((a) => {
      const got = ownedByCode.get(a.code);
      return {
        code: a.code,
        name: a.name,
        icon: a.icon,
        description: a.description,
        unlocked: Boolean(got),
        unlocked_at: got?.unlocked_at ?? null,
      };
    });
  }

  return { evaluate, listFor };
}

/** Regras de desbloqueio por tipo de critério. */
export function isUnlocked(criteria, ctx) {
  switch (criteria.type) {
    case 'attempts_count':
      return (ctx.stats?.attempts ?? 0) >= Number(criteria.value ?? 1);

    case 'perfect_attempt':
      return (
        ctx.attempt?.status === 'FINISHED' &&
        ctx.attempt?.total_questions > 0 &&
        ctx.attempt?.correct_answers === ctx.attempt?.total_questions
      );

    case 'leaderboard_position':
      return ctx.rank > 0 && ctx.rank <= Number(criteria.value ?? 10);

    case 'accuracy': {
      const min = Number(criteria.min_percentage ?? 90);
      const attempts = Number(criteria.min_attempts ?? 1);
      return (ctx.stats?.attempts ?? 0) >= attempts && (ctx.accuracy ?? 0) >= min;
    }

    case 'expert': {
      const correctNeeded = Number(criteria.correct ?? 100);
      const accuracyNeeded = Number(criteria.min_accuracy ?? 85);
      return (ctx.correctTotal ?? 0) >= correctNeeded && (ctx.accuracy ?? 0) >= accuracyNeeded;
    }

    default:
      return false;
  }
}

export default createAchievementService;
