interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

// Tiny inline SVG line chart. Zero deps. Renders the value series scaled to
// fit a fixed box, drawn in the product's brand blue over a hairline grid so
// it reads as part of the same design system as the tables around it.
export function Sparkline({ values, width = 200, height = 40, className = "" }: Props) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return (
      <div className={`flex items-center justify-center text-xs text-slate-400 ${className}`}>
        Not enough data yet
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  // Area under the line
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  // Three evenly spaced hairlines, the same "grid behind the number" the
  // tables use, so a chart never floats on bare white.
  const gridLines = [0.25, 0.5, 0.75].map((f) => height * f);
  const lastX = (values.length - 1) * stepX;
  const lastY = height - ((values[values.length - 1] - min) / range) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      {gridLines.map((y) => (
        <line key={y} x1={0} y1={y} x2={width} y2={y} stroke="#e2e8f0" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
      <polyline points={areaPoints} fill="#006BFE" fillOpacity={0.08} stroke="none" />
      <polyline points={points} fill="none" stroke="#006BFE" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* Last-point dot, a small white halo so it reads over the line. */}
      <circle cx={lastX} cy={lastY} r={4} fill="white" />
      <circle cx={lastX} cy={lastY} r={3} fill="#006BFE" />
    </svg>
  );
}
