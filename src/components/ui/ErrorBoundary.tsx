/**
 * ErrorBoundary - React Error Boundary component
 *
 * Catches JavaScript errors anywhere in child component tree,
 * logs the error, and displays a fallback UI.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { WarningIcon } from './Icons';

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
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-xl m-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <WarningIcon className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Une erreur est survenue
          </h3>
          <p className="text-red-600 text-sm text-center mb-4 max-w-md">
            {this.state.error?.message || 'Erreur inattendue'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Réessayer
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
