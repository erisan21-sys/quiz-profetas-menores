/**
 * QUIZ BÍBLICO — PROFETAS MENORES · Regras oficiais do jogo
 * ---------------------------------------------------------------------------
 * Este módulo é a ÚNICA fonte de verdade sobre pontuação, dificuldade,
 * bônus e validação de entradas. Ele não depende de banco nem de HTTP:
 * é usado pelo backend (autoridade) e pelos testes.
 *
 * REGRA PRINCIPAL: a pontuação oficial pertence ao servidor.
 * O navegador nunca calcula score, percentage ou rank.
 */

export const LETTERS = Object.freeze(['A', 'B', 'C', 'D']);

export const DIFFICULTIES = Object.freeze(['facil', 'medio', 'dificil']);

export const MODES = Object.freeze(['mixed', 'facil', 'medio', 'dificil']);

export const STATUS = Object.freeze({
  STARTED: 'STARTED',
  FINISHED: 'FINISHED',
  ABANDONED: 'ABANDONED',
});

/** Pontos-base por acerto, conforme a dificuldade da questão. */
export const POINTS = Object.freeze({
  facil: 100,
  medio: 200,
  dificil: 300,
});

/** Distribuição padrão da partida completa (modo mixed): 6 + 8 + 6 = 20 questões. */
export const DEFAULT_MIXED_DISTRIBUTION = Object.freeze({ facil: 6, medio: 8, dificil: 6 });

/**
 * Distribuição ativa — objeto mutável compartilhado por todo o backend.
 * Ajustável por QUIZ_DISTRIBUTION=facil:6,medio:8,dificil:6 (a soma deve ser
 * igual a QUIZ_SIZE). Mantida como objeto para evitar referências desatualizadas.
 */
export const MIXED_DISTRIBUTION = { ...DEFAULT_MIXED_DISTRIBUTION };

/**
 * Aplica uma nova distribuição. Retorna { distribution, total }.
 * Aceita objeto ({facil:6}) ou string ("facil:6,medio:8,dificil:6").
 */
export function setMixedDistribution(next) {
  if (!next) return { distribution: { ...MIXED_DISTRIBUTION }, total: sumDistribution() };

  let source = next;
  if (typeof next === 'string') {
    source = {};
    for (const part of next.split(',')) {
      const [key, value] = part.split(':').map((item) => item.trim());
      if (key) source[key.toLowerCase()] = value;
    }
  }

  let total = 0;
  for (const difficulty of DIFFICULTIES) {
    const has = Object.prototype.hasOwnProperty.call(source, difficulty);
    const raw = has ? Number.parseInt(source[difficulty], 10) : DEFAULT_MIXED_DISTRIBUTION[difficulty];
    const value = Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MIXED_DISTRIBUTION[difficulty];
    MIXED_DISTRIBUTION[difficulty] = value;
    total += value;
  }
  return { distribution: { ...MIXED_DISTRIBUTION }, total };
}

export function sumDistribution(distribution = MIXED_DISTRIBUTION) {
  return DIFFICULTIES.reduce((acc, d) => acc + (distribution[d] || 0), 0);
}

/** Pontuação-base máxima da partida completa: 6*100 + 8*200 + 6*300 = 4.000. */
export function maxBaseScore(distribution = MIXED_DISTRIBUTION) {
  return DIFFICULTIES.reduce((acc, d) => acc + (distribution[d] || 0) * POINTS[d], 0);
}

export const MAX_BASE_SCORE_MIXED = maxBaseScore(DEFAULT_MIXED_DISTRIBUTION);

/**
 * Bônus de aproveitamento.
 *   100%      -> +500
 *   90% a 99% -> +300
 *   80% a 89% -> +150
 *   < 80%     -> +0
 * Nunca há pontuação negativa.
 */
export function accuracyBonus(percentage) {
  const p = Number(percentage);
  if (!Number.isFinite(p)) return 0;
  if (p >= 100) return 500;
  if (p >= 90) return 300;
  if (p >= 80) return 150;
  return 0;
}

export const BONUS_TABLE = Object.freeze([
  { min: 100, bonus: 500, label: '100% de aproveitamento' },
  { min: 90, bonus: 300, label: '90% a 99% de aproveitamento' },
  { min: 80, bonus: 150, label: '80% a 89% de aproveitamento' },
  { min: 0, bonus: 0, label: 'abaixo de 80%' },
]);

/** Pontos de uma única questão respondida. Erro vale 0 (sem pontuação negativa). */
export function pointsFor(difficulty, isCorrect) {
  if (!isCorrect) return 0;
  return POINTS[difficulty] ?? 0;
}

/** Percentual de acerto com 2 casas decimais. */
export function toPercentage(correct, total) {
  if (!total || total <= 0) return 0;
  return Math.round((Math.min(correct, total) / total) * 10000) / 100;
}

/**
 * Cálculo oficial do resultado de uma partida encerrada.
 * @param {Array<{difficulty: string, is_correct: boolean}>} answers
 * @returns {{base_score:number, bonus_score:number, score:number,
 *            correct_answers:number, wrong_answers:number,
 *            answered_count:number, percentage:number}}
 */
export function computeResult(answers) {
  let base = 0;
  let correct = 0;
  let wrong = 0;

  for (const answer of answers) {
    if (answer.is_correct) {
      correct += 1;
      base += pointsFor(answer.difficulty, true);
    } else {
      wrong += 1;
    }
  }

  const answeredCount = correct + wrong;
  const percentage = toPercentage(correct, answeredCount);
  const bonus = accuracyBonus(percentage);

  return {
    base_score: base,
    bonus_score: bonus,
    score: base + bonus,
    correct_answers: correct,
    wrong_answers: wrong,
    answered_count: answeredCount,
    percentage,
  };
}

/** Duração oficial: diferença de relógio do SERVIDOR, nunca o valor do navegador. */
export function serverDurationSeconds(startedAt, finishedAt, max = 7200) {
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const seconds = Math.round((end - start) / 1000);
  return Math.max(0, Math.min(seconds, max));
}

/* -------------------------------------------------------------------------- */
/* Validação e sanitização de entradas                                         */
/* -------------------------------------------------------------------------- */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** Remove tags, controles invisíveis e normaliza espaços. */
export function sanitizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function normalizeLetter(value) {
  if (typeof value !== 'string') return null;
  const letter = value.trim().toUpperCase();
  return LETTERS.includes(letter) ? letter : null;
}

export function normalizeDifficulty(value) {
  if (typeof value !== 'string') return null;
  const d = value.trim().toLowerCase();
  return DIFFICULTIES.includes(d) ? d : null;
}

export function normalizeMode(value) {
  if (value === undefined || value === null || value === '') return 'mixed';
  if (typeof value !== 'string') return null;
  const m = value.trim().toLowerCase();
  return MODES.includes(m) ? m : null;
}

export function normalizePeriod(value) {
  if (value === undefined || value === null || value === '') return 'all';
  const map = {
    all: 'all', geral: 'all', today: 'today', hoje: 'today',
    week: 'week', semana: 'week', month: 'month', mes: 'month', mês: 'month',
  };
  const key = String(value).trim().toLowerCase();
  return Object.hasOwn(map, key) ? map[key] : null;
}

/**
 * Valida o cadastro simples (nome/apelido). Retorna {name, nickname} ou lança
 * ApiError com mensagem em português adequada para exibição no frontend.
 */
export function validatePlayerInput({ name, nickname } = {}) {
  const cleanName = sanitizeText(name, 80);
  let cleanNickname = sanitizeText(nickname, 30);

  if (cleanName.length < 2) {
    throw new ApiError(400, 'Informe um nome ou apelido com pelo menos 2 caracteres.');
  }
  if (cleanName.length > 80) {
    throw new ApiError(400, 'O nome deve ter no máximo 80 caracteres.');
  }
  if (!cleanNickname) cleanNickname = cleanName.slice(0, 30);
  if (cleanNickname.length < 2) {
    throw new ApiError(400, 'O apelido deve ter pelo menos 2 caracteres.');
  }
  if (cleanNickname.length > 30) {
    throw new ApiError(400, 'O apelido deve ter no máximo 30 caracteres.');
  }
  if (!/^[A-Za-z0-9._\- ]+$/.test(cleanNickname)) {
    throw new ApiError(400, 'O apelido pode conter apenas letras, números, espaço, ponto, hífen e underline.');
  }

  return { name: cleanName, nickname: cleanNickname };
}

/** Erro de API com status HTTP e mensagem segura para o cliente. */
export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  toJSON() {
    return { error: this.message, status: this.status, details: this.details };
  }
}

/** Formata a duração em mm:ss (ou h:mm:ss quando passa de uma hora). */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 4100 -> "4.100" (formato brasileiro usado nas telas e no compartilhamento). */
export function formatScore(value) {
  return (Number(value) || 0).toLocaleString('pt-BR');
}
