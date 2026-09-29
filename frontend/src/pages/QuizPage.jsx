import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, OfflineError } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { DifficultyBadge, ErrorState, Loading, SourceBadge } from '../components/ui.jsx';
import { formatDurationLabel, formatNumber } from '../lib/format.js';
import { lastResultStore, pendingQueueStore } from '../lib/storage.js';
import { navigate } from '../lib/router.jsx';

const MIN_LOCAL_INTERVAL_MS = 1400; // espelha o anti-macro do servidor (1.2s)

/**
 * Tela do quiz.
 *  • O gabarito chega questão a questão, SOMENTE depois de responder.
 *  • O cronômetro exibido é apenas visual: a duração oficial é do servidor.
 *  • Sem conexão, as respostas ficam em fila local e são sincronizadas depois
 *    (a pontuação só existe quando o servidor confirma).
 */
export function QuizPage({ params }) {
  const { user, online, notify } = useApp();
  const mode = params.get('modo') || 'mixed';
  const prophet = params.get('profeta') || 'todos';

  const [state, setState] = useState({ status: 'loading', error: null });
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [queue, setQueue] = useState(() => pendingQueueStore.read());

  const stateRef = useRef(state);
  stateRef.current = state;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const lockRef = useRef(false);
  const lastSentAtRef = useRef(0);

  const attempt = state.attempt;
  const questions = state.questions || [];
  const question = questions[index];

  /* ------------------------------------------------------------- cronômetro */
  useEffect(() => {
    if (!attempt) return undefined;
    const startedAt = new Date(attempt.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  /* ----------------------------------------------------------- carregamento */
  const load = useCallback(async () => {
    if (!user) {
      navigate('/entrar?next=/quiz');
      return;
    }
    setState({ status: 'loading', error: null });
    try {
      const data = await api.start(mode, prophet);
      const nextIndex = Math.max(0, (data.attempt.next_position || 1) - 1);
      setState({ status: 'playing', attempt: data.attempt, questions: data.questions, resumed: data.resumed });
      setIndex(nextIndex);
      if (data.resumed) notify('Partida anterior retomada. 👍', 'info');
    } catch (err) {
      if (err instanceof OfflineError) {
        setState({ status: 'error', error: new Error('Sem conexão para iniciar a partida. Reconecte e tente de novo.') });
      } else {
        setState({ status: 'error', error: err });
      }
    }
  }, [user, mode, prophet, notify]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, prophet]);

  /* ------------------------------------------------- sincronização offline */
  const pushQueue = useCallback((entry) => {
    setQueue((current) => {
      const next = [...current, entry];
      pendingQueueStore.save(next);
      return next;
    });
  }, []);

  const flushQueue = useCallback(async () => {
    if (lockRef.current || !queueRef.current.length) return;
    lockRef.current = true;
    setSyncing(true);
    const pending = [...queueRef.current];
    const remaining = [];

    for (const entry of pending) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, MIN_LOCAL_INTERVAL_MS));
      try {
        if (entry.type === 'answer') {
          // eslint-disable-next-line no-await-in-loop
          await api.answer(entry.payload);
        } else if (entry.type === 'finish') {
          // eslint-disable-next-line no-await-in-loop
          const result = await api.finish(entry.attempt_id);
          lastResultStore.save(result);
          notify('Partida sincronizada e registrada! 🎉', 'success');
          pendingQueueStore.save([]);
          setQueue([]);
          navigate(`/resultado/${entry.attempt_id}`);
          lockRef.current = false;
          setSyncing(false);
          return;
        }
      } catch (err) {
        if (err instanceof OfflineError) {
          remaining.push(entry);
          break; // ainda offline: guarda o resto
        }
        if (err instanceof ApiError && err.status === 409) {
          continue; // já registrado no servidor: segue em frente
        }
        notify(`Falha ao sincronizar: ${err.message}`, 'error', 6000);
        remaining.push(entry);
      }
    }

    pendingQueueStore.save(remaining);
    setQueue(remaining);
    setSyncing(false);
    lockRef.current = false;
    if (!remaining.length) notify('Conexão restabelecida: respostas sincronizadas. ✅', 'success');
  }, [notify]);

  useEffect(() => {
    if (online && queueRef.current.length) flushQueue();
  }, [online, flushQueue]);

  /* ------------------------------------------------------------- responder */
  async function choose(letter) {
    if (!question || feedback || lockRef.current) return;
    setSelected(letter);

    const now = Date.now();
    const wait = Math.max(0, MIN_LOCAL_INTERVAL_MS - (now - lastSentAtRef.current));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSentAtRef.current = Date.now();

    try {
      const result = await api.answer({
        attempt_id: attempt.id,
        question_id: question.id,
        selected_answer: letter,
      });
      setFeedback(result);
    } catch (err) {
      if (err instanceof OfflineError) {
        pushQueue({ type: 'answer', payload: { attempt_id: attempt.id, question_id: question.id, selected_answer: letter } });
        notify('Sem conexão: resposta guardada na fila local. 📥', 'info', 5000);
        setFeedback({
          offline: true,
          is_correct: null,
          position: index + 1,
          reveal: null,
          progress: null,
        });
      } else if (err instanceof ApiError && err.status === 409 && /já foi respondida/.test(err.message)) {
        notify(err.message, 'error');
      } else {
        notify(err.message || 'Não foi possível registrar a resposta.', 'error');
      }
    }
  }

  function nextQuestion() {
    setFeedback(null);
    setSelected(null);
    setShowHint(false);
    if (index + 1 >= questions.length) {
      finish();
    } else {
      setIndex(index + 1);
    }
  }

  async function finish() {
    setState((current) => ({ ...current, status: 'finishing' }));
    try {
      const result = await api.finish(attempt.id);
      lastResultStore.save(result);
      navigate(`/resultado/${attempt.id}`);
    } catch (err) {
      if (err instanceof OfflineError) {
        pushQueue({ type: 'finish', attempt_id: attempt.id });
        notify('Sem conexão: a finalização está na fila e será enviada ao reconectar.', 'info', 6000);
        setState((current) => ({ ...current, status: 'playing' }));
      } else {
        setState((current) => ({ ...current, status: 'error', error: err }));
      }
    }
  }

  /* ---------------------------------------------------------------- render */
  if (!user) return <Loading label="Preparando sua identificação…" />;
  if (state.status === 'loading') return <Loading label="Sorteando as 20 questões…" />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  const answeredCount = feedback?.progress?.answered ?? (attempt?.answered_count ?? 0);
  const progress = questions.length ? ((index + (feedback ? 1 : 0)) / questions.length) * 100 : 0;

  return (
    <div className="rise" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="quiz-top">
        <div>
          <span className="quiz-progress-text">
            Questão {Math.min(index + 1, questions.length)} de {questions.length}
          </span>
          {queue.length > 0 && (
            <span className="badge badge-gold" style={{ marginLeft: 8 }}>
              {syncing ? 'sincronizando…' : `${queue.length} na fila offline`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-8">
          <span className="faint">TEMPO</span>
          <span className="quiz-timer" aria-label="Tempo decorrido">
            {formatDurationLabel(elapsed)}
          </span>
        </div>
      </div>

      <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${progress}%` }} />
      </div>

      {state.status === 'finishing' ? (
        <Loading label="Calculando seu resultado oficial no servidor…" />
      ) : (
        question && (
          <div className="card question-card">
            <div className="flex between items-center wrap gap-8 mb-8">
              <div className="flex gap-8 items-center wrap">
                <DifficultyBadge difficulty={question.difficulty} />
                <span className="badge badge-muted">{question.book_name ? `${question.book_name} ${question.chapter}` : `Cap. ${question.chapter}`}</span>
                <span className="badge badge-gold">+{formatNumber(question.points)} pts</span>
              </div>
              <SourceBadge source={question.source_type} />
            </div>

            <h2 className="question-text">{question.question}</h2>

            {!showHint && !feedback && (
              <button type="button" className="btn btn-sm btn-ghost mb-8" onClick={() => setShowHint(true)}>
                💡 Ver dica
              </button>
            )}
            {showHint && !feedback && <div className="hint-box">💡 {question.hint}</div>}

            <div className="options" role="radiogroup" aria-label="Alternativas">
              {question.options.map((option) => {
                let cls = 'option-btn';
                if (feedback && !feedback.offline) {
                  if (option.letter === feedback.reveal?.correct_answer) cls += ' correct';
                  else if (option.letter === selected && !feedback.is_correct) cls += ' wrong';
                } else if (selected === option.letter) {
                  cls += ' selected';
                }
                return (
                  <button
                    key={option.letter}
                    type="button"
                    className={cls}
                    disabled={Boolean(feedback)}
                    onClick={() => choose(option.letter)}
                  >
                    <span className="option-letter">{option.letter}</span>
                    <span>{option.text}</span>
                  </button>
                );
              })}
            </div>

            {feedback && !feedback.offline && (
              <div className={`feedback ${feedback.is_correct ? 'ok' : 'err'}`}>
                <div className="feedback-title">
                  {feedback.is_correct
                    ? `✅ Correto! +${formatNumber(feedback.points_earned)} pontos`
                    : `❌ Incorreto. A resposta era ${feedback.reveal?.correct_answer}.`}
                </div>
                <SourceBadge source={feedback.reveal?.source_type} />
                <p>{feedback.reveal?.explanation}</p>
                <div className="mt-8 faint">
                  Placar oficial: {feedback.progress.correct} acertos · {feedback.progress.wrong} erros ·{' '}
                  {formatNumber(feedback.progress.score)} pontos
                </div>
              </div>
            )}

            {feedback?.offline && (
              <div className="feedback err">
                <div className="feedback-title">📥 Resposta guardada na fila offline</div>
                <p>
                  O resultado oficial só existe após a confirmação do servidor. Assim que a conexão
                  voltar, enviaremos tudo automaticamente.
                </p>
              </div>
            )}

            {feedback && (
              <div className="btn-row mt-16">
                <button type="button" className="btn btn-primary" onClick={nextQuestion}>
                  {index + 1 >= questions.length ? '🏁 VER RESULTADO' : 'PRÓXIMA QUESTÃO →'}
                </button>
              </div>
            )}
          </div>
        )
      )}

      <p className="faint center mt-16">
        Pontuação oficial: fácil 100 · médio 200 · difícil 300 · bônus de aproveitamento
        (100%: +500 · 90–99%: +300 · 80–89%: +150). Sem pontuação negativa.
        <br />
        O tempo oficial é medido pelo relógio do servidor, não pelo do seu aparelho.
      </p>
    </div>
  );
}

export default QuizPage;
