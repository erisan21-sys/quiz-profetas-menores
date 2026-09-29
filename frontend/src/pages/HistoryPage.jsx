import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { Link } from '../components/Link.jsx';
import { DifficultyBadge, ErrorState, Loading, Modal, RefreshBanner, SourceBadge } from '../components/ui.jsx';
import { formatDate, formatDurationLabel, formatNumber, formatPercent } from '../lib/format.js';
import { useResilientQuery } from '../lib/useResilientQuery.js';

/** Meu histórico de partidas + abertura de partidas anteriores. */
export function HistoryPage() {
  const { user } = useApp();
  const [openAttempt, setOpenAttempt] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);

  const {
    data: items, error, waking, refreshing, reload: load,
  } = useResilientQuery(
    user ? `history-${user.id}` : null,
    () => (user ? api.history(user.id, { limit: 100 }).then((data) => data.items) : Promise.resolve(null)),
    [user?.id],
  );

  useEffect(() => {
    if (!openAttempt) {
      setAttemptDetail(null);
      return;
    }
    setAttemptDetail(null);
    api.attempt(openAttempt.id).then(setAttemptDetail).catch(setAttemptDetailError);
    function setAttemptDetailError(err) {
      setAttemptDetail({ error: err });
    }
  }, [openAttempt]);

  if (!user) {
    return (
      <div className="card center">
        <p>Você precisa estar identificado para ver seu histórico.</p>
        <Link to="/entrar?next=/historico" className="btn btn-primary">Entrar no quiz</Link>
      </div>
    );
  }

  return (
    <div className="rise">
      <h1 className="page-title">📜 Meu histórico</h1>
      <p className="page-sub">Todas as suas partidas finalizadas, com data, placar e duração oficial.</p>

      {error && !items && <ErrorState error={error} onRetry={load} />}
      {!items && !error && <Loading label="Carregando partidas…" />}
      {items && <RefreshBanner waking={waking} refreshing={refreshing} error={error} onRetry={load} />}

      {items && items.length === 0 && (
        <div className="card center">
          <p>Nenhuma partida finalizada ainda.</p>
          <Link to="/quiz" className="btn btn-primary">Jogar agora</Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>DATA</th>
                <th className="num">PONTUAÇÃO</th>
                <th className="num">ACERTOS</th>
                <th className="num">ERROS</th>
                <th className="num">PERCENTUAL</th>
                <th className="num">DURAÇÃO</th>
                <th> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date_label}</td>
                  <td className="num"><strong>{item.score_label}</strong></td>
                  <td className="num">{item.correct_answers}/{item.total_questions}</td>
                  <td className="num">{item.wrong_answers}</td>
                  <td className="num">{formatPercent(item.percentage)}</td>
                  <td className="num">{item.duration_label}</td>
                  <td>
                    <button type="button" className="btn btn-sm" onClick={() => setOpenAttempt(item)}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openAttempt && (
        <Modal title={`Partida de ${openAttempt.date_label} · ${openAttempt.score_label} pts`} onClose={() => setOpenAttempt(null)} wide>
          {attemptDetail?.error ? (
            <ErrorState error={attemptDetail.error} />
          ) : !attemptDetail ? (
            <Loading />
          ) : (
            <>
              <div className="stats-grid mb-16">
                <div className="stat-card"><div className="stat-value">{attemptDetail.attempt.correct_answers}</div><div className="stat-label">acertos</div></div>
                <div className="stat-card"><div className="stat-value">{attemptDetail.attempt.wrong_answers}</div><div className="stat-label">erros</div></div>
                <div className="stat-card"><div className="stat-value">{formatPercent(attemptDetail.attempt.percentage)}</div><div className="stat-label">aproveitamento</div></div>
                <div className="stat-card"><div className="stat-value">{formatDurationLabel(attemptDetail.attempt.duration_seconds)}</div><div className="stat-label">duração</div></div>
              </div>

              {attemptDetail.answers.map((answer) => (
                <div key={answer.position} className="card" style={{ boxShadow: 'none' }}>
                  <div className="flex between items-center wrap gap-8">
                    <span className="faint">#{answer.position} · {answer.book_name ? `${answer.book_name} ${answer.chapter}` : `Cap. ${answer.chapter}`}</span>
                    <div className="flex gap-8 wrap">
                      <DifficultyBadge difficulty={answer.difficulty} />
                      <SourceBadge source={answer.source_type} />
                      <span className={`badge ${answer.is_correct ? 'badge-facil' : 'badge-dificil'}`}>
                        {answer.is_correct ? `✅ +${formatNumber(answer.points)}` : `❌ você marcou ${answer.selected_answer}`}
                      </span>
                    </div>
                  </div>
                  <p className="mt-8 mb-8"><strong>{answer.question}</strong></p>
                  <p className="muted mb-0" style={{ fontSize: '0.86rem' }}>
                    Gabarito: <strong>{answer.correct_answer}</strong> — {answer.correct_text}
                  </p>
                  <p className="faint">{answer.explanation}</p>
                </div>
              ))}

              <div className="btn-row mt-16">
                <Link to={`/resultado/${openAttempt.id}`} className="btn btn-primary">Ver tela de resultado</Link>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export default HistoryPage;
