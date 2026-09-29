import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { ErrorState, Loading, StatsGrid } from '../components/ui.jsx';
import { formatNumber, formatPercent } from '../lib/format.js';

/** Dashboard público de estatísticas. */
export function StatsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    setStats(null);
    api.stats().then(setStats).catch(setError);
  };

  useEffect(load, []);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!stats) return <Loading label="Calculando estatísticas…" />;

  return (
    <div className="rise">
      <h1 className="page-title">📊 Estatísticas</h1>
      <p className="page-sub">Números agregados de toda a comunidade, calculados no servidor.</p>

      <StatsGrid
        items={[
          { icon: '👥', label: 'Jogadores', value: formatNumber(stats.total_players) },
          { icon: '🎮', label: 'Partidas', value: formatNumber(stats.total_attempts) },
          { icon: '💬', label: 'Respostas', value: formatNumber(stats.total_answers) },
          { icon: '❓', label: 'Perguntas ativas', value: formatNumber(stats.total_questions) },
        ]}
      />

      <div className="stats-grid mt-16">
        <div className="stat-card"><div className="stat-value num">{formatNumber(stats.best_score)}</div><div className="stat-label">maior pontuação</div></div>
        <div className="stat-card"><div className="stat-value num">{formatPercent(stats.best_percentage)}</div><div className="stat-label">melhor percentual</div></div>
        <div className="stat-card"><div className="stat-value num">{formatNumber(stats.avg_score)}</div><div className="stat-label">média de pontuação</div></div>
        <div className="stat-card"><div className="stat-value num">{stats.avg_correct}</div><div className="stat-label">média de acertos</div></div>
      </div>

      <div className="grid-2 mt-16">
        <div className="card">
          <h3 className="card-title">✅ Perguntas mais acertadas</h3>
          <QuestionList items={stats.most_correct_question || []} kind="correct" />
        </div>
        <div className="card">
          <h3 className="card-title">❌ Perguntas mais erradas</h3>
          <QuestionList items={stats.most_wrong_question || []} kind="wrong" />
        </div>
      </div>

      {stats.recent_attempts?.length > 0 && (
        <div className="card mt-16">
          <h3 className="card-title">🕒 Últimos resultados públicos</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>JOGADOR</th><th className="num">PONTOS</th><th className="num">ACERTOS</th><th className="num">%</th><th>DATA</th></tr>
              </thead>
              <tbody>
                {stats.recent_attempts.map((item, index) => (
                  <tr key={`${item.date_label}-${index}`}>
                    <td>{item.nickname}</td>
                    <td className="num">{item.score_label}</td>
                    <td className="num">{item.correct_answers}/{item.total_questions}</td>
                    <td className="num">{formatPercent(item.percentage)}</td>
                    <td>{item.date_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionList({ items, kind }) {
  if (!items.length) return <p className="faint">Sem respostas registradas ainda.</p>;
  return (
    <ol style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item) => (
        <li key={item.question_id} className="mb-8" style={{ fontSize: '0.88rem' }}>
          {item.text}
          <div className="faint">
            {kind === 'correct'
              ? `${item.correct} acertos · ${item.wrong} erros · ${item.accuracy}% de acerto`
              : `${item.wrong} erros · ${item.correct} acertos · ${item.accuracy}% de acerto`}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default StatsPage;
