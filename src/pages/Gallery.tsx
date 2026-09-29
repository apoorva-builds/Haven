import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Asset, Version, VersionStatus } from '../data/types';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { EmptyState, ExternalLink, LoadingGrid, PageHeader, PlatformGlyph, Segmented, StatusPill, useSimulatedLoad } from '../components/ui';
import { MediaSourceNote, VideoPlayer } from '../components/VideoPlayer';
import { creationLabel, creationMedia, groupByDay, postedLinkLabel, type GalleryOrder } from '../lib/creations';
import { formatDay, formatLongDate, relativeDay } from '../lib/dates';
import { accountOf, assetOf, ideaOf, platformOf, versionsForIdea } from '../state/selectors';
import { useStore } from '../state/store';

type StatusFilter = 'all' | 'planned' | 'review' | 'ready' | 'posted';

const STATUS_GROUP: Record<VersionStatus, StatusFilter> = {
  Planned: 'planned',
  Editing: 'planned',
  'In review': 'review',
  'Ready to post': 'ready',
  Posted: 'posted',
};

/** Photos shown for a carousel/photo creation, falling back to its cover. */
function photosOf(data: ReturnType<typeof useStore>['data'], v: Version): Asset[] {
  const ids = v.photoAssetIds?.length ? v.photoAssetIds : v.coverAssetId ? [v.coverAssetId] : [];
  return ids.map((id) => assetOf(data, id)).filter((a): a is Asset => !!a);
}

/** One account's version as a gallery tile. Opens inside Haven. */
export function CreationTile({ version }: { version: Version }) {
  const { data } = useStore();
  const account = accountOf(data, version.accountId)!;
  const platform = platformOf(data, account.platform);
  const idea = ideaOf(data, version.ideaId);
  const siblings = versionsForIdea(data, version.ideaId);
  const media = assetOf(data, version.mediaAssetId);
  const kind = creationMedia(version);
  const photos = kind === 'photos' ? photosOf(data, version) : [];
  const art = (photos[0] ?? assetOf(data, version.coverAssetId) ?? media)?.art ?? idea?.art;
  const playable = kind === 'video' && media?.videoUrl;

  return (
    <Link
      to={`/gallery/${version.id}`}
      className="ctile"
      style={{ ['--hue' as string]: platform.hue }}
      data-version={version.id}
      aria-label={`${creationLabel(version, account, platform)} for ${account.handle}: ${idea?.title ?? ''}, ${version.status}`}
    >
      <div className="ctile__media">
        {playable ? (
          <video className="ctile__video" src={media!.videoUrl} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
        ) : (
          art && <Cover art={art} ratio="4 / 5" />
        )}
        <span className="ctile__label">{creationLabel(version, account, platform)}</span>
        {playable && (
          <span className="ctile__badge" aria-hidden="true">
            <Icon name="play" size={12} /> Video
          </span>
        )}
        {kind === 'photos' && photos.length > 1 && (
          <span className="ctile__badge" aria-hidden="true">
            <Icon name="image" size={12} /> {photos.length} photos
          </span>
        )}
        {kind === 'video' && !playable && <span className="ctile__badge ctile__badge--muted">No finished video yet</span>}
      </div>
      <div className="ctile__meta">
        <span className="ctile__row">
          <span className="ctile__account">
            <PlatformGlyph platform={platform} size="sm" /> {account.handle}
          </span>
          <StatusPill status={version.status} />
        </span>
        <span className="ctile__idea">
          <Icon name="layers" size={12} /> {idea?.title}
          <span className="muted"> · {siblings.length} version{siblings.length === 1 ? '' : 's'}</span>
        </span>
      </div>
    </Link>
  );
}

export function GalleryPage() {
  const { versionId } = useParams();
  return versionId ? <CreationPage versionId={versionId} /> : <GalleryIndex />;
}

function GalleryIndex() {
  const { data } = useStore();
  const ready = useSimulatedLoad();
  const [params, setParams] = useSearchParams();
  const account = params.get('account') ?? 'all';
  const status = (params.get('status') ?? 'all') as StatusFilter;
  const order = (params.get('order') ?? 'from-today') as GalleryOrder;
  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const versions = data.versions.filter((v) => {
    if (ideaOf(data, v.ideaId)?.archived) return false;
    if (account !== 'all' && v.accountId !== account) return false;
    if (status !== 'all' && STATUS_GROUP[v.status] !== status) return false;
    return true;
  });
  const days = groupByDay(versions, order, data.today);
  const firstPast = order === 'from-today' ? days.findIndex((d) => d.day < data.today) : -1;
  const selectedAccount = accountOf(data, account);
  const chipsRef = useRef<HTMLDivElement>(null);
  // Keep the active account visible in the phone's scrolling chip row.
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (row && chip && row.scrollWidth > row.clientWidth) row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2;
  }, [account]);
  const ordered = [...data.accounts].sort(
    (a, b) => data.platforms.findIndex((p) => p.id === a.platform) - data.platforms.findIndex((p) => p.id === b.platform),
  );

  return (
    <div className="page gallery">
      <PageHeader
        eyebrow="Creation Gallery"
        title="Everything you’re making, day by day"
        lede="Finished posts and planned versions across every platform and account. Each tile is one account’s version of an idea; open it right here. Nothing is posted for you."
      />

      <div className="gallery__filters">
        <div className="chip-grid gallery__accounts" role="radiogroup" aria-label="Account" ref={chipsRef}>
          <button type="button" role="radio" aria-checked={account === 'all'} className={`chip chip--plain ${account === 'all' ? 'is-on' : ''}`} onClick={() => set('account', 'all', 'all')}>
            All accounts
          </button>
          {ordered.map((a) => {
            const p = platformOf(data, a.platform);
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={account === a.id}
                className={`chip ${account === a.id ? 'is-on' : ''}`}
                style={{ ['--hue' as string]: p.hue }}
                onClick={() => set('account', a.id, 'all')}
              >
                <span className="chip__glyph">{p.glyph}</span>
                {a.handle}
              </button>
            );
          })}
        </div>
        <div className="filters">
          <Segmented<StatusFilter>
            label="Status"
            value={status}
            onChange={(v) => set('status', v, 'all')}
            options={[
              { value: 'all', label: 'All' },
              { value: 'planned', label: 'Planned' },
              { value: 'review', label: 'In review' },
              { value: 'ready', label: 'Ready' },
              { value: 'posted', label: 'Posted' },
            ]}
          />
          <span className="spacer" />
          <Segmented<GalleryOrder>
            label="Order"
            value={order}
            onChange={(v) => set('order', v, 'from-today')}
            options={[
              { value: 'from-today', label: 'From today' },
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
            ]}
          />
        </div>
        {selectedAccount && (
          <p className="gallery__scope">
            Showing {versions.length} creation{versions.length === 1 ? '' : 's'} for <strong>{selectedAccount.handle}</strong> ({platformOf(data, selectedAccount.platform).name} · {selectedAccount.kind}).{' '}
            <Link className="inline-link" to={`/accounts/${selectedAccount.id}`}>
              Account page
            </Link>
          </p>
        )}
      </div>

      {!ready ? (
        <LoadingGrid count={6} label="Loading creations" />
      ) : days.length === 0 ? (
        <EmptyState
          icon="grid"
          title="No creations match"
          action={
            <button type="button" className="btn btn--ghost" onClick={() => setParams({}, { replace: true })}>
              Show everything
            </button>
          }
        >
          Try another account or status. New versions appear here as soon as you plan them on an idea.
        </EmptyState>
      ) : (
        days.map(({ day, items }, index) => (
          <section key={day} className={`gallery__day ${index === firstPast && index > 0 ? 'gallery__day--earlier' : ''}`} aria-labelledby={`day-${day}`}>
            {index === firstPast && index > 0 && <p className="gallery__earlier">Earlier</p>}
            <h2 id={`day-${day}`} className="gallery__date">
              <span>{relativeDay(day, data.today)}</span>
              {relativeDay(day, data.today) !== formatDay(day) && <span className="muted">{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}</span>}
              <span className="count">{items.length}</span>
            </h2>
            <div className="gallery__grid">
              {items.map((v) => (
                <CreationTile key={v.id} version={v} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PhotoViewer({ photos }: { photos: Asset[] }) {
  const [i, setI] = useState(0);
  const photo = photos[i];
  return (
    <figure className="photo-viewer" aria-label={`Photo ${i + 1} of ${photos.length}`}>
      <Cover art={photo.art} ratio="4 / 5" label={photo.name} />
      {photos.length > 1 && (
        <>
          <button type="button" className="photo-viewer__nav photo-viewer__nav--prev" aria-label="Previous photo" disabled={i === 0} onClick={() => setI(i - 1)}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="photo-viewer__nav photo-viewer__nav--next" aria-label="Next photo" disabled={i === photos.length - 1} onClick={() => setI(i + 1)}>
            <Icon name="chevronRight" />
          </button>
          <span className="photo-viewer__dots" aria-hidden="true">
            {photos.map((p, n) => (
              <i key={p.id} className={n === i ? 'on' : ''} />
            ))}
          </span>
        </>
      )}
      <figcaption className="muted small">
        {photos.length > 1 ? `Photo ${i + 1} of ${photos.length} · ` : ''}
        {photo.name}
      </figcaption>
    </figure>
  );
}

function CreationPage({ versionId }: { versionId: string }) {
  const { data } = useStore();
  const version = data.versions.find((v) => v.id === versionId);
  const langs = version ? Object.keys(version.captions) : [];
  const [lang, setLang] = useState(langs[0] ?? 'en');

  if (!version) {
    return (
      <div className="page">
        <EmptyState icon="grid" title="This creation isn’t here" action={<Link className="btn btn--primary" to="/gallery">Back to Creation Gallery</Link>}>
          It may belong to an idea deleted in this session.
        </EmptyState>
      </div>
    );
  }

  const account = accountOf(data, version.accountId)!;
  const platform = platformOf(data, account.platform);
  const idea = ideaOf(data, version.ideaId)!;
  const kind = creationMedia(version);
  const media = assetOf(data, version.mediaAssetId);
  const photos = kind === 'photos' ? photosOf(data, version) : [];
  const siblings = versionsForIdea(data, version.ideaId).filter((v) => v.id !== version.id);
  const posted = version.status === 'Posted' && !!version.liveUrl;
  const caption = version.captions[lang] ?? '';
  const editHref = `/ideas/${idea.id}/versions?v=${version.id}`;

  return (
    <div className="page creation" style={{ ['--hue' as string]: platform.hue }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/gallery">Creation Gallery</Link>
        <Icon name="chevronRight" size={14} />
        <Link to={`/gallery?account=${account.id}`}>{account.handle}</Link>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">{creationLabel(version, account, platform)}</span>
      </nav>

      <div className="creation__grid">
        <div className="creation__stage">
          {kind === 'photos' && photos.length > 0 ? (
            <PhotoViewer photos={photos} />
          ) : kind === 'video' && media?.videoUrl ? (
            <VideoPlayer asset={media} />
          ) : kind === 'video' && media ? (
            <div className="creation__missing">
              <Cover art={media.art} ratio="4 / 5" label={media.name} />
              <p className="muted small">
                <Icon name="film" size={13} /> Placeholder only. This demo creation has no playable file.
              </p>
            </div>
          ) : kind === 'video' ? (
            <div className="creation__missing">
              <Cover art={assetOf(data, version.coverAssetId)?.art ?? idea.art} ratio="4 / 5" />
              <p>
                No finished video selected yet. <Link className="inline-link" to={editHref}>Choose one in the version</Link>.
              </p>
            </div>
          ) : (
            <div className="creation__text">
              <Cover art={assetOf(data, version.coverAssetId)?.art ?? idea.art} ratio="16 / 9" />
            </div>
          )}
          {media?.videoUrl && kind === 'video' && <MediaSourceNote asset={media} />}
        </div>

        <aside className="creation__info">
          <p className="creation__label">
            <PlatformGlyph platform={platform} size="sm" /> {creationLabel(version, account, platform)}
          </p>
          <h1 className="display">{version.title ?? idea.title}</h1>

          <dl className="creation__facts">
            <dt>Account</dt>
            <dd>
              <Link to={`/accounts/${account.id}`} className="inline-link">
                {account.handle}
              </Link>{' '}
              <span className="muted">
                {platform.name} · {account.kind}
              </span>
            </dd>
            <dt>Status</dt>
            <dd>
              <StatusPill status={version.status} />
            </dd>
            <dt>{posted ? 'Posted' : 'Planned for'}</dt>
            <dd>
              {formatLongDate(version.scheduledFor)} <span className="muted">· {relativeDay(version.scheduledFor, data.today)}</span>
            </dd>
            <dt>Idea</dt>
            <dd>
              <Link to={`/ideas/${idea.id}`} className="inline-link">
                {idea.title}
              </Link>
              <span className="muted">
                {' '}
                · {siblings.length + 1} version{siblings.length ? 's' : ''}
              </span>
            </dd>
          </dl>

          <section className="creation__caption" aria-labelledby="cap-h">
            <div className="field-group__head">
              <h2 id="cap-h" className="h3">
                Caption
              </h2>
              {langs.length > 1 && (
                <div className="tabs tabs--pill tabs--sm" role="tablist" aria-label="Caption language">
                  {langs.map((l) => (
                    <button key={l} type="button" role="tab" aria-selected={lang === l} className={lang === l ? 'is-active' : ''} onClick={() => setLang(l)}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {caption ? <p className="creation__captext">{caption}</p> : <p className="muted">No caption written yet.</p>}
            {version.tags.length > 0 && (
              <p className="tags">
                {version.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </p>
            )}
          </section>

          {posted ? (
            <div className="creation__posted">
              <ExternalLink href={version.liveUrl!} className="btn btn--primary">
                {postedLinkLabel(version)}
              </ExternalLink>
              <p className="muted small">Opens the live link you saved, on {platform.name}.</p>
            </div>
          ) : (
            <p className="creation__unposted" role="note">
              <Icon name="shield" size={14} />
              <span>
                Not published. Haven prepares posts but never publishes them. After you post on {platform.name}, add the live link to this version and it will appear here.
              </span>
            </p>
          )}

          <div className="creation__actions">
            <Link to={editHref} className="btn btn--ghost btn--sm">
              Edit version
            </Link>
            <Link to={`/ideas/${idea.id}`} className="btn btn--ghost btn--sm">
              Open idea
            </Link>
          </div>
        </aside>
      </div>

      {siblings.length > 0 && (
        <section aria-labelledby="sib-h" className="creation__siblings">
          <h2 id="sib-h" className="h2">
            Other versions of “{idea.title}”
          </h2>
          <div className="gallery__grid gallery__grid--compact">
            {siblings.map((v) => (
              <CreationTile key={v.id} version={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
