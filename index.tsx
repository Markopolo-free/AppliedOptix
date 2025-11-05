
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Ensure the external store shim is loaded after React and resolves consistently
import 'use-sync-external-store/shim/index.js';
// Import theme CSS for dynamic theming
import './theme.css';

type EBState = { error: any };
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  // Explicitly declare props to satisfy TS type-checking in some strict configs
  declare props: Readonly<{ children: React.ReactNode }>;
  state: EBState = { error: null };
  static getDerivedStateFromError(error: any): EBState {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('App crashed:', error, info);
  }
  render() {
    const err = this.state.error;
    if (err) {
      return (
        <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
          <h1 style={{ color: '#b91c1c' }}>Something went wrong.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(err?.message || err)}</pre>
        </div>
      );
    }
    return (this.props as any).children as any;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Diagnostics: log React version and basic mount info
try {
  // eslint-disable-next-line no-console
  console.log('[diag] React version:', (React as any).version);
} catch {}

const root = ReactDOM.createRoot(rootElement);
try {
  // Disable StrictMode during investigation to avoid double-invocation
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (err: any) {
  // Fallback if React render throws before ErrorBoundary can capture
  console.error('[boot] React render failed:', err);
  try {
    rootElement.style.padding = '16px';
    rootElement.style.fontFamily = 'sans-serif';
    rootElement.style.color = '#b91c1c';
    rootElement.innerText = 'React failed to render: ' + (err?.message || String(err));
  } catch {}
}
