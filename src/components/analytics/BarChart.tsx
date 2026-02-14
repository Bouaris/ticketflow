/**
 * BarChart - CSS flexbox-based bar chart component.
 *
 * Uses div elements instead of SVG for natural CSS layout behavior.
 * Fixed-height container prevents overflow. Bars scale as percentage
 * of the max value. Labels truncate with CSS ellipsis.
 *
 * @module components/analytics/BarChart
 */

import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface BarChartProps {
  data: { label: string; value: number; color: string }[];
}

// ============================================================
// CONSTANTS
// ============================================================

const CHART_HEIGHT = 160;

// ============================================================
// COMPONENT
// ============================================================

export function BarChart({ data }: BarChartProps) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-on-surface-faint text-sm">
        {t.empty.noData}
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map(d => d.value));

  return (
    <div>
      {/* Bars area — fixed height, flex items align to bottom */}
      <div className="flex items-end gap-2 px-1" style={{ height: CHART_HEIGHT }}>
        {data.map((item, i) => {
          const heightPct = (item.value / maxValue) * 100;

          return (
            <div
              key={`${item.label}-${i}`}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              {/* Value label above bar */}
              {item.value > 0 && (
                <span className="text-xs font-semibold text-on-surface-secondary mb-1 tabular-nums">
                  {item.value}
                </span>
              )}

              {/* Bar */}
              <div
                className="rounded-t-md mx-auto"
                style={{
                  height: `${heightPct}%`,
                  minHeight: item.value > 0 ? 4 : 0,
                  width: '70%',
                  maxWidth: 80,
                  backgroundColor: item.color,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Baseline + X-axis labels */}
      <div className="border-t border-outline mx-1" />
      <div className="flex gap-2 px-1 pt-2">
        {data.map((item, i) => (
          <div
            key={`lbl-${item.label}-${i}`}
            className="flex-1 min-w-0 text-center"
          >
            <span
              className="text-[11px] leading-tight text-on-surface-muted block truncate"
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
