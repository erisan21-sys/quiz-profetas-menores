import {
  ApiError,
  DIFFICULTIES,
  MIXED_DISTRIBUTION,
  STATUS,
  computeResult,
  formatDuration,
  formatScore,
  isUuid,
  normalizeLetter,
  normalizeMode,
  pointsFor,
  serverDurationSeconds,
  toPercentage,
} from '../utils/rules.js';

/**
 * Serviço de jogo — AUTORIDADE OFICIAL de pontuação.
 * ---------------------------------------------------------------------------
 * Todo o cálculo de acerto, pontos, bônus, percentual e duração acontece aqui,
 * no servidor. O navegador envia apenas: attempt_id, question_id,
 * selected_answer. Nunca recebe o gabarito antes de responder.
 */

/* -------------------------------------------------------------------------- */
/* Visões públicas                                                             */
/* -------------------------------------------------------------------------- */

/** Remove o gabarito e a explicação: é o que o navegador pode ver ANTES. */
export function publicQuestion(question, position) {
  return {
    id: question.id,
    position,
    book: question.book,
    book_name: question.book_name,
    chapter: question.chapter,
    difficulty: question.difficulty,
    source_type: question.source_type || 'texto_biblico',
    question: question.question,
    options: [
      { letter: 'A', text: question.option_a },
      { letter: 'B', text: question.option_b },
      { letter: 'C', text: question.option_c },
      { letter: 'D', text: question.option_d },
    ],
    hint: question.hint,
    points: pointsFor(question.difficulty, true),
  };
}

/** Devolve o gabarito de uma questão (usado só depois que o jogador responde). */
export function questionReveal(question) {
  return {
    id: question.id,
    correct_answer: question.correct_answer,
    correct_text: question[`option_${question.correct_answer.toLowerCase()}`],
    explanation: question.explanation,
    source_type: question.source_type || 'texto_biblico',
    difficulty: question.difficulty,
    points: pointsFor(question.difficulty, true),
  };
}

/** Resumo de partida usado no histórico e no ranking. */
export function attemptSummary(attempt, extra = {}) {
  const duration = attempt.duration_seconds ?? null;
  return {
    id: attempt.id,
    user_id: attempt.user_id,
    status: attempt.status,
    mode: attempt.mode,
    prophet: attempt.prophet || 'todos',
    difficulty: attempt.difficulty,
    score: attempt.score,
    base_score: attempt.base_score,
    bonus_score: attempt.bonus_score,
    correct_answers: attempt.correct_answers,
    wrong_answers: attempt.wrong_answers,
    answered_count: attempt.answered_count ?? attempt.correct_answers + attempt.wrong_answers,
    total_questions: attempt.total_questions,
    percentage: Number(attempt.percentage),
    duration_seconds: duration,
    duration_label: duration === null ? '—' : formatDuration(duration),
    score_label: formatScore(attempt.score),
    started_at: attempt.started_at,
    finished_at: attempt.finished_at,
    created_at: attempt.created_at,
    date_label: new Date(attempt.finished_at || attempt.created_at).toLocaleDateString('pt-BR'),
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Seleção de questões                                                         */
/* -------------------------------------------------------------------------- */

/** Fisher–Yates com função de aleatoriedade injetável (testes determinísticos). */
export function shuffle(list, random = Math.random) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Monta o conjunto de questões da partida.
 *  mixed   -> 6 fáceis + 8 médias + 6 difíceis = 20 questões
 *  facil/medio/dificil -> todas as questões daquele nível (máx. 20)
 */
export function selectQuestions(
  allQuestions,
  mode = 'mixed',
  size = 20,
  random = Math.random,
  distribution = MIXED_DISTRIBUTION,
  prophet = null,
) {
  const active = allQuestions.filter((q) => q.active !== false && (!prophet || prophet === 'todos' || q.book === prophet));
  if (mode === 'mixed') {
    const picked = [];
    for (const difficulty of DIFFICULTIES) {
      const pool = shuffle(active.filter((q) => q.difficulty === difficulty), random);
      const wanted = distribution[difficulty];
      if (pool.length < wanted) {
        throw new ApiError(
          500,
          `Banco incompleto: são necessárias ${wanted} questões "${difficulty}" e existem ${pool.length}.`,
        );
      }
      picked.push(...pool.slice(0, wanted));
    }
    return shuffle(picked, random);
  }

  const pool = shuffle(active.filter((q) => q.difficulty === mode), random);
  if (!pool.length) {
    throw new ApiError(500, `Nenhuma questão ativa cadastrada para a dificuldade "${mode}".`);
  }
  return pool.slice(0, size);
}

/* -------------------------------------------------------------------------- */
/* Início de partida                                                           */
/* -------------------------------------------------------------------------- */

export async function startAttempt({
  repo,
  userId,
  mode = 'mixed',
  quizSize = 20,
  ttlSeconds = 14400,
  prophet = null,
  random = Math.random,
  now = () => new Date(),
}) {
  const selectedMode = normalizeMode(mode);
  if (!selectedMode) throw new ApiError(400, 'Modo de jogo inválido. Use mixed, facil, medio ou dificil.');

  const active = await repo.getActiveAttempt(userId);
  if (active) {
    const ageSeconds = (now() - new Date(active.started_at)) / 1000;
    if (ageSeconds <= ttlSeconds) {
      const questions = await loadAttemptQuestions(repo, active);
      const answered = await repo.listAnswersByAttempt(active.id);
      const answeredIds = new Set(answered.map((a) => a.question_id));
      const nextIndex = questions.findIndex((q) => !answeredIds.has(q.id));
      return {
        resumed: true,
        attempt: attemptSummary(active, {
          answered_positions: answered.map((a) => a.position),
          next_position: nextIndex === -1 ? questions.length + 1 : nextIndex + 1,
        }),
        questions: questions.map((q, index) => publicQuestion(q, index + 1)),
      };
    }
    await repo.updateAttempt(active.id, {
      status: STATUS.ABANDONED,
      finished_at: now().toISOString(),
      duration_seconds: serverDurationSeconds(active.started_at, now()),
    });
  }

  // Limpeza de partidas esquecidas (melhora o ranking e libera o slot do jogador)
  const cutoff = new Date(now().getTime() - ttlSeconds * 1000).toISOString();
  await repo.abandonAttemptsOlderThan(cutoff).catch(() => {});

  // Proteção contra criação excessiva de partidas abandonadas
  const since = new Date(now().getTime() - 6 * 60 * 60 * 1000).toISOString();
  const abandoned = await repo
    .countAttemptsByUserSince(userId, STATUS.ABANDONED, since)
    .catch(() => 0);
  if (abandoned >= 15) {
    throw new ApiError(429, 'Muitas partidas abandonadas nas últimas horas. Aguarde antes de começar outra.');
  }

  const allQuestions = await repo.listActiveQuestions();
  const selectedProphet = prophet && prophet !== 'todos' ? String(prophet) : null;
  const prophetDistribution = { facil: 2, medio: 2, dificil: 1 };
  const questions = selectQuestions(
    allQuestions, selectedMode, selectedProphet ? 5 : quizSize, random,
    selectedProphet ? prophetDistribution : MIXED_DISTRIBUTION, selectedProphet,
  );
  if (!questions.length) throw new ApiError(500, 'Nenhuma questão disponível no momento.');

  const startedAt = now();
  const attempt = await repo.createAttempt({
    user_id: userId,
    status: STATUS.STARTED,
    mode: selectedMode,
    difficulty: selectedMode,
    prophet: selectedProphet || 'todos',
    total_questions: questions.length,
    answered_count: 0,
    question_order: questions.map((q) => q.id),
    started_at: startedAt.toISOString(),
  });

  await repo
    .logAudit({ user_id: userId, attempt_id: attempt.id, action: 'ATTEMPT_STARTED', detail: { mode: selectedMode, total: questions.length } })
    .catch(() => {});

  return {
    resumed: false,
    attempt: attemptSummary(attempt, { next_position: 1 }),
    questions: questions.map((q, index) => publicQuestion(q, index + 1)),
  };
}

async function loadAttemptQuestions(repo, attempt) {
  const order = Array.isArray(attempt.question_order) ? attempt.question_order : [];
  const all = await repo.listActiveQuestions();
  const byId = new Map(all.map((q) => [q.id, q]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean);
  if (ordered.length === order.length) return ordered;

  // fallback (banco recriado): reconstrói a ordem pelas respostas já gravadas
  const answers = await repo.listAnswersByAttempt(attempt.id);
  const answered = answers.map((a) => byId.get(a.question_id)).filter(Boolean);
  const rest = all.filter((q) => !answers.some((a) => a.question_id === q.id));
  return [...answered, ...rest].slice(0, attempt.total_questions || all.length);
}

/* -------------------------------------------------------------------------- */
/* Resposta                                                                    */
/* -------------------------------------------------------------------------- */

export async function answerQuestion({
  repo,
  userId,
  attemptId,
  questionId,
  selectedAnswer,
  minIntervalMs = 1200,
  now = () => new Date(),
}) {
  if (!isUuid(attemptId)) throw new ApiError(400, 'ID de partida inválido.');
  if (!isUuid(questionId)) throw new ApiError(400, 'ID de questão inválido.');

  const letter = normalizeLetter(selectedAnswer);
  if (!letter) {
    throw new ApiError(400, 'Resposta inválida. Envie A, B, C ou D.');
  }

  const attempt = await repo.getAttemptById(attemptId);
  if (!attempt) throw new ApiError(404, 'Partida não encontrada.');
  if (attempt.user_id !== userId) {
    await repo.logAudit({
      user_id: userId, attempt_id: attemptId, action: 'FRAUD_OWNER_MISMATCH',
      detail: { owner: attempt.user_id, question_id: questionId },
    }).catch(() => {});
    throw new ApiError(403, 'Esta partida pertence a outro jogador.');
  }
  if (attempt.status !== STATUS.STARTED) {
    throw new ApiError(409, `Partida encerrada (status ${attempt.status}). Inicie uma nova partida.`);
  }

  const order = Array.isArray(attempt.question_order) ? attempt.question_order : [];
  const expectedPosition = (attempt.answered_count ?? 0) + 1;

  const position = order.indexOf(questionId) + 1;
  if (position === 0) {
    await repo.logAudit({
      user_id: userId, attempt_id: attemptId, action: 'FRAUD_QUESTION_NOT_IN_ATTEMPT',
      detail: { question_id: questionId },
    }).catch(() => {});
    throw new ApiError(400, 'Esta questão não faz parte da partida.');
  }

  // Duplicidade é verificada antes da ordem para devolver a mensagem correta
  // (a constraint unique(attempt_id, question_id) do banco é a garantia final).
  const already = await repo.getAnswer(attemptId, questionId);
  if (already) {
    await repo.logAudit({
      user_id: userId, attempt_id: attemptId, action: 'DUPLICATE_ANSWER_BLOCKED',
      detail: { question_id: questionId, position },
    }).catch(() => {});
    throw new ApiError(409, 'Esta questão já foi respondida nesta partida.');
  }

  if (expectedPosition > attempt.total_questions) {
    throw new ApiError(409, 'Todas as questões desta partida já foram respondidas. Finalize a partida.');
  }

  if (position !== expectedPosition) {
    await repo.logAudit({
      user_id: userId, attempt_id: attemptId, action: 'FRAUD_ORDER_VIOLATION',
      detail: { question_id: questionId, position, expected_position: expectedPosition },
    }).catch(() => {});
    throw new ApiError(409, `As questões devem ser respondidas em ordem. A questão da vez é a ${expectedPosition} de ${attempt.total_questions}.`);
  }

  // Cadência mínima: bloqueia respostas automatizadas / macro
  const answers = await repo.listAnswersByAttempt(attemptId);
  const lastAt = answers.length
    ? new Date(answers[answers.length - 1].answered_at).getTime()
    : new Date(attempt.started_at).getTime();
  const elapsed = now().getTime() - lastAt;
  if (minIntervalMs > 0 && elapsed < minIntervalMs) {
    throw new ApiError(
      429,
      `Respostas rápidas demais. Aguarde ${Math.ceil((minIntervalMs - elapsed) / 1000)}s.`,
      { retry_after_ms: minIntervalMs - elapsed },
    );
  }

  const question = await repo.getQuestionById(questionId);
  if (!question) throw new ApiError(404, 'Questão não encontrada.');
  if (question.active === false) throw new ApiError(409, 'Esta questão foi desativada.');

  // ==== CÁLCULO OFICIAL (servidor) ====
  const isCorrect = question.correct_answer === letter;
  const points = pointsFor(question.difficulty, isCorrect);

  let answer;
  try {
    answer = await repo.createAnswer({
      attempt_id: attemptId,
      question_id: questionId,
      user_id: userId,
      selected_answer: letter,
      is_correct: isCorrect,
      points,
      position,
      time_spent_ms: Math.max(0, Math.min(elapsed, 600000)),
      used_hint: false,
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_ANSWER' || /já foi respondida/i.test(err.message || '')) {
      throw new ApiError(409, 'Esta questão já foi respondida nesta partida.');
    }
    throw err;
  }

  const correctAnswers = (attempt.correct_answers ?? 0) + (isCorrect ? 1 : 0);
  const wrongAnswers = (attempt.wrong_answers ?? 0) + (isCorrect ? 0 : 1);
  const baseScore = (attempt.base_score ?? 0) + points;

  await repo.updateAttempt(attemptId, {
    answered_count: position,
    correct_answers: correctAnswers,
    wrong_answers: wrongAnswers,
    base_score: baseScore,
    score: baseScore,
    percentage: toPercentage(correctAnswers, position),
  });

  await repo
    .logAudit({
      user_id: userId, attempt_id: attemptId, action: 'ANSWER_RECORDED',
      detail: { question_id: questionId, position, is_correct: isCorrect, points },
    })
    .catch(() => {});

  return {
    answer_id: answer.id,
    position,
    total_questions: attempt.total_questions,
    is_correct: isCorrect,
    points_earned: points,
    selected_answer: letter,
    progress: {
      answered: position,
      total: attempt.total_questions,
      correct: correctAnswers,
      wrong: wrongAnswers,
      score: baseScore,
      percentage: toPercentage(correctAnswers, position),
    },
    reveal: questionReveal(question),
  };
}

/* -------------------------------------------------------------------------- */
/* Finalização                                                                 */
/* -------------------------------------------------------------------------- */

export async function finishAttempt({
  repo,
  userId,
  attemptId,
  maxDurationSeconds = 7200,
  achievements = null,
  now = () => new Date(),
}) {
  if (!isUuid(attemptId)) throw new ApiError(400, 'ID de partida inválido.');

  const attempt = await repo.getAttemptById(attemptId);
  if (!attempt) throw new ApiError(404, 'Partida não encontrada.');
  if (attempt.user_id !== userId) {
    await repo.logAudit({ user_id: userId, attempt_id: attemptId, action: 'FRAUD_FINISH_MISMATCH' }).catch(() => {});
    throw new ApiError(403, 'Esta partida pertence a outro jogador.');
  }

  const answers = await repo.listAnswersByAttempt(attemptId);
  const questions = await loadAttemptQuestions(repo, attempt);
  const questionById = new Map(questions.map((q) => [q.id, q]));

  if (attempt.status === STATUS.FINISHED) {
    return buildFinishedResponse({ repo, attempt, answers, questionById, achievements, now, alreadyFinished: true });
  }

  if (!answers.length) {
    await repo.updateAttempt(attemptId, {
      status: STATUS.ABANDONED,
      finished_at: now().toISOString(),
      duration_seconds: serverDurationSeconds(attempt.started_at, now(), maxDurationSeconds),
    });
    throw new ApiError(409, 'Nenhuma questão foi respondida: a partida foi marcada como abandonada.');
  }

  // ==== CÁLCULO OFICIAL DO RESULTADO (servidor) ====
  const enriched = answers.map((a) => ({
    ...a,
    difficulty: questionById.get(a.question_id)?.difficulty || 'facil',
  }));
  const result = computeResult(enriched);
  const finishedAt = now();
  const duration = serverDurationSeconds(attempt.started_at, finishedAt, maxDurationSeconds);

  const saved = await repo.updateAttempt(attemptId, {
    status: STATUS.FINISHED,
    finished_at: finishedAt.toISOString(),
    duration_seconds: duration,
    score: result.score,
    base_score: result.base_score,
    bonus_score: result.bonus_score,
    correct_answers: result.correct_answers,
    wrong_answers: result.wrong_answers,
    answered_count: result.answered_count,
    total_questions: attempt.total_questions,
    percentage: result.percentage,
  });

  await repo
    .logAudit({
      user_id: userId, attempt_id: attemptId, action: 'ATTEMPT_FINISHED',
      detail: { score: result.score, percentage: result.percentage, duration },
    })
    .catch(() => {});

  return buildFinishedResponse({ repo, attempt: saved, answers, questionById, achievements, now, alreadyFinished: false });
}

async function buildFinishedResponse({ repo, attempt, answers, questionById, achievements, now, alreadyFinished }) {
  const user = await repo.getUserById(attempt.user_id);
  const rankInfo = await repo
    .playerRank({ userId: attempt.user_id, period: 'all', mode: 'all' })
    .catch(() => ({ rank: 0, total_players: 0, beaten_percentage: 0 }));

  let unlocked = [];
  if (achievements && !alreadyFinished) {
    unlocked = await achievements
      .evaluate({ userId: attempt.user_id, attempt, attemptId: attempt.id })
      .catch(() => []);
  }

  const allAchievements = await repo.listAchievements().catch(() => []);
  const userAchievements = await repo.listUserAchievements(attempt.user_id).catch(() => []);
  const unlockedCodes = new Set(userAchievements.map((ua) => ua.code));

  const review = [...answers]
    .sort((a, b) => a.position - b.position)
    .map((answer) => {
      const question = questionById.get(answer.question_id);
      return {
        position: answer.position,
        question_id: answer.question_id,
        chapter: question?.chapter ?? null,
        question: question?.question ?? '(questão indisponível)',
        difficulty: question?.difficulty ?? 'facil',
        options: question
          ? [
              { letter: 'A', text: question.option_a },
              { letter: 'B', text: question.option_b },
              { letter: 'C', text: question.option_c },
              { letter: 'D', text: question.option_d },
            ]
          : [],
        selected_answer: answer.selected_answer,
        correct_answer: question?.correct_answer ?? null,
        is_correct: answer.is_correct,
        points: answer.points,
        explanation: question?.explanation ?? '',
        source_type: question?.source_type ?? 'texto_biblico',
      };
    });

  const summary = attemptSummary(attempt, {
    nickname: user?.nickname ?? '—',
    name: user?.name ?? '—',
    rank: rankInfo.rank,
    total_players: rankInfo.total_players,
    beaten_percentage: rankInfo.beaten_percentage,
    position_label: rankInfo.rank ? `${rankInfo.rank}º lugar` : 'fora do ranking',
    new_achievements: unlocked.map((a) => ({ code: a.code, name: a.name, icon: a.icon })),
    achievements: allAchievements.map((a) => ({
      code: a.code,
      name: a.name,
      icon: a.icon,
      description: a.description,
      unlocked: unlockedCodes.has(a.code),
      unlocked_at: userAchievements.find((ua) => ua.code === a.code)?.unlocked_at ?? null,
    })),
    share_message: buildShareMessage({
      nickname: user?.nickname ?? user?.name ?? 'Jogador',
      correct: attempt.correct_answers,
      total: attempt.total_questions,
      percentage: Number(attempt.percentage),
      score: attempt.score,
      rank: rankInfo.rank,
    }),
    finished_server_at: now().toISOString(),
    review,
  });

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Compartilhamento (WhatsApp)                                                 */
/* -------------------------------------------------------------------------- */

export function buildShareMessage({ nickname, correct, total, percentage, score, rank }) {
  const lines = [
    '📖 Quiz Bíblico — Profetas Menores',
    '',
    `👤 Jogador: ${nickname}`,
    `🎯 Resultado: ${correct}/${total}`,
    `📊 Aproveitamento: ${Number(percentage).toFixed(0).replace('.', ',')}%`,
    `🏆 Pontuação: ${formatScore(score)}`,
  ];
  if (rank) lines.push(`🥇 Posição no ranking: ${rank}º lugar`);
  lines.push('', 'Será que você consegue superar minha pontuação?');
  return lines.join('\n');
}

export default {
  startAttempt,
  answerQuestion,
  finishAttempt,
  selectQuestions,
  publicQuestion,
  questionReveal,
  attemptSummary,
  buildShareMessage,
};
