import { Link } from 'react-router-dom';
import { PUBLISH_CHECKS, type Cut, type PublishCheck, type VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { PlatformGlyph, StatusPill } from '../../components/ui';
import { lengthLabel } from '../../lib/videoStudio';
import { useStore } from '../../state/store';

/**
 * The final upload's own short checklist. "Ready to publish" is a decision
 * recorded in Haven; posting still happens on each platform.
 */
export function PublishChecklist({ project, cut }: { project: VideoProject; cut: Cut }) {
  const { data, dispatch, allowed } = useStore();
  const toast = useToast();
  const asset = data.assets.find((a) => a.id === cut.assetId);
  const versions = data.versions.filter((v) => project.versionIds.includes(v.id));
  const done = new Set(cut.checklist?.done ?? []);
  const ready = !!cut.checklist?.readyAt;
  const mayCheck = allowed({ type: 'studio/check', cutId: cut.id, check: 'version', done: true });
  const mayReady = allowed({ type: 'studio/ready', cutId: cut.id, ready: true });
  const by = data.people.find((p) => p.id === cut.addedById);
  const added = new Date(cut.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: data.workspace.timeZone });
  const notUsing = asset ? versions.filter((v) => v.mediaAssetId !== asset.id && allowed({ type: 'version/media', versionId: v.id, assetId: asset.id })) : [];
  const readyBy = data.people.find((p) => p.id === cut.checklist?.readyById);

  const detail: Record<PublishCheck, React.ReactNode> = {
    version: (
      <>
        {asset?.name} · {asset?.durationSec !== undefined ? lengthLabel(asset.durationSec) : 'length unknown'} · uploaded {added} by {by?.name ?? 'someone'}.{' '}
        {notUsing.length > 0 ? (
          <button
            type="button"
            className="inline-link"
            onClick={() => {
              notUsing.forEach((v) => dispatch({ type: 'version/media', versionId: v.id, assetId: asset!.id }));
              toast(`${cut.label} is now the video for ${notUsing.length} creation${notUsing.length > 1 ? 's' : ''}.`, 'ok');
            }}
          >
            Use it for {notUsing.length} creation{notUsing.length > 1 ? 's' : ''}
          </button>
        ) : versions.length ? (
          <>Every creation uses this file.</>
        ) : null}
      </>
    ),
    details: (
      <ul className="pcheck__list">
        {versions.map((v) => {
          const a = data.accounts.find((x) => x.id === v.accountId);
          const pl = a && data.platforms.find((x) => x.id === a.platform);
          const caption = v.captions.en || Object.values(v.captions).find(Boolean) || '';
          return (
            <li key={v.id}>
              {pl && <PlatformGlyph platform={pl} size="sm" />}
              <span className="pcheck__what">{v.title ?? (caption ? `“${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}”` : 'No caption yet')}</span>
              <Link className="inline-link" to={`/ideas/${v.ideaId}/versions?v=${v.id}`}>
                Edit
              </Link>
            </li>
          );
        })}
      </ul>
    ),
    thumbnail: (
      <ul className="pcheck__list">
        {versions.map((v) => {
          const a = data.accounts.find((x) => x.id === v.accountId);
          const pl = a && data.platforms.find((x) => x.id === a.platform);
          return (
            <li key={v.id}>
              {pl && <PlatformGlyph platform={pl} size="sm" />}
              <span className="pcheck__what">{v.coverAssetId ? 'Cover chosen' : 'Uses a frame from the video'}</span>
              <Link className="inline-link" to={`/gallery/${v.id}`}>
                Preview
              </Link>
            </li>
          );
        })}
      </ul>
    ),
  };

  return (
    <section className={`pcheck ${ready ? 'is-ready' : ''}`} aria-labelledby="pcheck-h" data-testid="publish-checklist">
      <h3 id="pcheck-h" className="pcheck__title">
        Publishing checklist <span>· {cut.label}</span>
      </h3>
      <p className="pcheck__lede">For this final upload only. Drafts keep their review booklets.</p>
      <ol className="pcheck__items">
        {PUBLISH_CHECKS.map((c) => (
          <li key={c.key} className={done.has(c.key) ? 'is-done' : ''}>
            <label className="pcheck__row">
              <input type="checkbox" checked={done.has(c.key)} disabled={!mayCheck} onChange={(e) => dispatch({ type: 'studio/check', cutId: cut.id, check: c.key, done: e.target.checked })} />
              <span>{c.label}</span>
            </label>
            <div className="pcheck__detail">{detail[c.key]}</div>
          </li>
        ))}
      </ol>
      {ready ? (
        <div className="pcheck__ready" role="status">
          <p>
            <Icon name="check" size={15} /> <strong>Ready to publish</strong> · marked by {readyBy?.name ?? 'someone'}
          </p>
          <p className="pcheck__note">Not posted yet. Haven doesn’t publish: post from each platform, then add the live link to the creation.</p>
          <p className="pcheck__status">
            {versions.map((v) => {
              const a = data.accounts.find((x) => x.id === v.accountId);
              const pl = a && data.platforms.find((x) => x.id === a.platform);
              return (
                <Link key={v.id} to={`/gallery/${v.id}`} className="pcheck__creation">
                  {pl && <PlatformGlyph platform={pl} size="sm" />} <StatusPill status={v.status} />
                </Link>
              );
            })}
          </p>
          {mayReady && (
            <button type="button" className="inline-link" onClick={() => dispatch({ type: 'studio/ready', cutId: cut.id, ready: false })}>
              Not ready after all
            </button>
          )}
        </div>
      ) : (
        <div className="pcheck__go">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!mayReady || done.size < PUBLISH_CHECKS.length}
            onClick={() => {
              dispatch({ type: 'studio/ready', cutId: cut.id, ready: true });
              toast(`${cut.label} is ready to publish. Nothing has been posted.`, 'ok');
            }}
            data-testid="mark-ready"
          >
            Mark ready to publish
          </button>
          <span className="muted small">
            {!mayReady ? 'Marking ready needs Review on this video.' : done.size < PUBLISH_CHECKS.length ? `${PUBLISH_CHECKS.length - done.size} check${PUBLISH_CHECKS.length - done.size === 1 ? '' : 's'} left.` : 'This doesn’t post anything.'}
          </span>
        </div>
      )}
    </section>
  );
}
