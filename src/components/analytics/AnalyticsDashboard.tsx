/**
 * AnalyticsDashboard - Main dashboard container.
 *
 * Loads analytics data via useAnalytics and renders metric cards,
 * bar charts, donut charts, and health indicators.
 *
 * @module components/analytics/AnalyticsDashboard
 */

import { useAnalytics } from '../../hooks/useAnalytics';
import { Spinner } from '../ui/Spinner';
import { RefreshIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';
import { MetricCard } from './MetricCard';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { HealthIndicators } from './HealthIndicators';

// ============================================================
// TYPES
// ============================================================

interface AnalyticsDashboardProps {
  projectPath: string;
  projectId: number;
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

export function AnalyticsDashboard({ projectPath, projectId }: AnalyticsDashboardProps) {
  const { metrics, isLoading, refresh } = useAnalytics(projectPath, projectId);
  const { t } = useTranslation();

  // Loading state
  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" label={t.common.loadingDots} />
      </div>
    );
  }

  // Empty state (no metrics or no items)
  if (!metrics || metrics.totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-on-surface-faint gap-4">
        <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
          />
        </svg>
        <p className="text-lg font-medium">{t.empty.noTickets}</p>
      </div>
    );
  }

  const { byType, bySection, byPriority, byEffort, completion, blocked, stale } = metrics;

  return (
    <div className="overflow-y-auto h-[calc(100vh-130px)] px-6 py-6 space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-on-surface">{t.dashboard.title}</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-on-surface-secondary bg-surface border border-outline rounded-lg hover:bg-surface-alt transition-colors disabled:opacity-50"
        >
          <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t.action.refresh}
        </button>
      </div>

      {/* Row 1: Summary metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label={t.dashboard.totalItems}
          value={metrics.totalItems}
          color="blue"
        />
        <MetricCard
          label={t.dashboard.completionRate}
          value={`${completion.completionRate}%`}
          color={completionColor(completion.completionRate)}
          subtitle={`${completion.doneCount} termines / ${completion.inProgressCount} en cours`}
        />
        <MetricCard
          label="Items bloques"
          value={blocked.totalBlocked}
          color={blocked.totalBlocked > 0 ? 'red' : 'gray'}
        />
        <MetricCard
          label="Items en retard"
          value={stale.staleCount}
          color={stale.staleCount > 0 ? 'amber' : 'gray'}
        />
      </div>

      {/* Row 2: Type (bar) + Priority (donut) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-surface rounded-xl shadow-sm border border-outline p-5">
          <h3 className="text-sm font-semibold text-on-surface-secondary mb-3">{t.dashboard.byType}</h3>
          <BarChart data={byType} />
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-outline p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-on-surface-secondary mb-3 self-start">{t.dashboard.byPriority}</h3>
          <DonutChart
            segments={byPriority}
            centerValue={metrics.totalItems}
            centerLabel="tickets"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
            {byPriority.map(p => (
              <div key={p.label} className="flex items-center gap-1.5 text-xs text-on-surface-secondary">
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: p.color }} />
                {p.label} ({p.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Section (bar) + Effort (donut) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-surface rounded-xl shadow-sm border border-outline p-5">
          <h3 className="text-sm font-semibold text-on-surface-secondary mb-3">{t.dashboard.bySeverity}</h3>
          <BarChart data={bySection} />
        </div>
        <div className="bg-surface rounded-xl shadow-sm border border-outline p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-on-surface-secondary mb-3 self-start">{t.dashboard.byEffort}</h3>
          <DonutChart
            segments={byEffort}
            centerValue={metrics.totalItems}
            centerLabel="tickets"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
            {byEffort.map(e => (
              <div key={e.label} className="flex items-center gap-1.5 text-xs text-on-surface-secondary">
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: e.color }} />
                {e.label} ({e.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Health indicators */}
      <div className="bg-surface rounded-xl shadow-sm border border-outline p-5">
        <h3 className="text-sm font-semibold text-on-surface-secondary mb-3">{t.dashboard.recentActivity}</h3>
        <HealthIndicators
          staleCount={stale.staleCount}
          totalActive={stale.totalActive}
          totalBlockers={blocked.totalBlockers}
          totalBlocked={blocked.totalBlocked}
          topBlockers={blocked.topBlockers}
          completionRate={completion.completionRate}
        />
      </div>
    </div>
  );
}
