/**
 * OnboardingStep - Individual step layout wrapper
 *
 * Provides consistent layout for each onboarding wizard step:
 * icon, title, description, and children content area.
 *
 * @module components/onboarding/OnboardingStep
 */

import type { ReactNode } from 'react';

interface OnboardingStepProps {
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Optional icon element rendered above the title */
  icon?: ReactNode;
  /** Step content (interactive elements, selections, etc.) */
  children?: ReactNode;
}

export function OnboardingStep({ title, description, icon, children }: OnboardingStepProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      {icon && (
        <div className="mb-6 text-accent">
          {icon}
        </div>
      )}

      <h2 className="text-2xl font-bold text-on-surface mb-3">
        {title}
      </h2>

      <p className="text-on-surface-secondary mb-8 leading-relaxed">
        {description}
      </p>

      {children && (
        <div className="w-full">
          {children}
        </div>
      )}
    </div>
  );
}
