import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';
import { accountOf, personOf, platformOf } from '../state/selectors';
import { accessSummary } from '../lib/access';
import { Icon, type IconName } from './Icon';
import { AboutPreviewButton } from './AboutPreview';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { Avatar, DemoTag, useDismiss } from './ui';
import { ProfileSettings } from './ProfileSettings';
import { PALETTES } from '../lib/palettes';

export const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/gallery', label: 'Creation Gallery', icon: 'grid' },
  { to: '/ideas', label: 'Ideas', icon: 'ideas' },
  { to: '/studio', label: 'Video Studio', icon: 'film' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/library', label: 'Raw Library', icon: 'library' },
  { to: '/links', label: 'Links', icon: 'links' },
];

export function HavenMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="haven-mark">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 23V9m14 14V9M9 16h14" stroke="var(--accent-ink)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.2" fill="var(--accent-ink)" />
    </svg>
  );
}

export function AppShell() {
  const [quickAdd, setQuickAdd] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [profile, setProfile] = useState(false);
  const location = useLocation();
  const canCreate = useCanCreateIdea();

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Primary">
        <Link to="/" className="brand" aria-label="Haven — Today">
          <HavenMark />
          <span className="brand__name">Haven</span>
        </Link>
        <WorkspaceSwitcher />
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav__item" title={n.label}>
              <Icon name={n.icon} size={19} />
              <span className="nav__label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-col">
        <Topbar onMenu={() => setDrawer(true)} onProfile={() => setProfile(true)} />
        <PreviewAsBar />
        <RefusalNotice />
        <main id="main" className="main" key={location.pathname.split('/').slice(0, 3).join('/')}>
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="Primary (mobile)">
        {NAV.filter((n) => n.to === '/' || n.to === '/ideas').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tabbar__item">
            <Icon name={n.icon} size={21} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button type="button" className="tabbar__add" onClick={() => setQuickAdd(true)} aria-label="Capture a new idea" disabled={!canCreate}>
          <Icon name="plus" size={24} />
        </button>
        <NavLink to="/gallery" className="tabbar__item">
          <Icon name="grid" size={21} />
          <span>Gallery</span>
        </NavLink>
        <button type="button" className="tabbar__item" onClick={() => setDrawer(true)} aria-label="More sections">
          <Icon name="menu" size={21} />
          <span>More</span>
        </button>
      </nav>

      {drawer && (
        <MobileDrawer
          onClose={() => setDrawer(false)}
          onProfile={() => {
            setDrawer(false);
            setProfile(true);
          }}
        />
      )}
      {profile && <ProfileSettings onClose={() => setProfile(false)} />}
      {quickAdd && <QuickAddModal onClose={() => setQuickAdd(false)} />}
    </div>
  );
}

/** Says why a change was refused, instead of failing silently. */
function RefusalNotice() {
  const { refusal, preview, data } = useStore();
  const toast = useToast();
  const shown = useRef(0);
  useEffect(() => {
    if (!refusal || refusal.at === shown.current) return;
    shown.current = refusal.at;
    const who = preview ? data.people.find((p) => p.id === preview.personId)?.name : undefined;
    toast(`${who ? `${who} can’t do that. ` : 'Not allowed. '}${refusal.reason}`, 'info');
  }, [refusal, preview, data.people, toast]);
  return null;
}

/** Shown while previewing as a collaborator. Honest about what it is. */
function PreviewAsBar() {
  const { data, preview, setPreviewAs } = useStore();
  const navigate = useNavigate();
  if (!preview) return null;
  const person = data.people.find((p) => p.id === preview.personId);
  const member = data.members.find((m) => m.personId === preview.personId);
  return (
    <div className="viewas" role="status">
      <Icon name="user" size={16} />
      <p>
        Previewing as <strong>{person?.name}</strong>
        {member && <span className="viewas__scope"> · {accessSummary(data, member)}</span>}
        <span className="viewas__note"> · Preview only: this tab hides work you can’t see as them. It isn’t security.</span>
      </p>
      <button
        type="button"
        className="btn btn--sm viewas__exit"
        onClick={() => {
          setPreviewAs(null);
          navigate('/team');
        }}
      >
        Back to your view
      </button>
    </div>
  );
}

function WorkspaceSwitcher() {
  const { data } = useStore();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  return (
    <div className="ws" ref={ref}>
      <button type="button" className="ws__btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="ws__avatar">HP</span>
        <span className="ws__text">
          <span className="ws__name">{data.workspace.name}</span>
          <span className="ws__plan">{data.workspace.planLabel}</span>
        </span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="popover ws__menu" role="menu">
          <p className="popover__label">Workspaces</p>
          <button type="button" role="menuitemradio" aria-checked="true" className="popover__item is-active" onClick={close}>
            <span className="ws__avatar ws__avatar--sm">HP</span> {data.workspace.name}
            <Icon name="check" size={14} />
          </button>
          <div className="popover__sep" />
          <Link role="menuitem" className="popover__item" to="/team" onClick={close}>
            <Icon name="user" size={15} /> Team & access
            <span className="soon">Preview</span>
          </Link>
          <p className="ws__later">Billing, storage and settings arrive with real sign-in.</p>
        </div>
      )}
    </div>
  );
}

function Topbar({ onMenu, onProfile }: { onMenu: () => void; onProfile: () => void }) {
  const { theme, toggle, canEdit } = useTheme();
  return (
    <header className="topbar">
      <button type="button" className="icon-btn topbar__menu" onClick={onMenu} aria-label="Open navigation">
        <Icon name="menu" />
      </button>
      <Link to="/" className="topbar__brand" aria-label="Haven — Today">
        <HavenMark size={26} />
      </Link>
      <SearchBox />
      <div className="topbar__actions">
        <span className="topbar__preview">
          <AboutPreviewButton />
        </span>
        <Notifications />
        <button
          type="button"
          className="icon-btn theme-toggle"
          onClick={toggle}
          disabled={!canEdit}
          aria-label={theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'}
          title={!canEdit ? 'Appearance belongs to the person you’re previewing' : theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
          data-testid="theme-toggle"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <MeMenu onProfile={onProfile} />
      </div>
    </header>
  );
}

/** The avatar menu: who you are, and your own settings. */
function MeMenu({ onProfile }: { onProfile: () => void }) {
  const { data, preview } = useStore();
  const { palette, appearance, canEdit } = useTheme();
  const me = personOf(data, data.currentUserId)!;
  const member = data.members.find((m) => m.personId === me.id);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const paletteName = PALETTES.find((p) => p.id === palette)?.name ?? 'Haven';
  const look = `${paletteName} · ${appearance === 'system' ? 'matches device' : appearance === 'dark' ? 'dark' : 'light'}`;
  return (
    <div className="me" ref={ref}>
      <button type="button" className="me__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`Your account: ${me.name}`} data-testid="me-menu">
        <Avatar person={me} size={32} />
      </button>
      {open && (
        <div className="popover me__menu" role="menu">
          <div className="me__who">
            <Avatar person={me} size={40} />
            <div>
              <p className="me__name">{me.name}</p>
              <p className="me__role">{member ? `${member.role[0].toUpperCase()}${member.role.slice(1)} · ${data.workspace.name}` : me.role}</p>
            </div>
          </div>
          <div className="popover__sep" />
          <button
            type="button"
            role="menuitem"
            className="popover__item"
            disabled={!canEdit}
            onClick={() => {
              close();
              onProfile();
            }}
          >
            <Icon name="user" size={15} /> Profile &amp; appearance
            <span className="me__look">{look}</span>
          </button>
          <Link role="menuitem" className="popover__item" to="/team" onClick={close}>
            <Icon name="shield" size={15} /> Team &amp; access
          </Link>
          {!canEdit && preview && <p className="me__note">You’re previewing as {me.name}. Their photo and look are theirs to change.</p>}
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== '/' || target.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const hits: { href: string; label: string; kind: string }[] = [];
    data.ideas.forEach((i) => {
      if ([i.title, i.concept, i.series ?? ''].some((s) => s.toLowerCase().includes(term)))
        hits.push({ href: `/ideas/${i.id}`, label: i.title, kind: i.archived ? 'Idea · archived' : 'Idea' });
    });
    data.accounts.forEach((a) => {
      if ([a.handle, a.displayName, platformOf(data, a.platform).name].some((s) => s.toLowerCase().includes(term)))
        hits.push({ href: `/gallery?account=${a.id}`, label: `${a.displayName} ${a.handle}`, kind: platformOf(data, a.platform).name });
    });
    data.assets.forEach((a) => {
      if ([a.name, ...a.tags].some((s) => s.toLowerCase().includes(term)))
        hits.push({ href: a.inLibrary ? `/library?q=${encodeURIComponent(a.name)}` : `/ideas/${a.ideaIds[0]}/assets`, label: a.name, kind: 'Asset' });
    });
    data.campaigns.forEach((c) => {
      if (c.name.toLowerCase().includes(term)) hits.push({ href: `/campaigns#${c.id}`, label: c.name, kind: 'Campaign' });
    });
    data.links.forEach((l) => {
      if (l.label.toLowerCase().includes(term)) hits.push({ href: `/links?q=${encodeURIComponent(l.label)}`, label: l.label, kind: 'Link' });
    });
    return hits.slice(0, 8);
  }, [q, data]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    navigate(href);
  };

  return (
    <div className="search" ref={ref}>
      <form
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (results[0]) go(results[0].href);
        }}
      >
        <Icon name="search" size={17} className="search__icon" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search"
          aria-label="Search the workspace"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <kbd className="search__kbd">/</kbd>
      </form>
      {open && q.trim() && (
        <div className="popover search__results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="popover__empty">Nothing matches “{q}”. Try a handle, campaign, or file name.</p>
          ) : (
            results.map((r) => (
              <button key={r.kind + r.href + r.label} type="button" role="option" aria-selected="false" className="popover__item" onClick={() => go(r.href)}>
                <span className="search__label">{r.label}</span>
                <span className="search__kind">{r.kind}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const unread = data.notifications.filter((n) => n.unread).length;
  const navigate = useNavigate();
  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="notif__dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="popover notif__panel">
          <div className="notif__head">
            <p className="popover__label">Notifications</p>
            {unread > 0 && (
              <button type="button" className="link-btn" onClick={() => dispatch({ type: 'notifications/read' })}>
                Mark all read
              </button>
            )}
          </div>
          {data.notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`notif__item ${n.unread ? 'is-unread' : ''}`}
              onClick={() => {
                close();
                if (n.href) navigate(n.href);
              }}
            >
              <span>{n.text}</span>
              <span className="notif__when">{n.when}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileDrawer({ onClose, onProfile }: { onClose: () => void; onProfile: () => void }) {
  const { data } = useStore();
  const { canEdit } = useTheme();
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <nav className="drawer" aria-label="All sections">
        <div className="drawer__head">
          <span className="brand">
            <HavenMark />
            <span className="brand__name">Haven</span>
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close navigation">
            <Icon name="close" />
          </button>
        </div>
        <p className="drawer__ws">{data.workspace.name}</p>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav__item" onClick={onClose}>
            <Icon name={n.icon} size={20} />
            <span className="nav__label">{n.label}</span>
          </NavLink>
        ))}
        <NavLink to="/team" className="nav__item" onClick={onClose}>
          <Icon name="shield" size={20} />
          <span className="nav__label">Team & access</span>
        </NavLink>
        {canEdit && (
          <button type="button" className="nav__item" onClick={onProfile}>
            <Icon name="user" size={20} />
            <span className="nav__label">Profile & appearance</span>
          </button>
        )}
        <div className="drawer__about">
          <AboutPreviewButton />
        </div>
      </nav>
    </div>
  );
}

/** Whether the viewer can start a new idea anywhere (any account or Space they can edit). */
export function useCanCreateIdea(): boolean {
  const { data, allowed } = useStore();
  return (
    data.accounts.some((a) => allowed({ type: 'idea/add', title: '', accountIds: [a.id] })) ||
    data.brands.some((b) => allowed({ type: 'idea/add', title: '', accountIds: [], spaceId: b.id }))
  );
}

export function QuickAddModal({ onClose }: { onClose: () => void }) {
  const { data, dispatch, can, allowed } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const toggle = (id: string) => setAccountIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // Only accounts and Spaces this person can edit are offered.
  const accounts = data.accounts.filter((a) => can('edit', a.id));
  const spaceId = data.brands.find((b) => allowed({ type: 'idea/add', title: '', accountIds: [], spaceId: b.id }))?.id;
  const action = { type: 'idea/add' as const, title, campaignId: campaignId || undefined, accountIds, spaceId };
  const permitted = allowed(action);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !permitted) return;
    dispatch(action);
    toast('Idea captured for this session. It will not be saved after reload.', 'demo');
    onClose();
    navigate('/ideas');
  };

  return (
    <Modal
      title="Capture an idea"
      onClose={onClose}
      footer={
        <>
          <DemoTag>Session only</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="quick-add" className="btn btn--primary" disabled={!title.trim() || !permitted}>
            Capture idea
          </button>
        </>
      }
    >
      <form id="quick-add" className="form" onSubmit={submit}>
        <label className="field">
          <span>Working title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Glazing with ash from the fireplace" />
        </label>
        <label className="field">
          <span>Campaign (optional)</span>
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">None</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <legend>Plan versions for</legend>
          {!spaceId && accountIds.length === 0 && <p className="muted field-note">Choose at least one account you can edit.</p>}
          <div className="chip-grid">
            {accounts.map((a) => {
              const p = platformOf(data, a.platform);
              const on = accountIds.includes(a.id);
              return (
                <button type="button" key={a.id} className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(a.id)} style={{ ['--hue' as string]: p.hue }}>
                  <span className="chip__glyph" aria-hidden="true">{p.glyph}</span>
                  <span className="sr-only">{p.name} </span>
                  {accountOf(data, a.id)!.handle}
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
