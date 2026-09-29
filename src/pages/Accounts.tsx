import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Account, AccountKind, PlatformId, Version } from '../data/types';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { DemoTag, EmptyState, ExternalLink, LoadingGrid, PageHeader, PlatformGlyph, SelectField, StatusPill, useSimulatedLoad } from '../components/ui';
import { formatDay, relativeDay } from '../lib/dates';
import { accountOf, assetOf, ideaOf, platformOf, versionsForAccount } from '../state/selectors';
import { useStore } from '../state/store';

export function AccountsPage() {
  const { accountId } = useParams();
  return accountId ? <AccountDetail accountId={accountId} /> : <AllAccounts />;
}

function AllAccounts() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
  const [adding, setAdding] = useState<PlatformId | null>(null);
  const [filter, setFilter] = useState('all');
  const core = data.platforms.filter((p) => p.tier === 'core' || data.accounts.some((a) => a.platform === p.id));
  const more = data.platforms.filter((p) => !core.includes(p));

  const upcoming = data.versions
    .filter((v) => v.status !== 'Posted' && v.scheduledFor >= data.today && (filter === 'all' || v.accountId === filter))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 8);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Accounts"
        title="Your channels, one notebook"
        lede="Each platform can hold several accounts. Haven keeps the profile and native analytics links — the numbers stay on each platform."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setAdding('instagram')}>
            <Icon name="plus" size={16} /> Add account
          </button>
        }
      />

      <nav className="notebook-tabs" aria-label="Jump to platform">
        {core.map((p) => (
          <a key={p.id} href={`#platform-${p.id}`} style={{ ['--hue' as string]: p.hue }}>
            <PlatformGlyph platform={p} size="sm" /> {p.name}
            <span className="count">{data.accounts.filter((a) => a.platform === p.id).length}</span>
          </a>
        ))}
      </nav>

      {!ready ? (
        <LoadingGrid count={4} label="Loading accounts" />
      ) : (
        <div className="accounts-layout">
          <div className="notebook">
            {core.map((p) => {
              const accounts = data.accounts.filter((a) => a.platform === p.id);
              return (
                <section key={p.id} id={`platform-${p.id}`} className="notebook__page" style={{ ['--hue' as string]: p.hue }} aria-labelledby={`h-${p.id}`}>
                  <header className="notebook__head">
                    <PlatformGlyph platform={p} size="lg" />
                    <h2 id={`h-${p.id}`} className="h2">
                      {p.name}
                    </h2>
                    <span className="muted">
                      {accounts.length} account{accounts.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  {accounts.length === 0 ? (
                    <div className="notebook__empty">
                      <p className="muted">No {p.name} accounts yet.</p>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(p.id)}>
                        <Icon name="plus" size={14} /> Add a {p.name} account
                      </button>
                    </div>
                  ) : (
                    <div className="account-cards">
                      {accounts.map((a) => (
                        <AccountCard key={a.id} account={a} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            <section className="notebook__more" aria-labelledby="more-h">
              <h2 id="more-h" className="h3">
                Room for more channels
              </h2>
              <div className="chip-grid">
                {more.map((p) => (
                  <button key={p.id} type="button" className="chip" style={{ ['--hue' as string]: p.hue }} onClick={() => setAdding(p.id)}>
                    <span className="chip__glyph">{p.glyph}</span>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="panel accounts-side" aria-labelledby="up-h">
            <div className="panel__head">
              <h2 id="up-h" className="h2">
                Planned next
              </h2>
            </div>
            <SelectField label="Account" value={filter} onChange={setFilter}>
              <option value="all">All accounts</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {platformOf(data, a.platform).name} · {a.handle}
                </option>
              ))}
            </SelectField>
            {upcoming.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing planned">
                No upcoming versions for this account.
              </EmptyState>
            ) : (
              <ul className="plan-list">
                {upcoming.map((v) => (
                  <PlanRow key={v.id} version={v} />
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
      {adding && <AddAccountModal initialPlatform={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const { data } = useStore();
  const versions = versionsForAccount(data, account.id);
  const planned = versions.filter((v) => v.status !== 'Posted').length;
  const posted = versions.filter((v) => v.status === 'Posted').length;
  return (
    <article className="account-card">
      <Link to={`/accounts/${account.id}`} className="account-card__main">
        <span className="account-card__kind">{account.kind}</span>
        <span className="account-card__handle">{account.handle}</span>
        <span className="account-card__purpose">{account.purpose}</span>
        <span className="account-card__stats">
          <span>
            <strong>{planned}</strong> planned
          </span>
          <span>
            <strong>{posted}</strong> posted
          </span>
        </span>
      </Link>
      <div className="account-card__links">
        <ExternalLink href={account.profileUrl}>Profile</ExternalLink>
        {account.analyticsUrl ? <ExternalLink href={account.analyticsUrl}>Native analytics</ExternalLink> : <span className="muted small">Analytics in app</span>}
      </div>
    </article>
  );
}

function PlanRow({ version }: { version: Version }) {
  const { data } = useStore();
  const account = accountOf(data, version.accountId)!;
  const idea = ideaOf(data, version.ideaId);
  const art = assetOf(data, version.coverAssetId)?.art ?? idea?.art;
  return (
    <li>
      <Link to={`/ideas/${version.ideaId}/versions?v=${version.id}`} className="plan-row">
        {art && <Cover art={art} ratio="1 / 1" className="plan-row__thumb" />}
        <span className="plan-row__text">
          <span className="plan-row__title">{idea?.title}</span>
          <span className="muted">
            <PlatformGlyph platform={platformOf(data, account.platform)} size="sm" /> {account.handle} · {version.format}
          </span>
        </span>
        <span className="plan-row__when">
          <span>{relativeDay(version.scheduledFor, data.today)}</span>
          <StatusPill status={version.status} />
        </span>
      </Link>
    </li>
  );
}

function AccountDetail({ accountId }: { accountId: string }) {
  const { data } = useStore();
  const ready = useSimulatedLoad(300);
  const account = accountOf(data, accountId);
  if (!account) {
    return (
      <div className="page">
        <EmptyState icon="accounts" title="Account not found" action={<Link className="btn btn--primary" to="/accounts">All accounts</Link>} />
      </div>
    );
  }
  const platform = platformOf(data, account.platform);
  const versions = versionsForAccount(data, account.id);
  const planned = versions.filter((v) => v.status !== 'Posted');
  const posted = versions.filter((v) => v.status === 'Posted');
  const links = data.links.filter((l) => l.accountId === account.id);
  const siblings = data.accounts.filter((a) => a.platform === account.platform);

  return (
    <div className="page account-page" style={{ ['--hue' as string]: platform.hue }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/accounts">Accounts</Link>
        <Icon name="chevronRight" size={14} />
        <span>{platform.name}</span>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">{account.handle}</span>
      </nav>

      <header className="account-hero">
        <PlatformGlyph platform={platform} size="lg" />
        <div>
          <p className="eyebrow">
            {platform.name} · {account.kind}
          </p>
          <h1 className="display">{account.handle}</h1>
          <p className="lede">{account.purpose}</p>
          <div className="account-hero__actions">
            <ExternalLink href={account.profileUrl} className="btn btn--ghost">
              Open profile
            </ExternalLink>
            {account.analyticsUrl ? (
              <ExternalLink href={account.analyticsUrl} className="btn btn--ghost">
                Open {platform.name} analytics
              </ExternalLink>
            ) : (
              <span className="muted">{account.analyticsNote}</span>
            )}
          </div>
          <p className="field-hint">Analytics open on {platform.name}. Haven does not import or display analytics.</p>
        </div>
        {siblings.length > 1 && (
          <nav className="sibling-switch" aria-label={`Other ${platform.name} accounts`}>
            <p className="muted small">{platform.name} accounts</p>
            {siblings.map((s) => (
              <Link key={s.id} to={`/accounts/${s.id}`} className={s.id === account.id ? 'is-active' : ''} aria-current={s.id === account.id ? 'page' : undefined}>
                {s.handle} <span className="muted">{s.kind}</span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      {!ready ? (
        <LoadingGrid count={3} label="Loading account" />
      ) : (
        <div className="account-grid">
          <section className="panel" aria-labelledby="planned-h">
            <div className="panel__head">
              <h2 id="planned-h" className="h2">
                Planned versions
              </h2>
              <Link className="text-link" to={`/calendar?account=${account.id}`}>
                On calendar <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            {planned.length === 0 ? (
              <EmptyState icon="layers" title="Nothing planned for this account">
                Add a version from any idea’s Versions tab.
              </EmptyState>
            ) : (
              <ul className="plan-list">
                {planned.map((v) => (
                  <PlanRow key={v.id} version={v} />
                ))}
              </ul>
            )}
          </section>
          <div className="stack">
            <section className="panel" aria-labelledby="posted-h">
              <h2 id="posted-h" className="h2">
                Published
              </h2>
              {posted.length === 0 ? (
                <p className="muted">No posts recorded yet. Add a live URL on a version after posting.</p>
              ) : (
                <ul className="plain-list">
                  {posted.map((v) => (
                    <li key={v.id}>
                      <Link to={`/ideas/${v.ideaId}/versions?v=${v.id}`}>{ideaOf(data, v.ideaId)?.title}</Link> <span className="muted">· {formatDay(v.scheduledFor)}</span>
                      {v.liveUrl && (
                        <>
                          {' '}
                          <ExternalLink href={v.liveUrl}>live</ExternalLink>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel" aria-labelledby="alinks-h">
              <div className="panel__head">
                <h2 id="alinks-h" className="h2">
                  Links
                </h2>
                <Link className="text-link" to="/links">
                  All links <Icon name="arrowRight" size={14} />
                </Link>
              </div>
              <ul className="plain-list">
                {links.map((l) => (
                  <li key={l.id}>
                    <ExternalLink href={l.url}>{l.label}</ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

const KINDS: AccountKind[] = ['Personal', 'Business', 'Creator', 'Brand', 'Channel'];

function AddAccountModal({ initialPlatform, onClose }: { initialPlatform: PlatformId; onClose: () => void }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const [platform, setPlatform] = useState<PlatformId>(initialPlatform);
  const [handle, setHandle] = useState('');
  const [kind, setKind] = useState<AccountKind>('Personal');
  const [profileUrl, setProfileUrl] = useState('');
  const [analyticsUrl, setAnalyticsUrl] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || !profileUrl.trim()) return;
    dispatch({
      type: 'account/add',
      account: {
        platform,
        handle: handle.trim(),
        displayName: handle.trim().replace(/^@/, ''),
        kind,
        profileUrl: profileUrl.trim(),
        analyticsUrl: analyticsUrl.trim() || undefined,
        analyticsNote: analyticsUrl.trim() ? undefined : 'No analytics link saved.',
        usedToday: false,
        purpose: 'Added in this session.',
      },
    });
    toast('Account added for this session. Haven stores links only — no sign-in or connection.', 'demo');
    onClose();
  };

  return (
    <Modal
      title="Add an account"
      onClose={onClose}
      footer={
        <>
          <DemoTag>Session only</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-account" className="btn btn--primary" disabled={!handle.trim() || !profileUrl.trim()}>
            Add account
          </button>
        </>
      }
    >
      <form id="add-account" className="form" onSubmit={submit}>
        <p className="muted">Haven never asks for your platform password and doesn’t connect to the platform. You’re saving links.</p>
        <label className="field">
          <span>Platform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
            {data.platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Handle or name</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" />
        </label>
        <label className="field">
          <span>Account type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Profile URL</span>
          <input type="url" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://" />
        </label>
        <label className="field">
          <span>Native analytics URL (optional)</span>
          <input type="url" value={analyticsUrl} onChange={(e) => setAnalyticsUrl(e.target.value)} placeholder="https://" />
        </label>
      </form>
    </Modal>
  );
}
