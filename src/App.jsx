import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { usePhone } from './usePhone.js';
import ListView from './components/ListView.jsx';
import Board from './components/Board.jsx';
import ProjectView from './components/ProjectView.jsx';
import Settings from './components/Settings.jsx';
import ImportView from './components/ImportView.jsx';
import HelpView from './components/HelpView.jsx';
import StatsView from './components/StatsView.jsx';
import { MoreView, PhoneTabs } from './components/PhoneNav.jsx';

// Hash routes keep deep links working on IIS without URL rewrite rules:
//   #/            board view
//   #/list        list view (table + export)
//   #/stats       portfolio figures and what needs attention
//   #/p/:id       project overview
//   #/p/:id/:page page inside a project
//   #/settings    configuration: groups, project statuses and properties
//   #/import      import from Microsoft Planner
//   #/help        what Clique is for and how the board is used
//   #/more        phone only: the links that don't fit in the bottom tabs
function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'p' && parts[1]) return { view: 'project', id: parts[1], page: parts[2] || null };
  if (parts[0] === 'list') return { view: 'list' };
  if (parts[0] === 'stats') return { view: 'stats' };
  if (parts[0] === 'settings') return { view: 'settings' };
  if (parts[0] === 'import') return { view: 'import' };
  if (parts[0] === 'help') return { view: 'help' };
  if (parts[0] === 'more') return { view: 'more' };
  return { view: 'board' };
}

// Follows the system preference until the user picks a theme explicitly.
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const apply = useCallback((next, persist) => {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    if (persist) {
      try {
        localStorage.setItem('theme', next);
      } catch {
        // storage unavailable; the choice just won't persist
      }
    }
  }, []);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      let saved = null;
      try {
        saved = localStorage.getItem('theme');
      } catch {
        // ignore
      }
      if (!saved) apply(e.matches ? 'dark' : 'light', false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [apply]);
  return [theme, () => apply(theme === 'dark' ? 'light' : 'dark', true)];
}

// Board and list share one set of filters, remembered in this browser between visits.
const FILTERS_KEY = 'clique-filters';
function useFilters() {
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTERS_KEY));
      return Array.isArray(saved) ? saved.filter((f) => f && typeof f.field === 'string' && Array.isArray(f.values)) : [];
    } catch {
      return [];
    }
  });
  const update = useCallback((next) => {
    setFilters(next);
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; the filters just won't be remembered
    }
  }, []);
  return [filters, update];
}

export function navigate(hash) {
  window.location.hash = hash;
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);
  const [theme, toggleTheme] = useTheme();
  const [filters, setFilters] = useFilters();

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // On a phone each view is its own screen, so it starts at the top. A sub-page of the same project
  // stays put, because the project's tabs are above it.
  const phone = usePhone();
  useEffect(() => {
    if (phone) window.scrollTo(0, 0);
  }, [phone, route.view, route.id]);

  const loadWorkspace = useCallback(() => api.workspace().then(setWorkspace, setError), []);
  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          Clique
        </a>
        <nav>
          <a href="#/" className={route.view === 'board' ? 'active' : ''}>
            Board view
          </a>
          <a href="#/list" className={route.view === 'list' ? 'active' : ''}>
            List view
          </a>
          <a href="#/stats" className={route.view === 'stats' ? 'active' : ''}>
            Stats
          </a>
          <a href="#/settings" className={route.view === 'settings' ? 'active' : ''}>
            Configuration
          </a>
          <a href="#/import" className={route.view === 'import' ? 'active' : ''}>
            Import
          </a>
          <a href="#/help" className={route.view === 'help' ? 'active' : ''}>
            Help
          </a>
        </nav>
        <button className="theme-toggle" onClick={toggleTheme} title="Switch between light and dark mode">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>
      <main>
        {error && <div className="banner error">Could not reach the server: {error.message}</div>}
        {workspace && route.view === 'board' && <Board workspace={workspace} filters={filters} onFilters={setFilters} />}
        {workspace && route.view === 'list' && <ListView workspace={workspace} filters={filters} onFilters={setFilters} />}
        {workspace && route.view === 'stats' && <StatsView workspace={workspace} />}
        {workspace && route.view === 'project' && (
          <ProjectView key={route.id} id={route.id} pageId={route.page} workspace={workspace} />
        )}
        {workspace && route.view === 'settings' && (
          <Settings workspace={workspace} onSaved={setWorkspace} />
        )}
        {workspace && route.view === 'import' && <ImportView workspace={workspace} />}
        {workspace && route.view === 'help' && <HelpView workspace={workspace} />}
        {route.view === 'more' && <MoreView theme={theme} onToggleTheme={toggleTheme} />}
      </main>
      {route.view !== 'project' && <PhoneTabs view={route.view} />}
    </div>
  );
}
