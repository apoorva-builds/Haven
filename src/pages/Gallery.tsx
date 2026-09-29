import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Asset, Version, VersionStatus } from '../data/types';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { AccountSelector, useAccountName } from '../components/AccountSelector';
import { QuickAddModal } from '../components/Shell';
import { AudiencePulse } from '../components/AudiencePulse';
import { InfoButton } from '../components/InfoButton';
import { EmptyState, ExternalLink, LoadingGrid, PlatformGlyph, SelectField, StatusPill, useSimulatedLoad } from '../components/ui';
import { MediaSourceNote, VideoPlayer } from '../components/VideoPlayer';
import { creationLabel, creationMedia, groupByDay, postedLinkLabel } from '../lib/creations';
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
export function photosOf(data: ReturnType<typeof useStore>['data'], v: Version): Asset[] {
  const ids = v.photoAssetIds?.length ? v.photoAssetIds : v.coverAssetId ? [v.coverAssetId] : [];
  return ids.map((id) => assetOf(data, id)).filter((a): a is Asset => !!a);
}

/** One account's version as a gallery tile. Opens inside Haven. */
const STATUS_TEXT: Record<VersionStatus, string> = {
  Planned: 'Planned',
  Editing: 'Editing',
  'In review': 'In review',
  'Ready to post': 'Ready',
  Posted: 'Posted',
};

/** One account's version as a gallery tile. Opens inside Haven. */
export function CreationTile({ version }: { version: Version }) {
  const { data } = useStore();
  const name = useAccountName();
  const account = accountOf(data, version.accountId)!;
  const platform = platformOf(data, account.platform);
  const idea = ideaOf(data, version.ideaId);
  const media = assetOf(data, version.mediaAssetId);
  const kind = creationMedia(version);
  const photos = kind === 'photos' ? photosOf(data, version) : [];
  const art = (photos[0] ?? assetOf(data, version.coverAssetId) ?? media)?.art ?? idea?.art;
  const playable = kind === 'video' && media?.videoUrl;
  const group = STATUS_GROUP[version.status];

  return (
    <Link
      to={`/gallery/${version.id}`}
      className="ctile"
      style={{ ['--hue' as string]: platform.hue }}
      data-version={version.id}
      aria-label={`${creationLabel(version, account, platform)} for ${name(account.id)}: ${idea?.title ?? ''}, ${version.status}`}
    >
      <div className="ctile__media">
        {playable ? (
          <video className="ctile__video" src={media!.videoUrl} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
        ) : (
          art && <Cover art={art} ratio="4 / 5" />
        )}
        {kind === 'photos' && photos.length > 1 && (
          <span className="ctile__badge" aria-hidden="true">
            <Icon name="image" size={12} /> {photos.length}
          </span>
        )}
        {playable && (
          <span className="ctile__badge ctile__badge--play" aria-hidden="true">
            <Icon name="play" size={11} />
          </span>
        )}
      </div>
      <div className="ctile__meta">
        <span className="ctile__title">{version.title ?? idea?.title}</span>
        <span className="ctile__row">
          <span className="ctile__label">{creationLabel(version, account, platform)}</span>
          <span className={`ctile__status ctile__status--${group}`}>{STATUS_TEXT[version.status]}</span>
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
  const [adding, setAdding] = useState(false);
  const ready = useSimulatedLoad();
  const [params, setParams] = useSearchParams();
  const account = accountOf(data, params.get('account') ?? undefined) ? params.get('account')! : 'all';
  const status = (params.get('status') ?? 'all') as StatusFilter;
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
  const days = groupByDay(versions, 'from-today', data.today);
  const firstPast = days.findIndex((d) => d.day < data.today);

  return (
    <div className="page gallery">
      <header className="gallery__head">
        <span className="with-info">
          <h1 className="display gallery__title">Creation Gallery</h1>
          <InfoButton k="gallery" />
        </span>
        <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> New idea
        </button>
      </header>

      <div className="gallery__toolbar">
        <span className="with-info">
          <AccountSelector value={account} onChange={(id) => set('account', id, 'all')} />
          <InfoButton k="accounts" />
        </span>
        <span className="with-info">
          <SelectField label="Status" value={status} onChange={(v) => set('status', v, 'all')}>
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="review">In review</option>
            <option value="ready">Ready</option>
            <option value="posted">Posted</option>
          </SelectField>
          <InfoButton k="status" />
        </span>
      </div>

      {account !== 'all' && <AudiencePulse accountId={account} />}

      {!ready ? (
        <LoadingGrid count={6} label="Loading creations" />
      ) : days.length === 0 ? (
        <EmptyState
          icon="grid"
          title="No creations here yet"
          action={
            <button type="button" className="btn btn--ghost" onClick={() => setParams({}, { replace: true })}>
              Show all accounts
            </button>
          }
        >
          Plan a version for this account from any idea and it appears here.
        </EmptyState>
      ) : (
        <div className="gallery__days">
          {days.map(({ day, items }, index) => (
            <section key={day} className="gallery__day" aria-labelledby={`day-${day}`}>
              {index === firstPast && index > 0 && <p className="gallery__earlier">Earlier</p>}
              <div className="gallery__dayhead">
                <h2 id={`day-${day}`} className="gallery__date">
                  <span>{relativeDay(day, data.today)}</span>
                  {relativeDay(day, data.today) !== formatDay(day) && <span className="muted">{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}</span>}
                </h2>
                {index === 0 && <InfoButton k="tiles" />}
              </div>
              <div className="gallery__grid">
                {items.map((v) => (
                  <CreationTile key={v.id} version={v} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {adding && <QuickAddModal onClose={() => setAdding(false)} />}
    </div>
  );
}

export function PhotoViewer({ photos }: { photos: Asset[] }) {
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
  const name = useAccountName();
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
        <Link to={`/gallery?account=${account.id}`}>{name(account.id)}</Link>
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
              <Link to={`/gallery?account=${account.id}`} className="inline-link">
                {name(account.id)}
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
            <Link to={editHref} className={`btn btn--sm ${posted ? 'btn--ghost' : 'btn--primary'}`}>
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
