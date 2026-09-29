import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  POINTS,
  MIXED_DISTRIBUTION,
  accuracyBonus,
  computeResult,
  formatDuration,
  formatScore,
  isUuid,
  maxBaseScore,
  normalizeLetter,
  normalizeMode,
  normalizePeriod,
  pointsFor,
  sanitizeText,
  serverDurationSeconds,
  setMixedDistribution,
  toPercentage,
  validatePlayerInput,
  ApiError,
} from '../src/utils/rules.js';
import { selectQuestions, shuffle, buildShareMessage } from '../src/services/quizService.js';
import { isUnlocked } from '../src/services/achievementService.js';
import { issueUserToken, verifyUserToken } from '../src/utils/token.js';
import { QUESTIONS } from '../src/db/seedData.js';

/* -------------------------------------------------------------------------- */
describe('Regras de pontuação (autoridade do servidor)', () => {
  test('pontos por dificuldade: 100 / 200 / 300', () => {
    assert.equal(POINTS.facil, 100);
    assert.equal(POINTS.medio, 200);
    assert.equal(POINTS.dificil, 300);
  });

  test('erro nunca pontua negativamente', () => {
    assert.equal(pointsFor('dificil', false), 0);
    assert.equal(pointsFor('facil', false), 0);
    assert.equal(pointsFor('inexistente', true), 0);
  });

  test('bônus: 100% = +500, 90–99% = +300, 80–89% = +150, <80% = 0', () => {
    assert.equal(accuracyBonus(100), 500);
    assert.equal(accuracyBonus(95), 300);
    assert.equal(accuracyBonus(90), 300);
    assert.equal(accuracyBonus(89.9), 150);
    assert.equal(accuracyBonus(80), 150);
    assert.equal(accuracyBonus(79.99), 0);
    assert.equal(accuracyBonus(0), 0);
    assert.equal(accuracyBonus('abc'), 0);
  });

  test('gabarito perfeito vale 4.000 + 500 = 4.500 pontos', () => {
    const answers = selectQuestions(QUESTIONS, 'mixed', 20, () => 0.5).map((q) => ({ difficulty: q.difficulty, is_correct: true }));
    const result = computeResult(answers);
    assert.equal(result.base_score, 4000);
    assert.equal(result.bonus_score, 500);
    assert.equal(result.score, 4500);
    assert.equal(result.percentage, 100);
    assert.equal(result.correct_answers, 20);
    assert.equal(result.wrong_answers, 0);
  });

  test('partida zerada não gera pontuação negativa', () => {
    const answers = selectQuestions(QUESTIONS, 'mixed', 20, () => 0.5).map((q) => ({ difficulty: q.difficulty, is_correct: false }));
    const result = computeResult(answers);
    assert.equal(result.score, 0);
    assert.equal(result.base_score, 0);
    assert.equal(result.bonus_score, 0);
    assert.equal(result.wrong_answers, 20);
  });

  test('percentual com duas casas decimais', () => {
    assert.equal(toPercentage(18, 20), 90);
    assert.equal(toPercentage(1, 3), 33.33);
    assert.equal(toPercentage(2, 3), 66.67);
    assert.equal(toPercentage(0, 0), 0);
    assert.equal(toPercentage(25, 20), 100); // nunca passa de 100%
  });

  test('duração oficial usa o relógio do servidor e tem teto', () => {
    const start = new Date('2026-09-02T10:00:00Z');
    const end = new Date('2026-09-02T10:07:30Z');
    assert.equal(serverDurationSeconds(start, end), 450);
    assert.equal(serverDurationSeconds(start, end, 60), 60);
    assert.equal(serverDurationSeconds(end, start), 0);
    assert.equal(serverDurationSeconds('inválido', end), 0);
  });
});

/* -------------------------------------------------------------------------- */
describe('Distribuição de questões e reflexo na pontuação', () => {
  test('padrão oficial: 6 fáceis + 8 médias + 6 difíceis = 20 questões', () => {
    assert.deepEqual(MIXED_DISTRIBUTION, { facil: 6, medio: 8, dificil: 6 });
    assert.equal(
      Object.values(MIXED_DISTRIBUTION).reduce((a, b) => a + b, 0),
      20,
    );
    assert.equal(maxBaseScore(), 4000);
  });

  test('QUIZ_DISTRIBUTION altera a composição (string e objeto)', () => {
    const original = { ...MIXED_DISTRIBUTION };

    const { total } = setMixedDistribution('facil:5,medio:7,dificil:8');
    assert.equal(total, 20);
    assert.deepEqual(MIXED_DISTRIBUTION, { facil: 5, medio: 7, dificil: 8 });

    setMixedDistribution({ facil: 10, medio: 5, dificil: 5 });
    assert.deepEqual(MIXED_DISTRIBUTION, { facil: 10, medio: 5, dificil: 5 });

    setMixedDistribution(original); // restaura o padrão
    assert.deepEqual(MIXED_DISTRIBUTION, { facil: 6, medio: 8, dificil: 6 });
  });

  test('18/20 = 90% de aproveitamento e bônus de +300', () => {
    // 6 fáceis + 6 médias corretas, 2 médias erradas e 6 difíceis corretas
    const answers = [
      ...Array.from({ length: 6 }, () => ({ difficulty: 'facil', is_correct: true })),
      ...Array.from({ length: 6 }, () => ({ difficulty: 'medio', is_correct: true })),
      ...Array.from({ length: 2 }, () => ({ difficulty: 'medio', is_correct: false })),
      ...Array.from({ length: 6 }, () => ({ difficulty: 'dificil', is_correct: true })),
    ];
    const result = computeResult(answers);
    assert.equal(result.answered_count, 20);
    assert.equal(result.correct_answers, 18);
    assert.equal(result.wrong_answers, 2);
    assert.equal(result.percentage, 90);
    assert.equal(result.base_score, 3600);
    assert.equal(result.bonus_score, 300);
    assert.equal(result.score, 3900);
  });

  test('erros em níveis diferentes mudam o total (mesmos 18 acertos)', () => {
    const base = (facilErradas, medioErradas, dificilErradas) => {
      const answers = [
        ...Array.from({ length: 6 - facilErradas }, () => ({ difficulty: 'facil', is_correct: true })),
        ...Array.from({ length: facilErradas }, () => ({ difficulty: 'facil', is_correct: false })),
        ...Array.from({ length: 8 - medioErradas }, () => ({ difficulty: 'medio', is_correct: true })),
        ...Array.from({ length: medioErradas }, () => ({ difficulty: 'medio', is_correct: false })),
        ...Array.from({ length: 6 - dificilErradas }, () => ({ difficulty: 'dificil', is_correct: true })),
        ...Array.from({ length: dificilErradas }, () => ({ difficulty: 'dificil', is_correct: false })),
      ];
      return computeResult(answers);
    };

    const faceis = base(2, 0, 0);
    const medias = base(0, 2, 0);
    const dificeis = base(0, 0, 2);

    // 18/20 = 90% em todos os casos (bônus +300); o que muda é a base
    assert.equal(faceis.correct_answers, 18);
    assert.equal(faceis.percentage, 90);
    assert.equal(faceis.base_score, 3800);
    assert.equal(faceis.score, 4100);

    assert.equal(medias.base_score, 3600);
    assert.equal(medias.score, 3900);

    assert.equal(dificeis.base_score, 3400);
    assert.equal(dificeis.score, 3700);

    // 16 acertos = 80% -> bônus de +150
    const dezesseis = base(4, 0, 0);
    assert.equal(dezesseis.correct_answers, 16);
    assert.equal(dezesseis.percentage, 80);
    assert.equal(dezesseis.bonus_score, 150);
    assert.equal(dezesseis.score, 3750);
  });
});

/* -------------------------------------------------------------------------- */
describe('Validação e sanitização de entrada', () => {
  test('cadastro exige nome com 2+ caracteres e apelido seguro', () => {
    const ok = validatePlayerInput({ name: '  Profetas Menores   Silva ', nickname: 'profetas-menores.silva' });
    assert.deepEqual(ok, { name: 'Profetas Menores Silva', nickname: 'profetas-menores.silva' });

    assert.throws(() => validatePlayerInput({ name: 'A' }), ApiError);
    assert.throws(() => validatePlayerInput({ name: 'Ok', nickname: 'x' }), ApiError);
    assert.throws(() => validatePlayerInput({ name: 'Ok', nickname: 'inválido!@#' }), ApiError);
  });

  test('apelido vira o nome quando não informado', () => {
    assert.equal(validatePlayerInput({ name: 'Hananias' }).nickname, 'Hananias');
  });

  test('sanitizeText remove HTML e caracteres de controle', () => {
    assert.equal(sanitizeText('<b>João</b>'), 'João');
    assert.equal(sanitizeText('<script>alert(1)</script>João'), 'alert(1)João');
    assert.equal(sanitizeText('  a\u0000b\u001Fc  '), 'abc');
    assert.equal(sanitizeText(123), '');
    assert.equal(sanitizeText('abc', 2), 'ab');
  });

  test('normalização de letras, modos e períodos', () => {
    assert.equal(normalizeLetter(' a '), 'A');
    assert.equal(normalizeLetter('E'), null);
    assert.equal(normalizeLetter(5), null);
    assert.equal(normalizeMode(''), 'mixed');
    assert.equal(normalizeMode('MEDIO'), 'medio');
    assert.equal(normalizeMode('impossivel'), null);
    assert.equal(normalizePeriod('hoje'), 'today');
    assert.equal(normalizePeriod('semana'), 'week');
    assert.equal(normalizePeriod('mês'), 'month');
    assert.equal(normalizePeriod('geral'), 'all');
    assert.equal(normalizePeriod('nada'), null);
  });

  test('isUuid aceita apenas UUID válido', () => {
    assert.ok(isUuid('6f1d0b5a-1a2b-4c3d-8e9f-0123456789ab'));
    assert.ok(!isUuid('1'));
    assert.ok(!isUuid(null));
  });

  test('formatação pt-BR', () => {
    assert.equal(formatScore(4100), '4.100');
    assert.equal(formatDuration(90), '01:30');
    assert.equal(formatDuration(3725), '1:02:05');
  });
});

/* -------------------------------------------------------------------------- */
describe('Seleção de questões', () => {
  test('modo mixed monta 6/8/6 = 20 questões sem repetição', () => {
    setMixedDistribution();
    const picked = selectQuestions(QUESTIONS, 'mixed', 20);
    assert.equal(picked.length, 20);
    assert.equal(new Set(picked.map((q) => q.id)).size, 20);
    const count = picked.reduce(
      (acc, q) => ({ ...acc, [q.difficulty]: (acc[q.difficulty] || 0) + 1 }),
      { facil: 0, medio: 0, dificil: 0 },
    );
    assert.deepEqual(count, { facil: 6, medio: 8, dificil: 6 });
  });

  test('duas partidas seguidas não têm necessariamente a mesma ordem', () => {
    const a = selectQuestions(QUESTIONS, 'mixed', 20).map((q) => q.id).join();
    const b = selectQuestions(QUESTIONS, 'mixed', 20).map((q) => q.id).join();
    const c = selectQuestions(QUESTIONS, 'mixed', 20).map((q) => q.id).join();
    assert.ok(a !== b || b !== c, 'o sorteio deve variar entre partidas');
  });

  test('modo por dificuldade filtra corretamente', () => {
    const faceis = selectQuestions(QUESTIONS, 'facil', 20);
    assert.ok(faceis.length > 0);
    assert.ok(faceis.every((q) => q.difficulty === 'facil'));
  });

  test('banco incompleto gera erro 500 claro', () => {
    assert.throws(() => selectQuestions(QUESTIONS.slice(0, 3), 'mixed'), /Banco incompleto/);
  });

  test('shuffle preserva os elementos e não muta o original', () => {
    const list = [1, 2, 3, 4, 5];
    const result = shuffle(list, () => 0.5);
    assert.deepEqual([...result].sort(), list);
    assert.deepEqual(list, [1, 2, 3, 4, 5]);
  });

  test('questões inativas nunca entram na partida', () => {
    const withInactive = [...QUESTIONS, { ...QUESTIONS[0], id: 'inativa', active: false }];
    const picked = selectQuestions(withInactive, 'mixed', 20);
    assert.ok(!picked.some((q) => q.active === false));
  });
});

/* -------------------------------------------------------------------------- */
describe('Conquistas', () => {
  const stats = (attempts, correct, wrong) => ({ attempts, total_correct: correct, total_wrong: wrong });

  test('FIRST_GAME após 1 partida', () => {
    assert.ok(isUnlocked({ type: 'attempts_count', value: 1 }, { stats: stats(1, 10, 10), attempt: {} }));
    assert.ok(!isUnlocked({ type: 'attempts_count', value: 5 }, { stats: stats(1, 10, 10), attempt: {} }));
  });

  test('PERFECT_SCORE apenas com 100% de acerto em partida finalizada', () => {
    const perfect = { status: 'FINISHED', total_questions: 20, correct_answers: 20 };
    assert.ok(isUnlocked({ type: 'perfect_attempt' }, { attempt: perfect, stats: stats(1, 20, 0) }));
    assert.ok(
      !isUnlocked(
        { type: 'perfect_attempt' },
        { attempt: { status: 'FINISHED', total_questions: 20, correct_answers: 19 }, stats: stats(1, 19, 1) },
      ),
    );
  });

  test('TOP_TEN e FIRST_PLACE pela posição no ranking', () => {
    assert.ok(isUnlocked({ type: 'leaderboard_position', value: 10 }, { rank: 7 }));
    assert.ok(!isUnlocked({ type: 'leaderboard_position', value: 10 }, { rank: 11 }));
    assert.ok(isUnlocked({ type: 'leaderboard_position', value: 1 }, { rank: 1 }));
    assert.ok(!isUnlocked({ type: 'leaderboard_position', value: 1 }, { rank: 0 }));
  });

  test('ESPECIALISTA NOS PROFETAS: 100 acertos e 85% de aproveitamento', () => {
    assert.ok(
      isUnlocked(
        { type: 'expert', correct: 100, min_accuracy: 85 },
        { correctTotal: 120, accuracy: toPercentage(120, 140), stats: stats(7, 120, 20) },
      ),
    );
    assert.ok(
      !isUnlocked(
        { type: 'expert', correct: 100, min_accuracy: 85 },
        { correctTotal: 90, accuracy: 100, stats: stats(5, 90, 0) },
      ),
    );
  });

  test('critério desconhecido nunca desbloqueia', () => {
    assert.ok(!isUnlocked({ type: 'desconhecido' }, {}));
  });
});

/* -------------------------------------------------------------------------- */
describe('Token de sessão (HMAC)', () => {
  const secret = 'segredo-de-teste-bem-longo';
  const userId = '6f1d0b5a-1a2b-4c3d-8e9f-0123456789ab';

  test('emite e verifica', () => {
    const { token } = issueUserToken(userId, secret, 60);
    assert.equal(verifyUserToken(token, secret), userId);
  });

  test('rejeita token adulterado (outro usuário)', () => {
    const { token } = issueUserToken(userId, secret);
    const parts = token.split('.');
    parts[1] = '6f1d0b5a-1a2b-4c3d-8e9f-0123456789ac';
    assert.throws(() => verifyUserToken(parts.join('.'), secret), /Sessão inválida/);
  });

  test('rejeita segredo diferente', () => {
    const { token } = issueUserToken(userId, secret);
    assert.throws(() => verifyUserToken(token, 'outro-segredo'), /Sessão inválida/);
  });

  test('rejeita token expirado', () => {
    const { token } = issueUserToken(userId, secret, -10);
    assert.throws(() => verifyUserToken(token, secret), /expirada/);
  });

  test('rejeita lixo', () => {
    assert.throws(() => verifyUserToken('abc', secret), /Sessão inválida/);
    assert.throws(() => verifyUserToken(undefined, secret), /Sessão inválida/);
  });
});

/* -------------------------------------------------------------------------- */
describe('Mensagem de compartilhamento (WhatsApp)', () => {
  test('contém todos os campos do modelo', () => {
    const text = buildShareMessage({
      nickname: 'Profetas Menores',
      correct: 18,
      total: 20,
      percentage: 90,
      score: 4100,
      rank: 7,
    });
    assert.match(text, /📖 Quiz Bíblico — Profetas Menores/);
    assert.match(text, /👤 Jogador: Profetas Menores/);
    assert.match(text, /🎯 Resultado: 18\/20/);
    assert.match(text, /📊 Aproveitamento: 90%/);
    assert.match(text, /🏆 Pontuação: 4\.100/);
    assert.match(text, /🥇 Posição no ranking: 7º lugar/);
    assert.match(text, /Será que você consegue superar minha pontuação\?/);
  });
});
