import React, { Suspense, Component } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import Login       from './pages/Login';
import Layout      from './components/Layout';
import Dashboard   from './pages/Dashboard';
import Leagues     from './pages/Leagues';
import Teams       from './pages/Teams';
import Matchdays   from './pages/Matchdays';
import Matches     from './pages/Matches';
import Leaderboard from './pages/Leaderboard';
import Settings    from './pages/Settings';
import Logs        from './pages/Logs';

const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #13151a; }
  select option { background: #2b2f36; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #1e2228; }
  ::-webkit-scrollbar-thumb { background: #3a3f47; border-radius: 3px; }
  @media (max-width: 767px) {
    input, select, textarea { font-size: 16px !important; width: 100% !important; }
    .form-grid { grid-template-columns: 1fr !important; }
  }
`;

// Error boundary — catches any crash and shows a message instead of blank screen
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', gap: 12 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <pre style={{ color: '#ed4245', fontSize: 12, maxWidth: 600, whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
      Loading...
    </div>
  );

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index            element={<Dashboard />} />
          <Route path="leagues"      element={<Leagues />} />
          <Route path="teams"        element={<Teams />} />
          <Route path="matchdays"    element={<Matchdays />} />
          <Route path="matches"      element={<Matches />} />
          <Route path="leaderboard"  element={<Leaderboard />} />
          <Route path="settings"     element={<Settings />} />
          <Route path="logs"         element={<Logs />} />
          <Route path="*"            element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const styleEl = document.createElement('style');
styleEl.textContent = globalStyles;
document.head.appendChild(styleEl);

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
