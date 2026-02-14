/**
 * DonutChart - Pure SVG donut/ring chart component.
 *
 * Uses stroke-dasharray/dashoffset to create arc segments.
 * Starts from 12 o'clock position via rotation.
 * Responsive: uses viewBox so the chart scales to its container.
 *
 * @module components/analytics/DonutChart
 */

// ============================================================
// TYPES
// ============================================================

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

// ============================================================
// COMPONENT
// ============================================================

export function DonutChart({
  segments,
  size = 180,
  strokeWidth = 26,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Empty/zero-total: show a single gray circle
  if (total === 0 || segments.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto"
        style={{ maxWidth: size, maxHeight: size, width: '100%', height: 'auto' }}
        role="img"
        aria-label="Donut chart - no data"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#9CA3AF"
          fontSize={24}
          fontWeight="bold"
        >
          0
        </text>
        {centerLabel && (
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#9CA3AF"
            fontSize={12}
          >
            {centerLabel}
          </text>
        )}
      </svg>
    );
  }

  // Build segment offsets
  let cumulativeOffset = 0;
  const arcs = segments
    .filter(s => s.value > 0)
    .map(segment => {
      const fraction = segment.value / total;
      const dashLength = fraction * circumference;
      const offset = cumulativeOffset;
      cumulativeOffset += dashLength;
      return {
        ...segment,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: -offset,
      };
    });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto"
      style={{ maxWidth: size, maxHeight: size, width: '100%', height: 'auto' }}
      role="img"
      aria-label="Donut chart"
    >
      {arcs.map((arc, i) => (
        <circle
          key={`${arc.label}-${i}`}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={arc.dashArray}
          strokeDashoffset={arc.dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      {/* Center text */}
      {centerValue !== undefined && (
        <text
          x={cx}
          y={centerLabel ? cy - 8 : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#111827"
          fontSize={22}
          fontWeight="bold"
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#6B7280"
          fontSize={12}
        >
          {centerLabel}
        </text>
      )}
    </svg>
  );
}
