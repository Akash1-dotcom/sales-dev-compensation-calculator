import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort safety net. Without this, any uncaught render error (e.g. a
 * hand-edited plan JSON with a missing period, or an unexpected parser
 * output) crashes the entire React tree to a blank white page with no
 * explanation. This shows a friendly message instead, and offers a way to
 * clear locally-saved plan/scenario data in case a corrupted value is the
 * cause.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('Compensation Calculator crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  private handleReset = () => {
    localStorage.removeItem('comp-calc:custom-plans');
    localStorage.removeItem('comp-calc:scenarios');
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
        <h1 className="text-base font-semibold text-fg">Something went wrong</h1>
        <p className="max-w-md text-sm text-fg-muted">
          {error.message || 'An unexpected error occurred while rendering the calculator.'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg hover:bg-canvas-subtle"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
          >
            Clear saved plans &amp; reload
          </button>
        </div>
      </div>
    );
  }
}
