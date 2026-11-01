const TABS = [
  { id: 'board', href: '#/', label: 'Board', views: ['board'], icon: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></> },
  { id: 'list', href: '#/list', label: 'List', views: ['list'], icon: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /> },
  { id: 'workday', href: '#/workday', label: 'Workday', views: ['workday'], icon: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></> },
  { id: 'more', href: '#/more', label: 'More', views: ['more', 'stats', 'settings', 'import', 'help'], icon: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3.4" /> },
];

// The phone's main navigation, in place of the top bar. Styles keep it hidden on larger screens.
export function PhoneTabs({ view }) {
  return (
    <nav className="phone-tabs" aria-label="Main">
      {TABS.map((t) => (
        <a key={t.id} href={t.href} className={t.views.includes(view) ? 'active' : ''} aria-current={t.views.includes(view) ? 'page' : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {t.icon}
          </svg>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

// What doesn't earn a tab of its own on a phone.
export function MoreView({ theme, onToggleTheme }) {
  return (
    <div className="settings more">
      <h2>More</h2>
      <nav className="more-list">
        <a href="#/stats">Stats</a>
        <a href="#/settings">Configuration</a>
        <a href="#/import">Import</a>
        <a href="#/help">Help</a>
        <button onClick={onToggleTheme}>
          <span>Theme</span>
          <span className="muted">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </nav>
    </div>
  );
}
