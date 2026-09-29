import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Asset, Version } from '../../data/types';
import { localVideoUrl } from '../../components/DemoUploader';
import { Icon } from '../../components/Icon';
import { InfoButton } from '../../components/InfoButton';
import { useToast } from '../../components/Toast';
import { AccountBadge } from '../../components/ui';
import { MediaSourceNote, VideoPlayer } from '../../components/VideoPlayer';
import { accountOf, assetOf, finishedVideos, versionsUsingAsset } from '../../state/selectors';
import { useStore } from '../../state/store';

/**
 * Picks the finished edit for one account's version. Finished videos are
 * shared assets shown in the Creation Gallery (not the Raw Library);
 * versions reference them, so one file can serve several accounts.
 */
export function FinishedVideoField({ version }: { version: Version }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const account = accountOf(data, version.accountId)!;
  const options = finishedVideos(data);
  const selected = assetOf(data, version.mediaAssetId);
  const others = selected ? versionsUsingAsset(data, selected.id).filter((v) => v.id !== version.id) : [];

  const fromDevice = (file: File) => {
    const url = localVideoUrl(file);
    if (!url) {
      toast('That file isn’t a video. Choose a video file to use as the finished edit.', 'info');
      return;
    }
    const hue = Math.floor(Math.random() * 360);
    const asset: Asset = {
      id: `dev-${Date.now().toString(36)}`,
      name: file.name,
      kind: 'final',
      ideaIds: [version.ideaId],
      inLibrary: false,
      sizeMB: Math.max(0.1, file.size / 1024 / 1024),
      art: { motif: 'grain', hue, hue2: (hue + 40) % 360 },
      favorite: false,
      storage: 'original',
      uploadedById: data.currentUserId,
      uploadedAt: data.today,
      tags: ['session upload'],
      platforms: [account.platform],
      moments: [],
      sessionOnly: true,
      videoUrl: url,
      mediaSource: 'device-session',
    };
    dispatch({ type: 'asset/add-session', asset });
    dispatch({ type: 'version/media', versionId: version.id, assetId: asset.id });
    toast('Finished video added for this session only. It plays from this tab; nothing was uploaded or posted.', 'demo');
  };

  return (
    <section className="field-group finished" aria-labelledby={`fv-${version.id}`}>
      <div className="field-group__head">
        <span className="with-info">
          <h3 id={`fv-${version.id}`} className="h3">
            Finished video
          </h3>
          <InfoButton k="finished" />
        </span>
        <Link to={`/gallery/${version.id}`} className="text-link">
          View in Creation Gallery <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      <div className="finished__pick">
        <select
          aria-label={`Finished video for ${account.handle}`}
          value={selected?.id ?? ''}
          onChange={(e) => dispatch({ type: 'version/media', versionId: version.id, assetId: e.target.value || undefined })}
        >
          <option value="">No finished video selected</option>
          {options.map((a) => {
            const uses = versionsUsingAsset(data, a.id).length;
            return (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.mediaSource === 'device-session' ? ' (this device, session only)' : ''}
                {uses ? ` · used by ${uses}` : ''}
              </option>
            );
          })}
          {selected && !options.includes(selected) && <option value={selected.id}>{selected.name} (placeholder, no playable file)</option>}
        </select>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} /> From this device
        </button>
        <input
          ref={input}
          type="file"
          accept="video/*"
          hidden
          data-testid="finished-video-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) fromDevice(file);
            e.target.value = '';
          }}
        />
      </div>

      {selected ? (
        <div className="finished__selected">
          <VideoPlayer asset={selected} />
          <p className="finished__name">{selected.name}</p>
          <MediaSourceNote asset={selected} />
          {others.length > 0 ? (
            <p className="finished__shared">
              Same file also used by{' '}
              {others.map((v) => {
                const a = accountOf(data, v.accountId);
                return a ? <AccountBadge key={v.id} account={a} showHandle /> : null;
              })}
              <span className="muted"> — one file, no copies.</span>
            </p>
          ) : (
            <p className="muted small">Only this version uses this video. Other accounts can pick the same file.</p>
          )}
          <p className="muted small">Edited in your editor, not in Haven. Selecting it here doesn’t post anything.</p>
        </div>
      ) : (
        <p className="muted">Pick a finished video already used by another version, or choose one from this device for a session-only preview.</p>
      )}
    </section>
  );
}
