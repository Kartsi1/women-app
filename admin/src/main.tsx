import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './pages/Login';
import Queue from './pages/Queue';
import './index.css';

function App() {
  // Simple conditional on whether a session token has been set — no router needed
  // (internal tool, 1-2 admins, D-03)
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />;
  }
  return <Queue />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
