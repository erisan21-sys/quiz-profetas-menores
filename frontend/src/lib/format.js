/** Utilidades de formatação pt-BR compartilhadas pelo frontend. */

export const formatNumber = (value) => (Number(value) || 0).toLocaleString('pt-BR');

export const formatPercent = (value) => `${Number(value || 0).toFixed(value % 1 ? 1 : 0).replace('.', ',')}%`;

export function formatDurationLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

export const DIFFICULTY_LABEL = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
  mixed: 'Todas',
  all: 'Todas',
};

export const DIFFICULTY_BADGE = {
  facil: 'badge-facil',
  medio: 'badge-medio',
  dificil: 'badge-dificil',
};

export const SOURCE_LABEL = {
  texto_biblico: 'Texto bíblico',
  historico: 'Consenso histórico',
  interpretacao: 'Interpretação teológica',
};

export function ordinalLabel(rank) {
  if (!rank) return '—';
  return `${rank}º`;
}

export function medalFor(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}
