import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { VERSION_STATUSES, type Idea, type Version, type VersionStatus } from '../../data/types';
import { Cover } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { PostPreview } from '../../components/PostPreview';
import { FinishedVideoField } from './FinishedVideoField';
import { InfoButton } from '../../components/InfoButton';
import { PhotoViewer, photosOf } from '../Gallery';
import { creationMedia } from '../../lib/creations';
import { useToast } from '../../components/Toast';
import { DemoTag, EmptyState, ExternalLink, PlatformGlyph, Progress, StatusPill } from '../../components/ui';
import { formatDay, formatDuration } from '../../lib/dates';
import { accountOf, assetsForIdea, checklistProgress, platformOf, versionsForIdea } from '../../state/selectors';
import { useStore } from '../../state/store';

const LANG_LABEL: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', ja: '日本語' };

export function IdeaVersions({ idea }: { idea: Idea }) {
  const { data, dispatch } = useStore();
  const [params, setParams] = useSearchParams();
  const versions = versionsForIdea(data, idea.id);
  const selectedId = params.get('v') ?? versions[0]?.id;
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];
  const unused = data.accounts.filter((a) => !versions.some((v) => v.accountId === a.id));
  const [adding, setAdding] = useState('');

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('v', id);
    setParams(next, { replace: true });
  };

  // Group by platform so multiple accounts on one platform sit together.
  const groups = data.platforms
    .map((p) => ({ platform: p, versions: versions.filter((v) => accountOf(data, v.accountId)?.platform === p.id) }))
    .filter((g) => g.versions.length);

  return (
    <div className="versions">
      <div className="versions__list">
        <p className="versions__intro">
          <span>
            {versions.length} version{versions.length === 1 ? '' : 's'} · {groups.length} platform{groups.length === 1 ? '' : 's'}
          </span>
          <InfoButton k="versions" />
        </p>
        {groups.map(({ platform, versions: vs }) => (
          <div key={platform.id} className="vgroup">
            <p className="vgroup__label">
              <PlatformGlyph platform={platform} size="sm" /> {platform.name}
              {vs.length > 1 && <span className="vgroup__count">{vs.length} accounts</span>}
            </p>
            <ul>
              {vs.map((v) => {
                const account = accountOf(data, v.accountId)!;
                const { ratio, done, total } = checklistProgress(v);
                return (
                  <li key={v.id}>
                    <button type="button" className={`vrow ${selected?.id === v.id ? 'is-active' : ''}`} onClick={() => select(v.id)} aria-current={selected?.id === v.id}>
                      <span className="vrow__top">
                        <span className="vrow__glyph">
                          <PlatformGlyph platform={platform} size="sm" />
                        </span>
                        <span className="vrow__handle">{account.handle}</span>
                      </span>
                      <span className="vrow__meta">
                        {v.format} · {v.aspect} · {formatDay(v.scheduledFor)}
                      </span>
                      <span className="vrow__foot">
                        <StatusPill status={v.status} />
                        <span className="vrow__check">
                          <Progress value={ratio} label={`Checklist ${done} of ${total}`} tone={ratio === 1 ? 'ok' : 'accent'} />
                          <span className="muted">
                            {done}/{total}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {unused.length > 0 && (
          <form
            className="vadd"
            onSubmit={(e) => {
              e.preventDefault();
              if (!adding) return;
              dispatch({ type: 'version/add', ideaId: idea.id, accountId: adding });
              setAdding('');
            }}
          >
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a version for account">
              <option value="">Plan another account…</option>
              {unused.map((a) => (
                <option key={a.id} value={a.id}>
                  {platformOf(data, a.platform).name} · {a.handle}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--ghost btn--sm" disabled={!adding}>
              <Icon name="plus" size={14} /> Add version
            </button>
          </form>
        )}
      </div>

      {selected ? (
        <VersionDetail key={selected.id} version={selected} idea={idea} />
      ) : (
        <EmptyState icon="layers" title="No versions yet">
          Plan a version for each account you want this idea on — two Instagram accounts can each have their own cut, cover and caption.
        </EmptyState>
      )}
    </div>
  );
}

function VersionDetail({ version, idea }: { version: Version; idea: Idea }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const account = accountOf(data, version.accountId)!;
  const platform = platformOf(data, account.platform);
  const langs = Object.keys(version.captions);
  const [lang, setLang] = useState(langs[0] ?? 'en');
  const [liveUrl, setLiveUrl] = useState(version.liveUrl ?? '');
  const covers = assetsForIdea(data, idea.id).filter((a) => a.kind === 'cover' || a.kind === 'photo');
  const { done, total } = checklistProgress(version);
  const ready = done === total;
  const caption = version.captions[lang] ?? '';
  const captionLimit = account.platform === 'tiktok' ? 4000 : account.platform === 'youtube' ? 5000 : 2200;

  return (
    <div className="vdetail" aria-label={`Version for ${account.handle}`}>
      <header className="vdetail__head">
        <div>
          <p className="eyebrow">
            <PlatformGlyph platform={platform} size="sm" /> {platform.name} · {account.kind}
          </p>
          <h2 className="h2">
            <PlatformGlyph platform={platform} size="sm" />
            {account.handle} <span className="muted">· {platform.name} {version.format}</span>
          </h2>
        </div>
        <label className="status-select">
          <span className="sr-only">Version status</span>
          <select
            aria-label="Version status"
            value={version.status}
            onChange={(e) => {
              const status = e.target.value as VersionStatus;
              if (status === 'Posted' && !version.liveUrl) {
                toast('Add the live URL below after you post natively — Haven can’t confirm a post by itself.', 'info');
                return;
              }
              dispatch({ type: 'version/status', versionId: version.id, status });
            }}
          >
            {VERSION_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="vdetail__stage-row">
        {creationMedia(version) === 'photos' && photosOf(data, version).length > 0 ? (
          <section className="vstage" aria-labelledby={`fp-${version.id}`}>
            <div className="vstage__head">
              <h3 id={`fp-${version.id}`} className="vstage__title">
                Finished photos
              </h3>
              <Link to={`/gallery/${version.id}`} className="text-link">
                View in Creation Gallery <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <PhotoViewer photos={photosOf(data, version)} />
          </section>
        ) : (
          <FinishedVideoField version={version} />
        )}
        <PlatformPreview version={version} lang={lang} />
      </div>

      <div className="vdetail__grid">
        <div className="vdetail__form">
          {covers.length > 0 && (
            <section className="field-group">
              <h3 className="h3">Cover / opening frame</h3>
              <div className="cover-pick" role="radiogroup" aria-label="Cover">
                {covers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={version.coverAssetId === c.id}
                    className={version.coverAssetId === c.id ? 'is-active' : ''}
                    onClick={() => dispatch({ type: 'version/cover', versionId: version.id, assetId: c.id })}
                    title={c.name}
                  >
                    <Cover art={c.art} ratio={version.aspect === '16:9' ? '16 / 9' : '4 / 5'} />
                    <span className="sr-only">{c.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {version.title !== undefined && (
            <section className="field-group">
              <h3 className="h3">Title</h3>
              <p>{version.title}</p>
            </section>
          )}

          <section className="field-group">
            <div className="field-group__head">
              <h3 className="h3">Caption</h3>
              {langs.length > 1 && (
                <div className="tabs tabs--pill tabs--sm" role="tablist" aria-label="Caption language">
                  {langs.map((l) => (
                    <button key={l} type="button" role="tab" aria-selected={lang === l} className={lang === l ? 'is-active' : ''} onClick={() => setLang(l)}>
                      {LANG_LABEL[l] ?? l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              rows={5}
              value={caption}
              aria-label={`Caption (${LANG_LABEL[lang] ?? lang})`}
              placeholder={`Write the ${platform.name} caption for ${account.handle}`}
              onChange={(e) => dispatch({ type: 'version/caption', versionId: version.id, lang, text: e.target.value })}
            />
            <p className="field-hint">
              {caption.length.toLocaleString()} / {captionLimit.toLocaleString()} characters · written by you; Haven doesn’t generate or translate captions.
            </p>
            {version.tags.length > 0 && (
              <p className="tags">
                {version.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </p>
            )}
            {version.links.length > 0 && (
              <p className="tags">
                {version.links.map((l) => (
                  <ExternalLink key={l} href={l}>
                    {l.replace(/^https?:\/\//, '')}
                  </ExternalLink>
                ))}
              </p>
            )}
          </section>

          {version.onScreenText.length > 0 && (
            <section className="field-group">
              <h3 className="h3">On-screen text plan</h3>
              <ul className="timed">
                {version.onScreenText.map((o) => (
                  <li key={o.id}>
                    <span className="mono">{formatDuration(o.t)}</span> {o.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="field-group">
            <div className="field-group__head">
              <h3 className="h3">Ready-to-post checklist</h3>
              <span className="muted">
                {done}/{total}
              </span>
            </div>
            <ul className="checklist">
              {version.checklist.map((c) => (
                <li key={c.id}>
                  <label>
                    <input type="checkbox" checked={c.done} onChange={() => dispatch({ type: 'version/check', versionId: version.id, itemId: c.id })} />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="field-group">
            <h3 className="h3">Schedule</h3>
            <label className="inline-field">
              <span>Planned for</span>
              <input
                type="date"
                value={version.scheduledFor}
                onChange={(e) => e.target.value && dispatch({ type: 'version/reschedule', versionId: version.id, date: e.target.value })}
              />
            </label>
          </section>

          <section className="post-box" aria-labelledby="post-h">
            <h3 id="post-h" className="h3">
              Post on {platform.name}
            </h3>
            <p className="muted">
              Haven prepares the post; you publish it natively. {ready ? 'Everything on the checklist is done.' : `${total - done} checklist item${total - done === 1 ? '' : 's'} still open.`}
            </p>
            <div className="post-box__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => toast('Demo: no bundle is created. Ready-to-post bundles arrive in Milestone 3.', 'demo')}>
                <Icon name="download" size={14} /> Ready-to-post bundle <DemoTag>Demo</DemoTag>
              </button>
              {account.profileUrl && (
                <ExternalLink href={account.profileUrl} className="btn btn--ghost btn--sm">
                  Open {account.handle}
                </ExternalLink>
              )}
            </div>
            <form
              className="live-url"
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: 'version/live-url', versionId: version.id, url: liveUrl });
                toast(liveUrl.trim() ? 'Marked posted with your live link (this session only).' : 'Live link cleared.', 'demo');
              }}
            >
              <label className="field">
                <span>Live URL (after posting)</span>
                <input type="url" inputMode="url" placeholder={`https://… your ${platform.name} post`} value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
              </label>
              <button type="submit" className="btn btn--primary btn--sm">
                {version.liveUrl ? 'Update link' : 'Mark as posted'}
              </button>
            </form>
            {version.liveUrl && (
              <p className="posted">
                <Icon name="check" size={14} /> Posted — <ExternalLink href={version.liveUrl}>view live post</ExternalLink>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Small, clearly secondary mock of the platform post. Collapsed on narrow screens. */
function PlatformPreview({ version, lang }: { version: Version; lang: string }) {
  const { data } = useStore();
  const account = accountOf(data, version.accountId)!;
  const platform = platformOf(data, account.platform);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 900px)').matches);
  return (
    <details className="pp" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="pp__summary">
        <span className="pp__title">{platform.name} preview</span>
        <span className="pp__approx">Approximate</span>
      </summary>
      <div className="pp__body">
        <PostPreview version={version} account={account} lang={lang} />
      </div>
    </details>
  );
}
