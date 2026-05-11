interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

// Tiny inline SVG line chart. Zero deps. Renders the value series
// scaled to fit a fixed box.
export function Sparkline({ values, width = 200, height = 40, className = "" }: Props) {
  if (values.length < 2) {
    return <div className={`text-slate-600 text-xs ${className}`}>Not enough data</div>;
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      <polyline points={areaPoints} fill="#f59e0b" fillOpacity={0.1} />
      <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
      {/* Last-point dot */}
      <circle
        cx={(values.length - 1) * stepX}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r={2.5}
        fill="#f59e0b"
      />
    </svg>
  );
}
