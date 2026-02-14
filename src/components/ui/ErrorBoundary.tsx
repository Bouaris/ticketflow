/**
 * ErrorBoundary - React Error Boundary component
 *
 * Catches JavaScript errors anywhere in child component tree,
 * logs the error, and displays a fallback UI.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { WarningIcon } from './Icons';
import { fr } from '../../i18n/locales/fr';

// ============================================================
// TYPES
// ============================================================

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Reset key - changing this resets the error state */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================
// COMPONENT
// ============================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state when resetKey changes
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-danger-soft border border-danger rounded-xl m-4">
          <div className="w-12 h-12 bg-danger-soft rounded-full flex items-center justify-center mb-4">
            <WarningIcon className="w-6 h-6 text-danger-text" />
          </div>
          <h3 className="text-lg font-semibold text-danger-text mb-2">
            {fr.error.unknown}
          </h3>
          <p className="text-danger-text text-sm text-center mb-4 max-w-md">
            {this.state.error?.message || fr.error.unknown}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-danger hover:bg-danger text-white rounded-lg font-medium transition-colors"
          >
            {fr.action.refresh}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================
// HOOK FOR PROGRAMMATIC RESET
// ============================================================

/**
 * Generate a reset key that changes when you want to reset error boundaries
 */
export function useErrorBoundaryResetKey(): [number, () => void] {
  const { useState, useCallback } = require('react');
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => setResetKey((k: number) => k + 1), []);
  return [resetKey, reset];
}
