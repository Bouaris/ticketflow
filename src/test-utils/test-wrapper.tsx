/**
 * Custom test wrappers for React Testing Library
 *
 * Provides renderWithProviders and renderHookWithProviders that wrap
 * all renders with I18nProvider, preventing "useTranslation must be
 * used within an I18nProvider" errors in test files.
 */

import { type ReactNode } from 'react';
import {
  render,
  renderHook,
  type RenderOptions,
  type RenderHookOptions,
} from '@testing-library/react';
import { I18nProvider } from '../i18n';

/** Wraps children in all required providers for testing */
function TestWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider defaultLocale="fr">{children}</I18nProvider>;
}

/** Render with all providers (I18nProvider, etc.) */
function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

/** renderHook with all providers (I18nProvider, etc.) */
function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'>
) {
  return renderHook(hook, { wrapper: TestWrapper, ...options });
}

export { renderWithProviders, renderHookWithProviders, TestWrapper };

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';
