import type { Asset } from '../data/types';
import { Icon } from './Icon';

/** Plain-language note on where a playable video lives in this prototype. */
export function MediaSourceNote({ asset }: { asset: Asset }) {
  if (asset.mediaSource === 'device-session') {
    return (
      <p className="media-source media-source--session">
        <Icon name="shield" size={13} /> From this device · session only. Not uploaded or stored online; gone when you reload.
      </p>
    );
  }
  if (asset.mediaSource === 'bundled-sample') {
    return (
      <p className="media-source">
        <Icon name="film" size={13} /> Demo sample bundled with the prototype, not real footage.
      </p>
    );
  }
  return null;
}

/**
 * In-page player for a Library video. Renders nothing playable for assets
 * without a file (seeded placeholders), and says so.
 */
export function VideoPlayer({ asset, compact = false }: { asset: Asset; compact?: boolean }) {
  if (!asset.videoUrl) {
    return (
      <div className="player player--empty" role="note">
        <Icon name="film" size={18} />
        <span>Placeholder only. This demo asset has no playable file.</span>
      </div>
    );
  }
  return (
    <div className={`player ${compact ? 'player--compact' : ''}`}>
      <video src={asset.videoUrl} controls playsInline preload="metadata" aria-label={`Play ${asset.name}`} data-asset={asset.id} />
    </div>
  );
}
