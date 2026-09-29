import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { startTestApp, ADMIN_TOKEN, applyTestConfig } from './helpers/testKit.js';
import { QUESTIONS } from '../src/db/seedData.js';
import { resetLimiters } from '../src/middleware/rateLimit.js';

/**
 * Testes de integração da API (requisições HTTP reais contra o app Express).
 * Cobrem: cadastro, início de partida, resposta correta/incorreta, duplicidade,
 * finalização, pontuação oficial, ranking, histórico, perfil, conquistas,
 * estatísticas, administração e tentativas de manipulação/fraude.
 */

const correctLetter = (questionId) =>
  QUESTIONS.find((q) => q.id === questionId).correct_answer;
const wrongLetter = (questionId) =>
  ['A', 'B', 'C', 'D'].find((l) => l !== correctLetter(questionId));

describe('API · Quiz Bíblico — Profetas Menores', { concurrency: 1 }, () => {
  let api;

  beforeEach(async () => {
    applyTestConfig();
    resetLimiters();
    api = await startTestApp();
  });

  afterEach(async () => {
    await api.close();
    applyTestConfig();
    resetLimiters();
  });

  /* ---------------------------------------------------------------- saúde */
  test('GET /api/health responde ok e informa o driver', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.db.driver, 'local');
    assert.equal(res.body.db.counts.questions, 60);
  });

  test('GET /api lista os endpoints da API', async () => {
    const res = await api.get('/api');
    assert.equal(res.status, 200);
    assert.ok(res.body.endpoints.length > 15);
  });

  /* ------------------------------------------------------------- cadastro */
  test('cadastro: cria jogador com UUID e devolve token de sessão', async () => {
    const res = await api.post('/api/users', { name: 'Profetas Menores Silva', nickname: 'profetas-menores.silva' });
    assert.equal(res.status, 201);
    assert.match(res.body.user.id, /^[0-9a-f-]{36}$/);
    assert.equal(res.body.user.nickname, 'profetas-menores.silva');
    assert.equal(res.body.user.role, 'player');
    assert.ok(res.body.token.split('.').length === 5);
    assert.ok(res.body.expires_at);
  });

  test('cadastro: rejeita nome curto, apelido inválido e XSS', async () => {
    assert.equal((await api.post('/api/users', { name: 'A' })).status, 400);
    assert.equal((await api.post('/api/users', { name: '' })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'Ab', nickname: '!!@@' })).status, 400);

    const res = await api.post('/api/users', {
      name: '<script>alert(1)</script>Maria',
      nickname: 'maria',
    });
    assert.equal(res.status, 201);
    assert.ok(!res.body.user.name.includes('<script>'));
  });

  test('cadastro: apelido duplicado retorna 409', async () => {
    assert.equal((await api.post('/api/users', { name: 'A B', nickname: 'pedro' })).status, 201);
    const dup = await api.post('/api/users', { name: 'C D', nickname: 'pedro' });
    assert.equal(dup.status, 409);
    assert.match(dup.body.error, /já está em uso/);
  });

  test('cadastro: apelido é case-insensitive (PEDRO = pedro)', async () => {
    await api.post('/api/users', { name: 'Pedro', nickname: 'Pedro' });
    const res = await api.post('/api/users', { name: 'Outro', nickname: 'PEDRO' });
    assert.equal(res.status, 409);
  });

  test('rejoin: recupera a sessão pelo apelido', async () => {
    const created = await api.post('/api/users', { name: 'Ana', nickname: 'ana' });
    const res = await api.post('/api/users/rejoin', { nickname: 'ANA' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, created.body.user.id);
    assert.ok(res.body.token);
    assert.equal((await api.post('/api/users/rejoin', { nickname: 'ninguem' })).status, 404);
  });

  test('rotas protegidas exigem sessão válida', async () => {
    assert.equal((await api.post('/api/quiz/start', { mode: 'mixed' })).status, 401);
    const bogus = await api.post('/api/quiz/start', { mode: 'mixed' }, { token: 'v1.x.y.z.w' });
    assert.equal(bogus.status, 401);
  });

  /* ------------------------------------------------------ início de partida */
  test('start: cria partida com 20 questões na distribuição 6/8/6', async () => {
    const { token } = await api.register();
    const res = await api.start(token);

    assert.equal(res.status, 201);
    assert.equal(res.body.resumed, false);
    assert.equal(res.body.questions.length, 20);
    assert.equal(res.body.attempt.status, 'STARTED');
    assert.equal(res.body.attempt.total_questions, 20);
    assert.equal(res.body.attempt.mode, 'mixed');

    const byDifficulty = res.body.questions.reduce(
      (acc, q) => ({ ...acc, [q.difficulty]: (acc[q.difficulty] || 0) + 1 }),
      { facil: 0, medio: 0, dificil: 0 },
    );
    assert.deepEqual(byDifficulty, { facil: 6, medio: 8, dificil: 6 });

    const positions = res.body.questions.map((q) => q.position);
    assert.deepEqual(positions, Array.from({ length: 20 }, (_, i) => i + 1));
  });

  test('start: NUNCA envia gabarito, explicação ou id interno do banco', async () => {
    const { token } = await api.register();
    const res = await api.start(token);
    const raw = JSON.stringify(res.body.questions);

    assert.ok(!raw.includes('correct_answer'));
    assert.ok(!raw.includes('explanation'));
    assert.ok(!raw.includes('option_a'));
    for (const q of res.body.questions) {
      assert.equal(q.options.length, 4);
      assert.deepEqual(q.options.map((o) => o.letter), ['A', 'B', 'C', 'D']);
      assert.ok(q.hint.length > 0);
      assert.ok([100, 200, 300].includes(q.points));
    }
  });

  test('start: modo por dificuldade filtra as questões', async () => {
    const { token } = await api.register();
    const res = await api.start(token, { mode: 'dificil' });
    assert.equal(res.status, 201);
    assert.ok(res.body.questions.every((q) => q.difficulty === 'dificil'));
    assert.equal(res.body.questions.length, 12);
    assert.equal(res.body.attempt.mode, 'dificil');
  });

  test('start: retorna a partida em andamento quando já existe uma aberta', async () => {
    const { token } = await api.register();
    const first = await api.start(token);
    const second = await api.start(token);
    assert.equal(second.status, 200);
    assert.equal(second.body.resumed, true);
    assert.equal(second.body.attempt.id, first.body.attempt.id);
    assert.equal(second.body.attempt.next_position, 1);
  });

  /* ------------------------------------------------------------- respostas */
  test('resposta correta: is_correct=true, pontos conforme a dificuldade', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const question = body.questions[0];

    const res = await api.answer(token, body.attempt.id, question.id, correctLetter(question.id));
    assert.equal(res.status, 200);
    assert.equal(res.body.is_correct, true);
    assert.equal(res.body.points_earned, question.points);
    assert.equal(res.body.progress.correct, 1);
    assert.equal(res.body.reveal.correct_answer, correctLetter(question.id));
    assert.ok(res.body.reveal.explanation.length > 10);
  });

  test('resposta incorreta: is_correct=false e zero pontos (sem pontuação negativa)', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const question = body.questions[0];

    const res = await api.answer(token, body.attempt.id, question.id, wrongLetter(question.id));
    assert.equal(res.status, 200);
    assert.equal(res.body.is_correct, false);
    assert.equal(res.body.points_earned, 0);
    assert.equal(res.body.progress.score, 0);
    assert.equal(res.body.progress.wrong, 1);
  });

  test('resposta duplicada na mesma questão é bloqueada (409)', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const question = body.questions[0];

    const first = await api.answer(token, body.attempt.id, question.id, correctLetter(question.id));
    assert.equal(first.status, 200);

    const second = await api.answer(token, body.attempt.id, question.id, wrongLetter(question.id));
    assert.equal(second.status, 409);
    assert.match(second.body.error, /já foi respondida/);

    const stored = await api.repo.listAnswersByAttempt(body.attempt.id);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].is_correct, true);
  });

  test('resposta fora de ordem é bloqueada (409)', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const [, second] = body.questions;

    const res = await api.answer(token, body.attempt.id, second.id, correctLetter(second.id));
    assert.equal(res.status, 409);
    assert.match(res.body.error, /ordem/);
  });

  test('questão que não pertence à partida é bloqueada (400) e auditada', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const foreign = QUESTIONS.find((q) => !body.attempt.question_order?.includes?.(q.id)) || QUESTIONS[0];
    const notInAttempt = body.questions.every((q) => q.id !== 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    const res = await api.answer(token, body.attempt.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A');
    assert.equal(res.status, 400);
    assert.ok(notInAttempt);
    assert.ok(foreign);

    const audit = api.repo._state.audit_log.filter((l) => l.action === 'FRAUD_QUESTION_NOT_IN_ATTEMPT');
    assert.equal(audit.length, 1);
  });

  test('letra inválida é rejeitada (400)', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const res = await api.answer(token, body.attempt.id, body.questions[0].id, 'E');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /A, B, C ou D/);
  });

  test('outro jogador não consegue responder na partida alheia (403)', async () => {
    const owner = await api.register();
    const attacker = await api.register();
    const { body } = await api.start(owner.token);

    const res = await api.answer(
      attacker.token,
      body.attempt.id,
      body.questions[0].id,
      correctLetter(body.questions[0].id),
    );
    assert.equal(res.status, 403);
    assert.match(res.body.error, /outro jogador/);

    const audit = api.repo._state.audit_log.filter((l) => l.action === 'FRAUD_OWNER_MISMATCH');
    assert.equal(audit.length, 1);
  });

  test('respostas rápidas demais são bloqueadas (anti-macro)', async () => {
    const fast = await startTestApp({ config: { game: { minAnswerIntervalMs: 300 } } });
    try {
      const { token } = await fast.register();
      const { body } = await fast.start(token);
      const [q1, q2] = body.questions;

      // responder imediatamente após o início da partida
      const tooFast = await fast.answer(token, body.attempt.id, q1.id, correctLetter(q1.id));
      assert.equal(tooFast.status, 429);
      assert.match(tooFast.body.error, /rápidas demais/);
      assert.ok(tooFast.body.details.retry_after_ms > 0);

      await new Promise((resolve) => setTimeout(resolve, 320));
      const ok = await fast.answer(token, body.attempt.id, q1.id, correctLetter(q1.id));
      assert.equal(ok.status, 200);
      assert.equal(ok.body.is_correct, true);

      // e novamente logo em seguida
      const again = await fast.answer(token, body.attempt.id, q2.id, correctLetter(q2.id));
      assert.equal(again.status, 429);

      await new Promise((resolve) => setTimeout(resolve, 320));
      const ok2 = await fast.answer(token, body.attempt.id, q2.id, correctLetter(q2.id));
      assert.equal(ok2.status, 200);
      assert.equal(ok2.body.progress.answered, 2);
    } finally {
      await fast.close();
    }
  });

  /* ---------------------------------------------------------- finalização */
  test('partida completa: pontuação oficial calculada pelo servidor', async () => {
    const { token, user } = await api.register({ nickname: 'jogador_oficial' });
    const game = await api.playGame(token, { wrongDifficulties: { medio: 2 } });
    assert.ok(game.ok, JSON.stringify(game.finished?.body));

    const result = game.finished.body;
    assert.equal(result.status, 'FINISHED');
    assert.equal(result.correct_answers, 18);
    assert.equal(result.wrong_answers, 2);
    assert.equal(result.total_questions, 20);
    assert.equal(result.percentage, 90);
    assert.equal(result.bonus_score, 300);
    assert.equal(result.base_score, 3600);
    assert.equal(result.base_score + result.bonus_score, result.score);
    assert.equal(result.score, 3900);
    assert.ok(result.duration_seconds >= 0);
    assert.equal(result.nickname, 'jogador_oficial');
    assert.equal(result.review.length, 20);
    assert.match(result.share_message, /📖 Quiz Bíblico — Profetas Menores/);
    assert.match(result.share_message, new RegExp(`👤 Jogador: ${user.nickname}`));
    assert.match(result.share_message, /🎯 Resultado: 18\/20/);
    assert.equal(result.rank, 1);
    assert.equal(result.position_label, '1º lugar');
  });

  test('gabarito perfeito vale 4.500 pontos e desbloqueia conquistas', async () => {
    const { token } = await api.register();
    const game = await api.playGame(token, { wrongAt: [] });
    const result = game.finished.body;

    assert.equal(result.correct_answers, 20);
    assert.equal(result.percentage, 100);
    assert.equal(result.base_score, 4000);
    assert.equal(result.bonus_score, 500);
    assert.equal(result.score, 4500);

    const codes = result.achievements.filter((a) => a.unlocked).map((a) => a.code);
    assert.ok(codes.includes('FIRST_GAME'));
    assert.ok(codes.includes('PERFECT_SCORE'));
    assert.ok(codes.includes('FIRST_PLACE'));
    assert.ok(codes.includes('TOP_TEN'));
    assert.ok(!codes.includes('FIVE_GAMES'));
  });

  test('finalizar sem responder nada marca a partida como ABANDONED', async () => {
    const { token } = await api.register();
    const started = await api.start(token);
    const res = await api.finish(token, started.body.attempt.id);
    assert.equal(res.status, 409);

    const attempt = await api.repo.getAttemptById(started.body.attempt.id);
    assert.equal(attempt.status, 'ABANDONED');
  });

  test('partida FINISHED é imutável: repetir o finish não altera nada', async () => {
    const { token } = await api.register();
    const game = await api.playGame(token, { wrongDifficulties: { facil: 1 } });
    const first = game.finished.body;

    const again = await api.finish(token, game.attemptId);
    assert.equal(again.status, 200);
    assert.equal(again.body.score, first.score);
    assert.equal(again.body.correct_answers, first.correct_answers);
    assert.equal(again.body.percentage, first.percentage);
    assert.equal(again.body.duration_seconds, first.duration_seconds);
  });

  /* -------------------------------------------- tentativas de manipulação */
  test('fraude: cliente não consegue forçar is_correct, pontos ou placar', async () => {
    const { token } = await api.register();
    const { body } = await api.start(token);
    const question = body.questions[0];

    const res = await api.answer(token, body.attempt.id, question.id, wrongLetter(question.id), {
      is_correct: true,
      points: 5000,
      score: 99999,
      percentage: 100,
      correct_answer: correctLetter(question.id),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.is_correct, false);
    assert.equal(res.body.points_earned, 0);
    assert.equal(res.body.progress.score, 0);

    const stored = await api.repo.listAnswersByAttempt(body.attempt.id);
    assert.equal(stored[0].is_correct, false);
    assert.equal(stored[0].points, 0);
  });

  test('fraude: finish com payload manipulado não altera o resultado', async () => {
    const { token } = await api.register();
    const game = await api.playGame(token, { wrongDifficulties: { dificil: 3 } });
    const honest = game.finished.body;

    const tampered = await api.finish(token, game.attemptId, {
      score: 99999,
      correct_answers: 20,
      percentage: 100,
      duration_seconds: 1,
      bonus_score: 500,
    });

    assert.equal(tampered.status, 200);
    assert.equal(tampered.body.score, honest.score);
    assert.equal(tampered.body.correct_answers, 17);
    assert.equal(tampered.body.percentage, 85);

    const inDb = await api.repo.getAttemptById(game.attemptId);
    assert.equal(inDb.score, honest.score);
    assert.equal(inDb.correct_answers, 17);
  });

  test('fraude: alterar diretamente o banco é bloqueado após o fim da partida', async () => {
    const { token } = await api.register();
    const game = await api.playGame(token, { wrongAt: [1] });
    await assert.rejects(
      () => api.repo.updateAttempt(game.attemptId, { score: 999999 }),
      /já está encerrada/,
    );
    const attempt = await api.repo.getAttemptById(game.attemptId);
    assert.ok(attempt.score < 999999);
  });

  test('fraude: finish de partida alheia é bloqueado (403)', async () => {
    const owner = await api.register();
    const attacker = await api.register();
    const game = await api.playGame(owner.token, { wrongDifficulties: { facil: 1 } });

    const res = await api.finish(attacker.token, game.attemptId);
    assert.equal(res.status, 403);
    const audit = api.repo._state.audit_log.filter((l) => l.action === 'FRAUD_FINISH_MISMATCH');
    assert.equal(audit.length, 1);
  });

  /* -------------------------------------------------------------- ranking */
  test('ranking geral ordena por pontos, percentual, acertos e recência', async () => {
    const players = [];
    for (const nickname of ['alpha', 'bravo', 'charlie']) {
      players.push(await api.register({ nickname }));
    }

    await api.playGame(players[0].token, { wrongDifficulties: { dificil: 2, medio: 2 } }); // 16/20
    await api.playGame(players[1].token, { wrongAt: [] }); // 20/20
    await api.playGame(players[2].token, { wrongDifficulties: { medio: 2 } }); // 18/20

    const res = await api.get('/api/ranking');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 3);
    assert.equal(res.body.items[0].nickname, 'bravo');
    assert.equal(res.body.items[0].rank, 1);
    assert.equal(res.body.items[0].medal, '🥇');
    assert.equal(res.body.items[1].nickname, 'charlie');
    assert.equal(res.body.items[1].medal, '🥈');
    assert.equal(res.body.items[2].nickname, 'alpha');
    assert.equal(res.body.items[2].rank, 3);
    assert.equal(res.body.items[2].medal, '🥉');
    assert.equal(res.body.items[2].best_correct, 16);
    assert.ok(res.body.items[0].best_score > res.body.items[2].best_score);
  });

  test('ranking considera apenas a melhor partida de cada jogador', async () => {
    const { token, nickname } = await api.register({ nickname: 'melhor_de_tres' });
    await api.playGame(token, { wrongDifficulties: { dificil: 3, medio: 3 } }); // 14/20
    await api.playGame(token, { wrongAt: [] }); // 20/20
    await api.playGame(token, { wrongDifficulties: { dificil: 3 } }); // 17/20

    const res = await api.get('/api/ranking');
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].best_correct, 20);
    assert.equal(res.body.items[0].attempts_count, 3);
    assert.equal(res.body.items[0].best_percentage, 100);
    assert.ok(nickname);
  });

  test('desempate por percentual, acertos e recência', async () => {
    // Dois jogadores com a mesma pontuação: o mais recente fica à frente.
    const first = await api.register({ nickname: 'empate_um' });
    const second = await api.register({ nickname: 'empate_dois' });

    await api.playGame(first.token, { wrongDifficulties: { medio: 2 } });
    await new Promise((resolve) => setTimeout(resolve, 25)); // garante recência maior
    await api.playGame(second.token, { wrongDifficulties: { medio: 2 } });

    const res = await api.get('/api/ranking');
    assert.equal(res.body.items[0].best_score, res.body.items[1].best_score);
    assert.equal(res.body.items[0].nickname, 'empate_dois');
    assert.equal(res.body.items[0].best_score, 3900);
  });

  test('ranking por período (hoje/semana/mês/geral) e por dificuldade', async () => {
    const { token } = await api.register({ nickname: 'periodos' });
    await api.playGame(token, { wrongAt: [1] });

    for (const path of ['/api/ranking/today', '/api/ranking/week', '/api/ranking/month', '/api/ranking/all']) {
      const res = await api.get(path);
      assert.equal(res.status, 200, path);
      assert.equal(res.body.items.length, 1, path);
    }

    const byQuery = await api.get('/api/ranking?period=hoje&difficulty=facil');
    assert.equal(byQuery.status, 200);
    assert.equal(byQuery.body.period, 'today');
    assert.equal(byQuery.body.mode, 'facil');
    assert.equal(byQuery.body.items.length, 0); // partida era do modo mixed

    const invalid = await api.get('/api/ranking?period=decada');
    assert.equal(invalid.status, 400);
  });

  test('ranking/me informa posição e percentual superado', async () => {
    const players = [];
    for (let i = 0; i < 4; i += 1) players.push(await api.register({ nickname: `rank_${i}` }));
    await api.playGame(players[0].token, { wrongDifficulties: { dificil: 2, medio: 2 } }); // 16 acertos
    await api.playGame(players[1].token, { wrongDifficulties: { dificil: 3 } }); // 17 acertos
    await api.playGame(players[2].token, { wrongDifficulties: { medio: 2 } }); // 18 acertos
    await api.playGame(players[3].token, { wrongAt: [] }); // 20 acertos

    const ranking = await api.get('/api/ranking');
    assert.deepEqual(
      ranking.body.items.map((item) => item.nickname),
      ['rank_3', 'rank_2', 'rank_1', 'rank_0'],
    );

    const res = await api.get('/api/ranking/me', { token: players[2].token });
    assert.equal(res.status, 200);
    assert.equal(res.body.rank, 2);
    assert.equal(res.body.total_players, 4);
    assert.equal(res.body.beaten_percentage, 66.7);
    assert.equal(res.body.position_label, '2º lugar');

    const last = await api.get('/api/ranking/me', { token: players[0].token });
    assert.equal(last.body.rank, 4);
    assert.equal(last.body.beaten_percentage, 0);
  });

  /* ------------------------------------------------------------- histórico */
  test('histórico do jogador lista as partidas com data, pontos e duração', async () => {
    const { token, user } = await api.register({ nickname: 'historico' });
    await api.playGame(token, { wrongDifficulties: { medio: 2 } });
    await api.playGame(token, { wrongAt: [] });

    const res = await api.get(`/api/users/${user.id}/history`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    assert.equal(res.body.items.length, 2);
    for (const item of res.body.items) {
      assert.ok(item.date_label);
      assert.ok(item.score_label);
      assert.ok(item.duration_label);
      assert.equal(item.status, 'FINISHED');
    }
    assert.ok(res.body.items[0].score >= res.body.items[1].score);
  });

  test('histórico público expõe apenas apelido e resultado', async () => {
    const { token } = await api.register({ nickname: 'publico_um' });
    await api.playGame(token, { wrongAt: [1] });

    const res = await api.get('/api/attempts/public');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    const item = res.body.items[0];
    assert.equal(item.nickname, 'publico_um');
    assert.ok('score' in item);
    assert.ok('percentage' in item);
    assert.ok(!('user_id' in item));
    assert.ok(!('email' in item));
    assert.ok(!('name' in item));
  });

  test('detalhe da partida devolve revisão com explicações', async () => {
    const { token } = await api.register();
    const game = await api.playGame(token, { wrongAt: [5] });

    const res = await api.get(`/api/attempts/${game.attemptId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.answers.length, 20);
    const wrong = res.body.answers.find((a) => !a.is_correct);
    assert.equal(wrong.position, 5);
    assert.ok(wrong.explanation.length > 10);
    assert.ok(wrong.correct_answer);
    assert.equal(res.body.attempt.status, 'FINISHED');
  });

  test('partida em andamento não é pública', async () => {
    const { token } = await api.register();
    const started = await api.start(token);
    const res = await api.get(`/api/attempts/${started.body.attempt.id}`);
    assert.equal(res.status, 403);
  });

  /* --------------------------------------------------------------- perfil */
  test('perfil traz posição, melhor pontuação, média e gráfico de evolução', async () => {
    const { token, user } = await api.register({ nickname: 'perfil' });
    await api.playGame(token, { wrongDifficulties: { medio: 2 } }); // 18 acertos
    await api.playGame(token, { wrongDifficulties: { facil: 1, dificil: 1 } }); // 18 acertos

    const res = await api.get(`/api/users/${user.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.nickname, 'perfil');
    assert.ok(res.body.rank >= 1);
    assert.equal(res.body.stats.attempts, 2);
    assert.equal(res.body.stats.total_correct, 36);
    assert.ok(res.body.stats.best_score >= res.body.stats.avg_score);
    assert.equal(res.body.stats.evolution.length, 2);
    assert.ok(res.body.achievements.length >= 7);
    assert.equal(res.body.history.length, 2);
  });

  test('perfil do jogador autenticado via /api/users/me/profile', async () => {
    const { token } = await api.register({ nickname: 'me_profile' });
    await api.playGame(token, { wrongAt: [] });

    const res = await api.get('/api/users/me/profile', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.nickname, 'me_profile');
    assert.equal(res.body.stats.attempts, 1);
    assert.equal(res.body.stats.best_percentage, 100);
  });

  /* ----------------------------------------------------------- conquistas */
  test('conquistas acumulam ao longo das partidas (5 partidas)', async () => {
    const { token } = await api.register({ nickname: 'cinco_vezes' });
    for (let i = 0; i < 5; i += 1) {
      await api.playGame(token, { wrongDifficulties: { dificil: 4 } });
    }
    const res = await api.get('/api/users/me/achievements', { token });
    const codes = res.body.items.filter((a) => a.unlocked).map((a) => a.code);
    assert.ok(codes.includes('FIRST_GAME'));
    assert.ok(codes.includes('FIVE_GAMES'));
    assert.ok(!codes.includes('TEN_GAMES'));
    assert.ok(!codes.includes('PERFECT_SCORE'));
  });

  test('catálogo público de conquistas', async () => {
    const res = await api.get('/api/stats/achievements');
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 7);
    const codes = res.body.items.map((a) => a.code);
    for (const expected of ['FIRST_GAME', 'FIVE_GAMES', 'TEN_GAMES', 'PERFECT_SCORE', 'TOP_TEN', 'FIRST_PLACE', 'PROPHETS_EXPERT']) {
      assert.ok(codes.includes(expected), expected);
    }
  });

  /* ----------------------------------------------------------- estatísticas */
  test('GET /api/stats devolve o dashboard público', async () => {
    const { token } = await api.register({ nickname: 'estatistica' });
    await api.playGame(token, { wrongAt: [1] });

    const res = await api.get('/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.total_players, 1);
    assert.equal(res.body.total_attempts, 1);
    assert.equal(res.body.total_answers, 20);
    assert.equal(res.body.total_questions, 60);
    assert.equal(res.body.best_percentage, 95);
    assert.ok(res.body.avg_score > 0);
    assert.equal(res.body.most_wrong_question[0].wrong, 1);
    assert.equal(res.body.recent_attempts.length, 1);
  });

  test('GET /api/questions lista o catálogo sem gabarito', async () => {
    const res = await api.get('/api/questions');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 60);
    assert.deepEqual(res.body.distribution, { facil: 24, medio: 24, dificil: 12 });
    assert.ok(!JSON.stringify(res.body.items).includes('correct_answer'));
  });

  test('GET /api/quiz/rules publica a tabela de pontuação', async () => {
    const res = await api.get('/api/quiz/rules');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.points, { facil: 100, medio: 200, dificil: 300 });
    assert.equal(res.body.max_base_score, 4000);
    assert.equal(res.body.quiz_size, 20);
  });

  /* ---------------------------------------------------------------- admin */
  test('admin exige credencial válida', async () => {
    assert.equal((await api.get('/api/admin/overview')).status, 401);
    assert.equal((await api.get('/api/admin/overview', { token: 'errado' })).status, 403);

    const { token } = await api.register();
    assert.equal((await api.get('/api/admin/overview', { token })).status, 403);

    const ok = await api.get('/api/admin/overview', { token: ADMIN_TOKEN });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.stats.total_questions, 60);
    assert.deepEqual(ok.body.distribution, { facil: 24, medio: 24, dificil: 12, inativas: 0 });
  });

  test('admin cadastra, edita e desativa questões', async () => {
    const payload = {
      chapter: 2,
      question: 'Quem interpretou o sonho da estátua para Nabucodonosor?',
      difficulty: 'medio',
      option_a: 'Profetas Menores',
      option_b: 'Ezequiel',
      option_c: 'Jeremias',
      option_d: 'Isaías',
      correct_answer: 'A',
      explanation: 'Profetas Menores 2:19-25: o mistério foi revelado a Profetas Menores em visão noturna.',
      hint: 'Ele recebeu o nome babilônico de Beltessazar.',
      source_type: 'texto_biblico',
    };

    const created = await api.post('/api/admin/questions', payload, { token: ADMIN_TOKEN });
    assert.equal(created.status, 201);
    const id = created.body.question.id;

    const catalog = await api.get('/api/questions');
    assert.equal(catalog.body.total, 61);

    const updated = await api.put(`/api/admin/questions/${id}`, { difficulty: 'dificil' }, { token: ADMIN_TOKEN });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.question.difficulty, 'dificil');

    const invalid = await api.post('/api/admin/questions', { ...payload, option_a: 'Profetas Menores', question: 'x' }, { token: ADMIN_TOKEN });
    assert.equal(invalid.status, 400);

    const duplicatedOptions = await api.post(
      '/api/admin/questions',
      { ...payload, option_b: 'Profetas Menores' },
      { token: ADMIN_TOKEN },
    );
    assert.equal(duplicatedOptions.status, 400);

    const removed = await api.del(`/api/admin/questions/${id}`, { token: ADMIN_TOKEN });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.result, true);
  });

  test('admin visualiza usuários e partidas', async () => {
    const { token } = await api.register({ nickname: 'admin_view' });
    await api.playGame(token, { wrongAt: [1] });

    const users = await api.get('/api/admin/users', { token: ADMIN_TOKEN });
    assert.equal(users.status, 200);
    assert.equal(users.body.total, 1);
    assert.equal(users.body.items[0].attempts, 1);

    const attempts = await api.get('/api/admin/attempts', { token: ADMIN_TOKEN });
    assert.equal(attempts.body.items.length, 1);

    const ranking = await api.get('/api/admin/ranking', { token: ADMIN_TOKEN });
    assert.equal(ranking.body.items.length, 1);

    const role = await api.patch(`/api/admin/users/${users.body.items[0].id}/role`, { role: 'admin' }, { token: ADMIN_TOKEN });
    assert.equal(role.body.role, 'admin');
  });

  /* ------------------------------------------------------------- privacidade */
  test('jogador pode ocultar o perfil e sai do ranking público', async () => {
    const { token, user } = await api.register({ nickname: 'privado' });
    await api.playGame(token, { wrongAt: [1] });

    assert.equal((await api.get('/api/ranking')).body.items.length, 1);

    const patch = await api.patch('/api/users/me', { share_profile: false }, { token });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.user.share_profile, false);

    assert.equal((await api.get('/api/ranking')).body.items.length, 0);
    assert.equal((await api.get('/api/attempts/public')).body.items.length, 0);
    assert.equal((await api.get(`/api/users/${user.id}`)).status, 403);

    // o dono continua vendo o próprio perfil
    const mine = await api.get('/api/users/me/profile', { token });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.stats.attempts, 1);
  });

  test('excluir conta: anonimização preserva agregados e remoção apaga tudo', async () => {
    const anon = await api.register({ nickname: 'vai_anonimizar' });
    await api.playGame(anon.token, { wrongAt: [1] });
    const res = await api.del('/api/users/me', { token: anon.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.mode, 'anonymize');

    const user = await api.repo.getUserById(anon.user.id);
    assert.equal(user.name, 'Conta excluída');
    assert.equal(user.share_profile, false);
    assert.ok(user.nickname.startsWith('jogador_'));

    const deleted = await api.register({ nickname: 'vai_sumir' });
    await api.playGame(deleted.token, { wrongAt: [1] });
    const res2 = await api.del('/api/users/me?mode=delete', { token: deleted.token });
    assert.equal(res2.body.mode, 'delete');
    assert.equal(await api.repo.getUserById(deleted.user.id), null);
    assert.equal((await api.repo.listAttempts({ userId: deleted.user.id })).items.length, 0);
  });

  /* ------------------------------------------------------------ rate limit */
  test('rate limit bloqueia excesso de cadastros (429)', async () => {
    const limited = await startTestApp({ config: { rateLimit: { maxAuth: 3 } } });
    try {
      const statuses = [];
      for (let i = 0; i < 6; i += 1) {
        const res = await limited.post('/api/users', { name: `Jogador ${i}`, nickname: `limite_${i}` });
        statuses.push(res.status);
      }
      assert.ok(statuses.slice(0, 3).every((s) => s === 201), statuses.join(','));
      assert.ok(statuses.slice(3).every((s) => s === 429), statuses.join(','));
    } finally {
      await limited.close();
    }
  });
});
