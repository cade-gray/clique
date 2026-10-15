import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Board from './components/Board.jsx';
import ProjectView from './components/ProjectView.jsx';
import Settings from './components/Settings.jsx';

// Hash routes keep deep links working on IIS without URL rewrite rules:
//   #/            board
//   #/p/:id       project overview
//   #/p/:id/:page page inside a project
//   #/settings    columns and properties
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'p' && parts[1]) return { view: 'project', id: parts[1], page: parts[2] || null };
  if (parts[0] === 'settings') return { view: 'settings' };
  return { view: 'board' };
}

export function navigate(hash) {
  window.location.hash = hash;
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const loadWorkspace = useCallback(() => api.workspace().then(setWorkspace, setError), []);
  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          Project Tracker
        </a>
        <nav>
          <a href="#/" className={route.view === 'board' ? 'active' : ''}>
            Board
          </a>
          <a href="#/settings" className={route.view === 'settings' ? 'active' : ''}>
            Properties &amp; columns
          </a>
        </nav>
      </header>
      <main>
        {error && <div className="banner error">Could not reach the server: {error.message}</div>}
        {workspace && route.view === 'board' && <Board workspace={workspace} />}
        {workspace && route.view === 'project' && (
          <ProjectView key={route.id} id={route.id} pageId={route.page} workspace={workspace} />
        )}
        {workspace && route.view === 'settings' && (
          <Settings workspace={workspace} onSaved={setWorkspace} />
        )}
      </main>
    </div>
  );
}
