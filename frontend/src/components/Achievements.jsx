import { formatDate } from '../lib/format.js';

/** Grade de conquistas (desbloqueadas em destaque). */
export function AchievementsGrid({ items = [], compact = false }) {
  if (!items.length) {
    return <p className="faint">Nenhuma conquista cadastrada ainda.</p>;
  }
  return (
    <div className="achievement-grid">
      {items.map((item) => (
        <div key={item.code} className={`achievement ${item.unlocked ? 'unlocked' : ''}`}>
          <div className="icon" aria-hidden="true">{item.icon}</div>
          <b>{item.name}</b>
          {!compact && <span>{item.description}</span>}
          <span className="faint">
            {item.unlocked ? `Desbloqueada em ${formatDate(item.unlocked_at)}` : 'Bloqueada'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default AchievementsGrid;
