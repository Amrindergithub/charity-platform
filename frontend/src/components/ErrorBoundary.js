import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '40px', textAlign: 'center',
          color: 'var(--color-text, #E5E2E1)',
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '56px',
            color: 'var(--color-error, #FFB4AB)',
            marginBottom: '16px',
          }}>error</span>
          <h2 style={{
            color: 'var(--color-text, #E5E2E1)',
            marginBottom: '8px',
            fontFamily: "var(--font-headline, 'Space Grotesk', sans-serif)",
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            fontWeight: 700,
          }}>Something went wrong</h2>
          <p style={{
            color: 'var(--color-text-muted, #9A8A83)',
            marginBottom: '24px',
            maxWidth: '500px',
            lineHeight: 1.6,
          }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            style={{
              padding: '12px 32px',
              borderRadius: 'var(--radius, 12px)',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: '#FF5C00',
              color: '#fff',
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              transition: 'var(--transition)',
            }}
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(91, 65, 55, 0.08)',
              border: '1px solid rgba(91, 65, 55, 0.15)',
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'left',
              maxWidth: '600px',
              overflow: 'auto',
              color: 'var(--color-error, #FFB4AB)',
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
