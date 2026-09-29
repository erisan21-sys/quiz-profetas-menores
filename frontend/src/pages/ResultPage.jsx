import { useEffect, useState } from 'react';
import { api, ApiError, copyText, shareResult } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';
import { Link } from '../components/Link.jsx';
import { AchievementsGrid } from '../components/Achievements.jsx';
import { DifficultyBadge, ErrorState, Loading, SourceBadge } from '../components/ui.jsx';
import { formatNumber, formatPercent } from '../lib/format.js';
import { lastResultStore } from '../lib/storage.js';

/** Tela de resultado: números oficiais, posição no ranking e compartilhamento. */
export function ResultPage({ segments }) {
  const attemptId = segments[1];
  const { user, notify } = useApp();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    let alive = true;
    const cached = lastResultStore.read(attemptId);
    if (cached) {
      setResult(cached);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        // O finish é idempotente: para partida já encerrada devolve o resumo oficial.
        const data = await api.finish(attemptId);
        if (alive) {
          lastResultStore.save(data);
          setResult(data);
        }
      } catch (err) {
        if (alive) setError(err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [attemptId]);

  async function onShare() {
    const outcome = await shareResult(result.share_message);
    if (outcome === 'shared') notify('Resultado compartilhado! 🎉', 'success');
    else if (outcome === 'whatsapp') notify('Abrindo o WhatsApp…', 'info');
  }

  async function onCopy() {
    const ok = await copyText(result.share_message);
    notify(ok ? 'Mensagem copiada! 📋' : 'Não foi possível copiar.', ok ? 'success' : 'error');
  }

  if (error) return <ErrorState error={error} />;
  if (!result) return <Loading label="Buscando o resultado oficial…" />;

  const isOwner = user?.id === result.user_id;

  return (
    <div className="rise" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="card result-hero">
        <div className="trophy" aria-hidden="true">🏆</div>
        <h1>PARABÉNS!</h1>
        <p>Você terminou o Quiz dos Profetas Menores.</p>

        <div className="result-numbers">
          <div className="cell"><b>{result.total_questions}</b><span>perguntas</span></div>
          <div className="cell"><b>{result.correct_answers}</b><span>acertos</span></div>
          <div className="cell"><b>{result.wrong_answers}</b><span>erros</span></div>
          <div className="cell"><b>{formatPercent(result.percentage)}</b><span>aproveitamento</span></div>
          <div className="cell"><b>{formatNumber(result.score)}</b><span>pontos</span></div>
        </div>

        <div className="rank-callout">
          {result.rank ? `🎖️ Você ficou em ${result.rank}º lugar.` : 'Sua partida ainda não entrou no ranking.'}
          <small>
            {result.beaten_percentage > 0
              ? `Você superou ${formatPercent(result.beaten_percentage)} dos jogadores.`
              : 'Jogue de novo para subir no ranking!'}
            {isOwner && result.duration_seconds !== null && ` · duração oficial ${formatDuration(result.duration_seconds)}`}
          </small>
        </div>

        {result.bonus_score > 0 && (
          <p className="faint mb-0">
            Pontuação: {formatNumber(result.base_score)} de base + {formatNumber(result.bonus_score)} de bônus
            de aproveitamento.
          </p>
        )}
      </div>

      {result.new_achievements?.length > 0 && (
        <div className="card">
          <h3 className="card-title">🎉 Conquistas desbloqueadas</h3>
          <div className="flex wrap gap-8">
            {result.new_achievements.map((item) => (
              <span key={item.code} className="badge badge-gold">
                {item.icon} {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">📤 Compartilhar resultado</h3>
        <pre
          style={{
            background: '#0d1428',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 12,
            whiteSpace: 'pre-wrap',
            fontSize: '0.86rem',
            margin: 0,
          }}
        >
          {result.share_message}
        </pre>
        <div className="btn-row mt-16">
          <button type="button" className="btn btn-primary" onClick={onShare}>📤 COMPARTILHAR</button>
          <button type="button" className="btn" onClick={onCopy}>📋 COPIAR</button>
        </div>
      </div>

      <div className="btn-row mt-16 stack">
        <Link to="/quiz" className="btn btn-primary"> JOGAR NOVAMENTE</Link>
        <Link to="/historico" className="btn">📜 MEU HISTÓRICO</Link>
        <Link to="/ranking" className="btn">🏆 RANKING</Link>
      </div>

      <div className="card mt-16">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReview(!showReview)}>
          {showReview ? '▾ Ocultar revisão' : '▸ Revisar as 20 questões'}
        </button>
        {showReview && (
          <div className="mt-16">
            {result.review?.map((item) => (
              <div key={item.position} className="card" style={{ boxShadow: 'none' }}>
                <div className="flex between items-center wrap gap-8">
                  <span className="faint">#{item.position}</span>
                  <div className="flex gap-8 items-center wrap">
                    <DifficultyBadge difficulty={item.difficulty} />
                    <SourceBadge source={item.source_type} />
                    <span className={`badge ${item.is_correct ? 'badge-facil' : 'badge-dificil'}`}>
                      {item.is_correct ? '✅' : '❌'} você marcou {item.selected_answer} · gabarito {item.correct_answer}
                    </span>
                  </div>
                </div>
                <p className="mt-8 mb-8"><strong>{item.question}</strong></p>
                <div className="options" style={{ gap: 6 }}>
                  {item.options.map((option) => (
                    <div
                      key={option.letter}
                      className={`option-btn ${option.letter === item.correct_answer ? 'correct' : ''}`}
                      style={{ cursor: 'default', padding: '8px 10px', fontSize: '0.85rem' }}
                    >
                      <span className="option-letter">{option.letter}</span>
                      <span>{option.text}</span>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: '0.86rem' }}>{item.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {result.achievements?.length > 0 && (
        <div className="card mt-16">
          <h3 className="card-title">🏅 Suas conquistas</h3>
          <AchievementsGrid items={result.achievements} compact />
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default ResultPage;
