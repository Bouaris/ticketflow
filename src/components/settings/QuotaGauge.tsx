/**
 * QuotaGauge - Visual quota consumption bars for API usage
 *
 * Shows RPM (requests per minute) and RPD (requests per day) usage bars
 * for the active AI provider. Data is sourced from local sliding-window
 * quota tracking (not real-time API data — Gemini SDK exposes no headers).
 *
 * Polls every 5 seconds so sliding-window values decay automatically.
 */

import { useState, useEffect } from 'react';
import { getQuotaSnapshot, type QuotaSnapshot } from '../../lib/quota-tracker';
import { Progress } from '../ui/Progress';
import { InfoIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

// ============================================================
// TYPES
// ============================================================

interface QuotaGaugeProps {
  providerId: string;
}

// ============================================================
// COMPONENT
// ============================================================

export function QuotaGauge({ providerId }: QuotaGaugeProps) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<QuotaSnapshot>(() => getQuotaSnapshot(providerId));

  // Re-fetch snapshot when provider changes
  useEffect(() => {
    setSnapshot(getQuotaSnapshot(providerId));
  }, [providerId]);

  // Poll every 5 seconds so the sliding window decays in real time
  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshot(getQuotaSnapshot(providerId));
    }, 5000);
    return () => clearInterval(interval);
  }, [providerId]);

  // Determine color based on usage percentage
  const rpmPct = snapshot.rpmLimit > 0 ? (snapshot.rpm / snapshot.rpmLimit) * 100 : 0;
  const rpdPct = snapshot.rpdLimit > 0 ? (snapshot.rpd / snapshot.rpdLimit) * 100 : 0;
  const rpmColor = rpmPct >= 80 ? 'danger' : rpmPct >= 50 ? 'warning' : 'primary';
  const rpdColor = rpdPct >= 80 ? 'danger' : rpdPct >= 50 ? 'warning' : 'primary';

  return (
    <div className="space-y-2">
      {/* Header with tooltip */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-on-surface-secondary">
          {t.settings.quotaUsage}
        </span>
        <span className="relative group/quota">
          <InfoIcon className="w-3 h-3 text-on-surface-faint cursor-help" />
          <span className="hidden group-hover/quota:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 text-xs bg-surface-alt text-on-surface-secondary rounded-lg shadow-lg border border-outline z-50 whitespace-normal">
            {t.settings.quotaEstimated}
          </span>
        </span>
      </div>

      {/* RPM gauge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-on-surface-muted w-16 shrink-0">{t.settings.quotaRpm}</span>
        <Progress value={snapshot.rpm} max={snapshot.rpmLimit} size="sm" color={rpmColor} className="flex-1" />
        <span className="text-xs text-on-surface-muted tabular-nums w-14 text-right">
          {snapshot.rpm}/{snapshot.rpmLimit}
        </span>
      </div>

      {/* RPD gauge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-on-surface-muted w-16 shrink-0">{t.settings.quotaRpd}</span>
        <Progress value={snapshot.rpd} max={snapshot.rpdLimit} size="sm" color={rpdColor} className="flex-1" />
        <span className="text-xs text-on-surface-muted tabular-nums w-14 text-right">
          {snapshot.rpd}/{snapshot.rpdLimit}
        </span>
      </div>
    </div>
  );
}
