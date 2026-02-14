/**
 * GSDInfoStep - GSD framework information during onboarding
 *
 * Purely informational step that introduces users to GSD (Get Shit Done)
 * automated planning capabilities without requiring any configuration.
 *
 * Features:
 * - 3 feature cards highlighting GSD benefits
 * - CTA box directing to Settings for activation
 * - No user interaction required (wizard's Next button handles navigation)
 *
 * @module components/onboarding/GSDInfoStep
 */

import { OnboardingStep } from './OnboardingStep';
import { useTranslation } from '../../i18n';

interface GSDInfoStepProps {
  // No specific props — uses standard wizard navigation
}

export function GSDInfoStep(_props: GSDInfoStepProps) {
  const { t } = useTranslation();

  const icon = (
    <svg
      className="w-16 h-16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );

  const features = [
    {
      title: t.onboarding.gsdInfo.feature1Title,
      description: t.onboarding.gsdInfo.feature1Desc,
    },
    {
      title: t.onboarding.gsdInfo.feature2Title,
      description: t.onboarding.gsdInfo.feature2Desc,
    },
    {
      title: t.onboarding.gsdInfo.feature3Title,
      description: t.onboarding.gsdInfo.feature3Desc,
    },
  ];

  return (
    <OnboardingStep
      title={t.onboarding.gsdInfo.title}
      description={t.onboarding.gsdInfo.description}
      icon={icon}
    >
      <div className="space-y-6">
        {/* Feature Cards */}
        <div className="space-y-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-4 px-4 py-3 rounded-xl bg-surface border border-outline"
            >
              <svg
                className="w-8 h-8 text-accent flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-on-surface mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-on-surface-secondary">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Box */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/30">
          <svg
            className="w-5 h-5 text-accent mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm text-accent">
            {t.onboarding.gsdInfo.activateInSettings}
          </p>
        </div>
      </div>
    </OnboardingStep>
  );
}
