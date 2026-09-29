import { useEffect } from 'react';

/** Indicador de carregamento padrão. */
export function Loading({ label = 'Carregando…' }) {
  return (
    <div className="center" role="status">
      <div className="spinner" aria-hidden="true" />
      <p className="muted">{label}</p>
    </div>
  );
}

/**
 * Placeholder exibido enquanto o código de uma tela ainda está sendo
 * baixado (React.lazy). Some em fração de segundo em conexões boas; em
 * conexões lentas evita um flash em branco entre a troca de telas.
 */
export function PageSkeleton() {
  return (
    <div className="skeleton-page" aria-hidden="true">
      <div className="skeleton-block" style={{ height: 28, width: '55%' }} />
      <div className="skeleton-block" style={{ height: 14, width: '80%' }} />
      <div className="skeleton-block" style={{ height: 120, width: '100%', marginTop: 8 }} />
      <div className="skeleton-block" style={{ height: 120, width: '100%' }} />
    </div>
  );
}

/** Estado de erro com ação de repetição. */
export function ErrorState({ error, onRetry }) {
  return (
    <div className="card center" role="alert">
      <p className="mb-8">⚠️ {error?.message || 'Algo deu errado.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/**
 * Faixa discreta usada com useResilientQuery: aparece só quando já existe
 * conteúdo em tela (evita telas em branco) e avisa sutilmente que os dados
 * estão sendo atualizados ou que o servidor gratuito está "acordando".
 */
export function RefreshBanner({ waking, refreshing, error, onRetry }) {
  if (!waking && !refreshing && !error) return null;
  if (error) {
    return (
      <p className="faint mb-16" style={{ fontSize: 13 }}>
        ⚠️ Não foi possível atualizar agora; exibindo os últimos dados salvos neste aparelho.{' '}
        {onRetry && (
          <button type="button" className="linklike" onClick={onRetry}>
            Tentar de novo
          </button>
        )}
      </p>
    );
  }
  if (waking) {
    return (
      <p className="faint mb-16" role="status" style={{ fontSize: 13 }}>
        <span className="dot-pulse" aria-hidden="true" /> Acordando o servidor (plano gratuito)…
        exibindo os últimos dados enquanto isso.
      </p>
    );
  }
  return (
    <p className="faint mb-16" role="status" style={{ fontSize: 13 }}>
      <span className="dot-pulse" aria-hidden="true" /> Atualizando…
    </p>
  );
}

/** Modal acessível simples (fecha com ESC e clique fora). */
export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modal" style={wide ? { width: 'min(860px, 100%)' } : undefined}>
        <div className="flex between items-center mb-16">
          <h3 className="mb-0">{title}</h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Grade de cartões de estatística (👥 🎮  📊). */
export function StatsGrid({ items }) {
  return (
    <div className="stats-grid">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className="stat-icon" aria-hidden="true">{item.icon}</div>
          <div className="stat-value num">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Selo de dificuldade. */
export function DifficultyBadge({ difficulty, label }) {
  const map = {
    facil: ['badge-facil', 'Fácil'],
    medio: ['badge-medio', 'Médio'],
    dificil: ['badge-dificil', 'Difícil'],
  };
  const [cls, text] = map[difficulty] || ['badge-muted', difficulty];
  return <span className={`badge ${cls}`}>{label || text}</span>;
}

/** Etiqueta do tipo de fonte da questão. */
export function SourceBadge({ source }) {
  const map = {
    texto_biblico: ['badge-gold', '📖 Texto bíblico'],
    historico: ['badge-muted', '🏛️ Consenso histórico'],
    interpretacao: ['badge-muted', '💭 Interpretação teológica'],
  };
  const [cls, text] = map[source] || ['badge-muted', source];
  return <span className={`badge ${cls}`}>{text}</span>;
}
