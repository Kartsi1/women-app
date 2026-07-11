import { StrictMode, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './pages/Login';
import Queue from './pages/Queue';
import Users from './pages/Users';
import Reports from './pages/Reports';
import './index.css';

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    background: active ? '#6200ea' : '#eee',
    color: active ? '#fff' : '#333',
  };
}

function App() {
  // Simple conditional on whether a session token has been set — no router needed
  // (internal tool, 1-2 admins, D-03)
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<'queue' | 'users' | 'reports'>('queue');

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }
  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <button style={tabStyle(view === 'queue')} onClick={() => setView('queue')}>
          Verification Queue
        </button>
        <button style={tabStyle(view === 'users')} onClick={() => setView('users')}>
          Users
        </button>
        <button style={tabStyle(view === 'reports')} onClick={() => setView('reports')}>
          Reports
        </button>
      </nav>
      {view === 'queue' && <Queue />}
      {view === 'users' && <Users />}
      {view === 'reports' && <Reports />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
