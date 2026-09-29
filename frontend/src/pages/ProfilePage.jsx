import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { Link } from '../components/Link.jsx';
import { AchievementsGrid } from '../components/Achievements.jsx';
import { LineChart } from '../components/LineChart.jsx';
import { ErrorState, Loading, Modal, StatsGrid } from '../components/ui.jsx';
import { formatDate, formatDurationLabel, formatNumber, formatPercent, medalFor } from '../lib/format.js';

/** Perfil do jogador: posição, recordes, evolução, conquistas e privacidade. */
export function ProfilePage({ segments }) {
  const { user, logout, notify, refreshSession } = useApp();
  const targetId = segments[1] || user?.id;
  const isSelf = Boolean(user) && targetId === user.id;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    const call = isSelf ? api.myProfile() : api.profile(targetId);
    call.then(setData).catch(setError);
  }, [isSelf, targetId]);

  useEffect(load, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <Loading label="Carregando perfil…" />;

  const { stats, rank, achievements, history } = data;

  async function togglePrivacy(event) {
    const share = event.target.checked;
    try {
      await api.updateMe({ share_profile: share });
      await refreshSession();
      notify(share ? 'Perfil visível no ranking.' : 'Perfil ocultado do ranking público.', 'success');
      load();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.deleteMe(deleteMode);
      logout();
      setPrivacyOpen(false);
      notify('Conta excluída. Obrigado por jogar! 🙏', 'success');
      window.location.hash = '#/';
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setDeleteMode(null);
    }
  }

  return (
    <div className="rise">
      <div className="flex between items-center wrap gap-8">
        <div>
          <h1 className="page-title">
            <span className="avatar" style={{ display: 'inline-grid', marginRight: 10, verticalAlign: 'middle' }}>
              {data.user.nickname.slice(0, 1).toUpperCase()}
            </span>
            {data.user.nickname}
          </h1>
          <p className="page-sub">
            {data.user.name} · jogador desde {formatDate(data.user.created_at)}
          </p>
        </div>
        {rank ? (
          <span className="badge badge-gold" style={{ fontSize: '0.9rem', padding: '8px 14px' }}>
            {medalFor(rank) || '🎖️'} {rank}º no ranking geral
          </span>
        ) : (
          <span className="badge badge-muted">fora do ranking</span>
        )}
      </div>

      <StatsGrid
        items={[
          { icon: '🏆', label: 'Melhor pontuação', value: formatNumber(stats.best_score) },
          { icon: '📊', label: 'Melhor percentual', value: formatPercent(stats.best_percentage) },
          { icon: '🎮', label: 'Total de partidas', value: formatNumber(stats.attempts) },
          { icon: '✅', label: 'Total de acertos', value: formatNumber(stats.total_correct) },
        ]}
      />

      <div className="stats-grid mt-16">
        <div className="stat-card"><div className="stat-value num">{formatNumber(stats.avg_score)}</div><div className="stat-label">média de pontos</div></div>
        <div className="stat-card"><div className="stat-value num">{stats.avg_correct}</div><div className="stat-label">média de acertos</div></div>
        <div className="stat-card"><div className="stat-value num">{formatDurationLabel(stats.total_duration)}</div><div className="stat-label">tempo total</div></div>
        <div className="stat-card"><div className="stat-value" style={{ fontSize: '0.9rem' }}>{formatDate(stats.last_attempt_at)}</div><div className="stat-label">última partida</div></div>
      </div>

      <div className="card mt-16">
        <h3 className="card-title">📈 Evolução de pontuação</h3>
        <LineChart
          points={(stats.evolution || []).map((point, index) => ({
            ...point,
            id: `${point.date}-${index}`,
            label: point.date,
          }))}
        />
      </div>

      <div className="card mt-16">
        <h3 className="card-title">🏅 Conquistas</h3>
        <AchievementsGrid items={achievements || []} />
      </div>

      {history?.length > 0 && (
        <div className="card mt-16">
          <h3 className="card-title">🕒 Últimas partidas</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>DATA</th><th className="num">PONTOS</th><th className="num">ACERTOS</th><th className="num">%</th><th className="num">DURAÇÃO</th></tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td>{item.date_label}</td>
                    <td className="num">{item.score_label}</td>
                    <td className="num">{item.correct_answers}/{item.total_questions}</td>
                    <td className="num">{formatPercent(item.percentage)}</td>
                    <td className="num">{item.duration_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSelf && (
        <div className="card mt-16">
          <h3 className="card-title">🔐 Privacidade e conta</h3>
          <label className="flex items-center gap-8" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={data.user.share_profile !== false} onChange={togglePrivacy} />
            <span>Exibir meu apelido e resultados no ranking público</span>
          </label>
          <p className="form-note">
            Guardamos apenas nome, apelido e estatísticas de jogo. Nenhum dado pessoal extra é
            coletado nesta versão.
          </p>
          <button type="button" className="btn btn-danger btn-sm mt-8" onClick={() => setPrivacyOpen(true)}>
            🗑️ Excluir minha conta
          </button>
        </div>
      )}

      {privacyOpen && (
        <Modal title="Excluir minha conta" onClose={() => !busy && setPrivacyOpen(false)}>
          <p className="muted">
            Escolha como deseja remover seus dados. Esta ação não pode ser desfeita.
          </p>
          <div className="btn-row stack">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setDeleteMode('anonymize')}
            >
              😶 Anonimizar (mantém estatísticas agregadas, remove nome/apelido e some do ranking)
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => setDeleteMode('delete')}
            >
              🔥 Apagar tudo (conta, partidas, respostas e conquistas)
            </button>
          </div>
          {deleteMode && (
            <div className="form-error mt-16">
              Confirma a exclusão no modo <strong>{deleteMode === 'delete' ? 'APAGAR TUDO' : 'ANONIMIZAR'}</strong>?
              <div className="btn-row mt-8">
                <button type="button" className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={busy}>
                  {busy ? 'Excluindo…' : 'Sim, excluir'}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setDeleteMode(null)} disabled={busy}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default ProfilePage;
