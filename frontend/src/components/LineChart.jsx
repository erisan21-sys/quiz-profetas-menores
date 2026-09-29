/**
 * Gráfico de evolução (pontuação por partida) em SVG puro.
 * Sem dependências externas: funciona offline e no preview sandboxed.
 */
export function LineChart({ points = [], height = 180, valueLabel = 'Pontos' }) {
  if (!points.length) {
    return (
      <p className="faint center">
        Ainda não há partidas suficientes para desenhar a evolução. Jogue a primeira! 🎯
      </p>
    );
  }

  const width = 640;
  const padX = 34;
  const padY = 22;
  const values = points.map((p) => Number(p.score) || 0);
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const xFor = (index) =>
    points.length === 1 ? width / 2 : padX + (index * (width - padX * 2)) / (points.length - 1);
  const yFor = (value) => height - padY - ((value - min) / span) * (height - padY * 2);

  const line = points.map((point, index) => `${xFor(index)},${yFor(point.score)}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${xFor(points.length - 1)},${height - padY}`;

  const gridValues = [min, min + span / 2, max];

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Gráfico de evolução: ${valueLabel} por partida`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      {gridValues.map((value, index) => (
        <g key={index}>
          <line className="grid-line" x1={padX} x2={width - padX} y1={yFor(value)} y2={yFor(value)} />
          <text x={4} y={yFor(value) + 4}>{Math.round(value).toLocaleString('pt-BR')}</text>
        </g>
      ))}
      <polygon className="area" points={area} />
      <polyline className="line" points={line} />
      {points.map((point, index) => (
        <circle key={point.id || index} className="dot" cx={xFor(index)} cy={yFor(point.score)} r={4}>
          <title>{`${point.label || `Partida ${index + 1}`}: ${point.score.toLocaleString('pt-BR')} pts · ${point.percentage ?? ''}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default LineChart;
