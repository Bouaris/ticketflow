/**
 * OnboardingWizard - 7-step first-run wizard
 *
 * Guides new users through:
 * 1. Welcome - Introduction to Ticketflow
 * 2. Theme - Light/Dark/System selection (live preview)
 * 3. Language - FR/EN selection (live switch)
 * 4. AI Setup - Provider and API key (optional, skippable)
 * 5. GSD Info - Planning automation overview
 * 6. Shortcuts - Essential keyboard shortcuts overview
 * 7. Ready - Completion with CTA
 *
 * Animated step transitions via motion + AnimatePresence.
 * Full-screen overlay with skip capability from any step.
 *
 * @module components/onboarding/OnboardingWizard
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING_PRESETS } from '../../lib/animation-presets';
import { useTranslation, SUPPORTED_LOCALES } from '../../i18n';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type { Locale } from '../../i18n';
import { SHORTCUTS, formatKeyCombo } from '../../constants/shortcuts';
import { STORAGE_KEYS } from '../../constants/storage';
import { OnboardingStep } from './OnboardingStep';
import { LogoIcon } from '../ui/Icons';
import { AISetupStep } from './AISetupStep';
import { GSDInfoStep } from './GSDInfoStep';
import { track } from '../../lib/telemetry';
import { hasApiKey, getProvider } from '../../lib/ai';

// ── Types ──────────────────────────────────────────────────

interface OnboardingWizardProps {
  /** Called when the user completes or skips onboarding */
  onComplete: () => void;
}

const TOTAL_STEPS = 7;

/** Essential shortcuts to display in the onboarding */
const ESSENTIAL_SHORTCUTS = [
  SHORTCUTS.NEW_ITEM,
  SHORTCUTS.SEARCH_FOCUS,
  SHORTCUTS.COMMAND_PALETTE,
  SHORTCUTS.CHAT_PANEL,
  SHORTCUTS.UNDO,
  SHORTCUTS.VIEW_KANBAN,
  SHORTCUTS.SHOW_HELP,
] as const;

// ── Theme option icons (inline SVG for simplicity) ─────────

function SunIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const { t, locale, setLocale } = useTranslation();
  const { theme, setTheme } = useTheme();

  const goNext = useCallback(() => {
    if (step === TOTAL_STEPS - 1) {
      track('onboarding_completed', {
        steps_completed: TOTAL_STEPS,
        ai_configured: hasApiKey(getProvider()),
      });
      onComplete();
      return;
    }
    setDirection(1);
    setStep(s => s + 1);
  }, [step, onComplete]);

  const goBack = useCallback(() => {
    if (step === 0) return;
    setDirection(-1);
    setStep(s => s - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    track('onboarding_completed', {
      steps_completed: step,
      ai_configured: hasApiKey(getProvider()),
    });
    onComplete();
  }, [step, onComplete]);

  // ── Step slide variants ──────────────────────────────────

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
      opacity: 0,
    }),
  };

  // ── Theme options ────────────────────────────────────────

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: t.onboarding.theme.light, icon: <SunIcon /> },
    { value: 'dark', label: t.onboarding.theme.dark, icon: <MoonIcon /> },
    { value: 'system', label: t.onboarding.theme.system, icon: <MonitorIcon /> },
  ];

  // ── Render steps ─────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <OnboardingStep
            title={t.onboarding.welcome.title}
            description={t.onboarding.welcome.description}
            icon={<LogoIcon className="w-20 h-20" />}
          />
        );

      case 1:
        return (
          <OnboardingStep
            title={t.onboarding.theme.title}
            description={t.onboarding.theme.description}
          >
            <div className="flex gap-4 justify-center">
              {themeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`
                    flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-colors
                    ${theme === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-outline bg-surface text-on-surface-secondary hover:border-accent/50'
                    }
                  `}
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </OnboardingStep>
        );

      case 2:
        return (
          <OnboardingStep
            title={t.onboarding.language.title}
            description={t.onboarding.language.description}
          >
            <div className="flex gap-4 justify-center">
              {SUPPORTED_LOCALES.map(loc => (
                <button
                  key={loc.code}
                  onClick={() => {
                    setLocale(loc.code as Locale);
                    localStorage.setItem(STORAGE_KEYS.LOCALE, loc.code);
                  }}
                  className={`
                    flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-colors
                    ${locale === loc.code
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-outline bg-surface text-on-surface-secondary hover:border-accent/50'
                    }
                  `}
                >
                  <span className="text-2xl">{loc.code === 'fr' ? '\uD83C\uDDEB\uD83C\uDDF7' : '\uD83C\uDDEC\uD83C\uDDE7'}</span>
                  <span className="text-sm font-medium">{loc.label}</span>
                </button>
              ))}
            </div>
          </OnboardingStep>
        );

      case 3:
        return (
          <AISetupStep
            onSkip={goNext}
            onSave={goNext}
          />
        );

      case 4:
        return (
          <GSDInfoStep />
        );

      case 5:
        return (
          <OnboardingStep
            title={t.onboarding.shortcuts.title}
            description={t.onboarding.shortcuts.description}
          >
            <div className="grid grid-cols-2 gap-3 text-left">
              {ESSENTIAL_SHORTCUTS.map(shortcut => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-surface border border-outline"
                >
                  <span className="text-sm text-on-surface truncate">{t.shortcuts[shortcut.label as keyof typeof t.shortcuts] as string}</span>
                  <kbd className="shrink-0 px-2 py-1 text-xs font-mono bg-surface-alt rounded border border-outline text-on-surface-secondary">
                    {formatKeyCombo(shortcut.keys, t.shortcuts)}
                  </kbd>
                </div>
              ))}
            </div>
          </OnboardingStep>
        );

      case 6:
        return (
          <OnboardingStep
            title={t.onboarding.ready.title}
            description={t.onboarding.ready.description}
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        );

      default:
        return null;
    }
  }

  // ── Main render ──────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-surface-alt flex flex-col items-center justify-center p-8">
      {/* Skip button - top right */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 text-sm text-on-surface-secondary hover:text-on-surface transition-colors"
      >
        {t.onboarding.navigation.skip}
      </button>

      {/* Step content with animations */}
      <div className="flex-1 flex items-center justify-center w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING_PRESETS.gentle}
            className="w-full"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="w-full max-w-2xl flex items-center justify-between mt-8">
        {/* Back button */}
        <div className="w-24">
          {step > 0 && (
            <button
              onClick={goBack}
              className="text-sm text-on-surface-secondary hover:text-on-surface transition-colors"
            >
              {t.onboarding.navigation.back}
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`
                h-2 rounded-full transition-all duration-300
                ${i === step ? 'w-6 bg-accent' : 'w-2 bg-outline'}
              `}
            />
          ))}
          <span className="ml-2 text-xs text-on-surface-secondary">
            {step + 1} {t.onboarding.navigation.stepOf} {TOTAL_STEPS}
          </span>
        </div>

        {/* Next / Get Started button */}
        <div className="w-24 flex justify-end">
          <button
            onClick={goNext}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
          >
            {step === TOTAL_STEPS - 1 ? t.onboarding.ready.cta : t.onboarding.navigation.next}
          </button>
        </div>
      </div>
    </div>
  );
}
