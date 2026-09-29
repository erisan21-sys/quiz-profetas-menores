import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { ErrorState, Loading } from '../components/ui.jsx';
import { formatDate, formatNumber, formatPercent, medalFor } from '../lib/format.js';

const PERIODS = [
  { id: 'today', label: 'HOJE' },
  { id: 'week', label: 'SEMANA' },
  { id: 'month', label: 'MÊS' },
  { id: 'all', label: 'GERAL' },
];

const MODES = [
  { id: 'all', label: 'TODAS' },
  { id: 'facil', label: 'FÁCIL' },
  { id: 'medio', label: 'MÉDIO' },
  { id: 'dificil', label: 'DIFÍCIL' },
];

/** Ranking público com filtros de período e dificuldade. */
export function RankingPage({ params }) {
  const { user } = useApp();
  const [period, setPeriod] = useState(params.get('periodo') || 'all');
  const [mode, setMode] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setData(null);
    api
      .ranking({ period, difficulty: mode })
      .then((result) => alive && setData(result))
      .catch((err) => alive && setError(err));
    return () => {
      alive = false;
    };
  }, [period, mode]);

  return (
    <div className="rise">
      <h1 className="page-title">🏆 Ranking público</h1>
      <p className="page-sub">
        Classificação oficial calculada no servidor: pontuação → percentual → acertos → recência.
      </p>

      <div className="flex wrap gap-16 mb-16">
        <div className="tabs" role="tablist" aria-label="Período">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              className={period === item.id ? 'active' : ''}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="tabs" role="tablist" aria-label="Dificuldade">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'active' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState error={error} />}
      {!data && !error && <Loading label="Montando o ranking…" />}

      {data && (
        <>
          {data.items.length === 0 ? (
            <div className="card center">
              <p className="mb-0">Nenhuma partida finalizada neste filtro ainda. Seja o primeiro! 🎯</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>POSIÇÃO</th>
                    <th>JOGADOR</th>
                    <th className="num">PONTOS</th>
                    <th className="num">ACERTOS</th>
                    <th className="num">%</th>
                    <th className="num">PARTIDAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.user_id} className={row.user_id === user?.id ? 'rank-me' : ''}>
                      <td className="rank-pos num">
                        {medalFor(row.rank) || `${row.rank}º`}
                      </td>
                      <td>
                        <strong>{row.nickname}</strong>
                        {row.user_id === user?.id && <span className="badge badge-gold" style={{ marginLeft: 6 }}>você</span>}
                      </td>
                      <td className="num"><strong>{formatNumber(row.best_score)}</strong></td>
                      <td className="num">{row.best_correct}/{row.best_total}</td>
                      <td className="num">{formatPercent(row.best_percentage)}</td>
                      <td className="num">{row.attempts_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.me?.outside_page && (
            <p className="faint mt-8">
              Sua posição atual neste filtro: <strong>{data.me.rank}º lugar</strong>.
            </p>
          )}

          <div className="card mt-16">
            <h3 className="card-title">📜 Últimas partidas públicas</h3>
            <PublicAttempts />
          </div>
        </>
      )}
    </div>
  );
}

function PublicAttempts() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.publicAttempts().then(setItems).catch(setError);
  }, []);

  if (error) return <p className="faint">Indisponível no momento.</p>;
  if (!items) return <Loading label="Carregando histórico público…" />;
  if (!items.items.length) return <p className="faint">Nenhuma partida pública ainda.</p>;

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>JOGADOR</th>
            <th className="num">PONTOS</th>
            <th className="num">ACERTOS</th>
            <th className="num">%</th>
            <th>DATA</th>
          </tr>
        </thead>
        <tbody>
          {items.items.slice(0, 15).map((item, index) => (
            <tr key={`${item.finished_at}-${index}`}>
              <td>{item.nickname}</td>
              <td className="num">{formatNumber(item.score)}</td>
              <td className="num">{item.correct_answers}/{item.total_questions}</td>
              <td className="num">{formatPercent(item.percentage)}</td>
              <td>{formatDate(item.finished_at)} {item.time_label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RankingPage;
