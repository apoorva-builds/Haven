import { ASSET_KIND_LABEL, type Asset, type AssetKind } from '../data/types';
import { formatDuration, formatSize } from '../lib/dates';
import { assetOf, personOf } from '../state/selectors';
import { useStore } from '../state/store';
import { Cover } from './Cover';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';

export const KIND_ICON: Record<AssetKind, IconName> = {
  raw: 'film',
  cutaway: 'layers',
  photo: 'image',
  audio: 'music',
  cover: 'image',
  document: 'file',
};

const STORAGE_LABEL: Record<Asset['storage'], string> = {
  original: 'Original',
  'original+proxy': 'Original + proxy',
  'proxy-only': 'Proxy only',
};

export function AssetCard({
  asset,
  selectable,
  selected,
  onSelect,
}: {
  asset: Asset;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const original = assetOf(data, asset.duplicateOfId);
  const uploader = personOf(data, asset.uploadedById);

  return (
    <article className={`asset ${selected ? 'is-selected' : ''}`} aria-label={asset.name}>
      <div className="asset__media">
        <Cover art={asset.art} ratio="16 / 10">
          <span className="asset__kind">
            <Icon name={KIND_ICON[asset.kind]} size={13} /> {ASSET_KIND_LABEL[asset.kind]}
          </span>
          {asset.durationSec !== undefined && <span className="asset__dur">{formatDuration(asset.durationSec)}</span>}
        </Cover>
        {selectable && (
          <label className="asset__select">
            <input type="checkbox" checked={!!selected} onChange={onSelect} aria-label={`Select ${asset.name} for download package`} />
          </label>
        )}
        <button
          type="button"
          className={`asset__fav ${asset.favorite ? 'is-on' : ''}`}
          aria-pressed={asset.favorite}
          aria-label={asset.favorite ? `Remove ${asset.name} from selects` : `Mark ${asset.name} as a select`}
          onClick={() => dispatch({ type: 'asset/favorite', assetId: asset.id })}
        >
          <Icon name="star" size={16} />
        </button>
      </div>
      <div className="asset__body">
        <p className="asset__name" title={asset.name}>
          {asset.name}
        </p>
        <p className="asset__meta">
          {formatSize(asset.sizeMB)} · <span className={`store store--${asset.storage}`}>{STORAGE_LABEL[asset.storage]}</span>
          {uploader && <> · {uploader.name.split(' ')[0]}</>}
        </p>
        {asset.sessionOnly && (
          <p className="asset__flag asset__flag--demo">
            <Icon name="shield" size={13} /> Session only — not stored anywhere
          </p>
        )}
        {asset.storage === 'proxy-only' && (
          <p className="asset__flag asset__flag--warn">
            <Icon name="alert" size={13} /> Original not in Haven. Only a preview proxy is kept.
          </p>
        )}
        {asset.duplicateOfId && (
          <div className="asset__flag asset__flag--warn" role="note">
            <Icon name="copy" size={13} />
            <span>
              Possible duplicate of “{original?.name ?? 'another file'}”.{' '}
              <button type="button" className="link-btn" onClick={() => dispatch({ type: 'asset/dismiss-duplicate', assetId: asset.id })}>
                Keep both
              </button>
            </span>
          </div>
        )}
        {asset.musicRights && (
          <details className="asset__rights">
            <summary>
              <Icon name="music" size={13} /> Source &amp; rights
            </summary>
            <dl>
              <dt>Source</dt>
              <dd>{asset.musicRights.source}</dd>
              <dt>Licence</dt>
              <dd>{asset.musicRights.license}</dd>
              <dt>Notes</dt>
              <dd>{asset.musicRights.notes}</dd>
            </dl>
          </details>
        )}
        {asset.moments.length > 0 && (
          <ul className="asset__moments" aria-label="Selected moments">
            {asset.moments.map((m) => (
              <li key={m.id}>
                <span className="mono">{formatDuration(m.t)}</span> {m.label}
              </li>
            ))}
          </ul>
        )}
        <div className="asset__actions">
          {asset.inLibrary ? (
            <span className="tag tag--accent">
              <Icon name="library" size={12} /> In Library
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() => {
                dispatch({ type: 'asset/promote', assetId: asset.id });
                toast(`“${asset.name}” promoted to the Library for this session.`, 'demo');
              }}
            >
              <Icon name="library" size={13} /> Promote to Library
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={() => toast('Demo: no file is downloaded. Real downloads arrive with secure storage in Milestone 2.', 'demo')}
            aria-label={`Download ${asset.name} (demo, no file)`}
          >
            <Icon name="download" size={13} /> Download
          </button>
        </div>
      </div>
    </article>
  );
}
