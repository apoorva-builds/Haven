import { Link } from 'react-router-dom';
import type { Version } from '../data/types';
import { formatDay } from '../lib/dates';
import { accountOf, assetOf, platformOf } from '../state/selectors';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { AccountBadge, EmptyState, StatusPill } from './ui';
import { MediaSourceNote, VideoPlayer } from './VideoPlayer';

/**
 * Finished videos grouped by idea, then by the Library file each version
 * uses. A video shared by several accounts appears once, with every account
 * that uses it listed beneath — it is one asset, never a copy.
 */
export function FinishedVideos({ accountId }: { accountId?: string }) {
  const { data } = useStore();
  const hasPlayable = (versions: Version[]) => versions.some((v) => !!assetOf(data, v.mediaAssetId)?.videoUrl);
  const platformOrder = (v: Version) => data.platforms.findIndex((p) => p.id === accountOf(data, v.accountId)?.platform);

  const groups = data.ideas
    .filter((i) => !i.archived)
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((idea) => {
      const versions = data.versions
        .filter((v) => v.ideaId === idea.id && (!accountId || v.accountId === accountId))
        .sort((a, b) => platformOrder(a) - platformOrder(b));
      const byAsset = new Map<string, Version[]>();
      versions.forEach((v) => {
        const key = v.mediaAssetId ?? '';
        byAsset.set(key, [...(byAsset.get(key) ?? []), v]);
      });
      return { idea, versions, byAsset };
    })
    .filter((g) => g.versions.length > 0)
    // Ideas with a playable finished video come first; order is otherwise by due date.
    .sort((a, b) => Number(!hasPlayable(a.versions)) - Number(!hasPlayable(b.versions)));

  if (groups.length === 0) {
    return (
      <EmptyState icon="film" title="No versions for this account yet">
        Plan a version from an idea, then pick its finished video from the Library.
      </EmptyState>
    );
  }

  return (
    <div className="fv">
      <p className="field-hint fv__note">
        <Icon name="alert" size={13} />
        <span>Status is tracked in Haven. Nothing here is posted to any platform.</span>
      </p>
      {groups.map(({ idea, byAsset }) => (
        <article key={idea.id} className="fv__idea" aria-labelledby={`fv-idea-${idea.id}`}>
          <header className="fv__head">
            <h3 id={`fv-idea-${idea.id}`} className="h2">
              <Link to={`/ideas/${idea.id}/versions`}>{idea.title}</Link>
            </h3>
            <span className="muted small">
              {data.campaigns.find((c) => c.id === idea.campaignId)?.name ?? idea.series ?? 'No campaign'} · due {formatDay(idea.due)}
            </span>
          </header>
          <div className="fv__items">
            {[...byAsset.entries()]
              .sort(([a], [b]) => Number(a === '') - Number(b === ''))
              .map(([assetId, versions]) => {
                const asset = assetOf(data, assetId || undefined);
                return (
                  <div key={assetId || 'none'} className={`fv__item ${asset ? '' : 'fv__item--none'}`} data-testid={asset ? `fv-asset-${asset.id}` : 'fv-none'}>
                    {asset ? (
                      <div className="fv__media">
                        <VideoPlayer asset={asset} compact />
                        <p className="fv__name">{asset.name}</p>
                        <MediaSourceNote asset={asset} />
                        {versions.length > 1 && <p className="tag tag--accent">One Library file · {versions.length} accounts</p>}
                      </div>
                    ) : (
                      <p className="muted small">No finished video selected yet</p>
                    )}
                    <ul className="fv__versions" aria-label={asset ? `Versions using ${asset.name}` : 'Versions without a finished video'}>
                      {versions.map((v) => {
                        const account = accountOf(data, v.accountId)!;
                        return (
                          <li key={v.id}>
                            <AccountBadge account={account} showHandle />
                            <span className="muted small">
                              {platformOf(data, account.platform).name} {v.format} · {formatDay(v.scheduledFor)}
                            </span>
                            <StatusPill status={v.status} />
                            <Link className="text-link" to={`/ideas/${v.ideaId}/versions?v=${v.id}`}>
                              {asset ? 'Version' : 'Choose video'}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
          </div>
        </article>
      ))}
    </div>
  );
}
