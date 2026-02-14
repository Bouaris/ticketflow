/**
 * HealthIndicators - Health score section with stale/blocked metrics.
 *
 * Renders a grid of MetricCards for backlog health, plus a top-blockers
 * list when applicable.
 *
 * @module components/analytics/HealthIndicators
 */

import { MetricCard } from './MetricCard';
import { WarningIcon, CheckCircleIcon } from '../ui/Icons';

// ============================================================
// TYPES
// ============================================================

interface HealthIndicatorsProps {
  staleCount: number;
  totalActive: number;
  totalBlockers: number;
  totalBlocked: number;
  topBlockers: { itemId: string; blockedCount: number }[];
  completionRate: number;
}

// ============================================================
// HELPERS
// ============================================================

function completionColor(rate: number): 'green' | 'amber' | 'red' {
  if (rate >= 70) return 'green';
  if (rate >= 40) return 'amber';
  return 'red';
}

// ============================================================
// COMPONENT
// ============================================================

export function HealthIndicators({
  staleCount,
  totalBlockers,
  totalBlocked,
  topBlockers,
  completionRate,
}: HealthIndicatorsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Items en retard"
          value={staleCount}
          icon={<WarningIcon className="w-5 h-5" />}
          color={staleCount > 0 ? (staleCount > 5 ? 'red' : 'amber') : 'gray'}
          subtitle="Non mis a jour depuis 30j"
        />
        <MetricCard
          label="Chaines bloquees"
          value={totalBlocked}
          icon={<WarningIcon className="w-5 h-5" />}
          color={totalBlocked > 0 ? 'red' : 'gray'}
        />
        <MetricCard
          label="Bloqueurs"
          value={totalBlockers}
          icon={<WarningIcon className="w-5 h-5" />}
          color={totalBlockers > 0 ? 'amber' : 'gray'}
        />
        <MetricCard
          label="Taux de completion"
          value={`${completionRate}%`}
          icon={<CheckCircleIcon className="w-5 h-5" />}
          color={completionColor(completionRate)}
        />
      </div>

      {topBlockers.length > 0 && (
        <div className="bg-warning-soft border border-warning-text/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-warning-text mb-2">Top bloqueurs</h4>
          <ul className="space-y-1">
            {topBlockers.map(b => (
              <li key={b.itemId} className="text-sm text-amber-700 flex items-center justify-between">
                <span className="font-mono">{b.itemId}</span>
                <span className="text-xs bg-amber-100 rounded-full px-2 py-0.5">
                  bloque {b.blockedCount} item{b.blockedCount > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
