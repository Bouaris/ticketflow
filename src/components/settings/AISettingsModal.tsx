/**
 * AI Settings Modal - AI-specific settings
 *
 * Handles AI provider selection, API key configuration, custom providers, questioning mode, and feedback stats.
 * Extracted from monolithic SettingsModal.tsx (Phase 23).
 */

import { useState, useEffect } from 'react';
import { BUILT_IN_PROVIDERS } from '../../lib/ai-provider-registry';
import { getProvider, setProvider } from '../../lib/ai';
import { ProviderCard } from './ProviderCard';
import { CustomProviderList } from './CustomProviderList';
import { getFeedbackStats, type FeedbackStats } from '../../lib/ai-feedback';
import { getOrCreateProject } from '../../db/queries/projects';
import { StarIcon, TrendUpIcon, TrendDownIcon, MinusIcon, InfoIcon } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { useTranslation } from '../../i18n';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath?: string;
}

export function AISettingsModal({ isOpen, onClose, projectPath }: AISettingsModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'providers' | 'custom'>('providers');
  const [selectedProvider, setSelectedProvider] = useState(getProvider());
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  // AI Questioning mode toggle
  const [questioningEnabled, setQuestioningEnabled] = useState(
    localStorage.getItem('ticketflow-questioning-mode') !== 'false'
  );

  // Load feedback stats when modal opens and projectPath exists
  useEffect(() => {
    if (isOpen && projectPath) {
      const projectName = projectPath.split(/[\\/]/).pop() || 'Project';
      getOrCreateProject(projectPath, projectName)
        .then(projectId => getFeedbackStats(projectId))
        .then(setFeedbackStats)
        .catch(() => setFeedbackStats(null));
    }
  }, [isOpen, projectPath]);

  // Load current provider when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(getProvider());
    }
  }, [isOpen]);

  const handleQuestioningToggle = () => {
    const newValue = !questioningEnabled;
    setQuestioningEnabled(newValue);
    localStorage.setItem('ticketflow-questioning-mode', String(newValue));
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId as any);
    setProvider(providerId as any);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.title}
      size="lg"
    >
      <div className="space-y-5">
        {/* Tab Navigation */}
        <div className="border-b border-outline -mx-6 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('providers')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'providers'
                  ? 'text-accent-text'
                  : 'text-on-surface-muted hover:text-on-surface-secondary'
              }`}
            >
              Built-in Providers {/* TODO: i18n */}
              {activeTab === 'providers' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === 'custom'
                  ? 'text-accent-text'
                  : 'text-on-surface-muted hover:text-on-surface-secondary'
              }`}
            >
              Custom Providers {/* TODO: i18n */}
              {activeTab === 'custom' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'providers' && (
          <div className="space-y-5">
            {/* Provider Cards */}
            <div>
              <label className="block text-sm font-medium text-on-surface-secondary mb-3">
                {t.settings.aiProviderDefault}
              </label>
              <div className="grid grid-cols-1 gap-4">
                {BUILT_IN_PROVIDERS.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    isActive={selectedProvider === provider.id}
                    onSelect={() => handleProviderSelect(provider.id)}
                  />
                ))}
              </div>
            </div>

            {/* AI Questioning Mode Toggle */}
            <div className="pt-4 border-t border-outline">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.questioningMode}</h4>
                  <p className="text-xs text-on-surface-muted">
                    {t.settings.questioningModeDesc}
                  </p>
                </div>
                <button
                  onClick={handleQuestioningToggle}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                    questioningEnabled ? 'bg-accent' : 'bg-outline-strong'
                  }`}
                  role="switch"
                  aria-checked={questioningEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      questioningEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* AI Feedback Stats */}
            {projectPath && (
              <div className="pt-4 border-t border-outline">
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-on-surface-secondary">{t.settings.aiLearning}</h4>
                  <p className="text-xs text-on-surface-muted">
                    {t.settings.aiLearningDesc}
                  </p>
                </div>

                {feedbackStats && feedbackStats.totalFeedback > 0 ? (
                  <div className="space-y-3">
                    {/* Average rating and count */}
                    <div className="flex items-center gap-3 bg-surface-alt px-3 py-2.5 rounded-lg">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <StarIcon
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(feedbackStats.averageRating)
                                ? 'text-amber-400'
                                : 'text-on-surface-faint'
                            }`}
                            filled={star <= Math.round(feedbackStats.averageRating)}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-on-surface-secondary">
                        {feedbackStats.averageRating.toFixed(1)} / 5
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        ({feedbackStats.totalFeedback} {t.settings.evaluations})
                      </span>
                    </div>

                    {/* Trend indicator */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-alt">
                      {feedbackStats.trend === 'improving' && (
                        <>
                          <TrendUpIcon className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700">{t.settings.improving}</span>
                        </>
                      )}
                      {feedbackStats.trend === 'stable' && (
                        <>
                          <MinusIcon className="w-4 h-4 text-on-surface-muted" />
                          <span className="text-sm text-on-surface-secondary">{t.settings.stable}</span>
                        </>
                      )}
                      {feedbackStats.trend === 'declining' && (
                        <>
                          <TrendDownIcon className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">{t.settings.declining}</span>
                        </>
                      )}
                      {feedbackStats.trend === 'insufficient' && (
                        <>
                          <InfoIcon className="w-4 h-4 text-on-surface-faint" />
                          <span className="text-sm text-on-surface-muted">
                            {t.settings.needMoreFeedback}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-faint italic">
                    {t.settings.noFeedback}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'custom' && (
          <div>
            <CustomProviderList />
          </div>
        )}
      </div>
    </Modal>
  );
}
