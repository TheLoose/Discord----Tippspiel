import React from 'react';
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

const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #13151a; }
  select option { background: #2b2f36; }
  ::-webkit-scrollbar { width: 6px; } 
  ::-webkit-scrollbar-track { background: #1e2228; }
  ::-webkit-scrollbar-thumb { background: #3a3f47; border-radius: 3px; }
`;

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
          <Route index           element={<Dashboard />} />
          <Route path="leagues"     element={<Leagues />} />
          <Route path="teams"       element={<Teams />} />
          <Route path="matchdays"   element={<Matchdays />} />
          <Route path="matches"     element={<Matches />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="*"           element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const styleEl = document.createElement('style');
styleEl.textContent = globalStyles;
document.head.appendChild(styleEl);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
