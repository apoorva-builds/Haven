import type { Account, Art, Version } from '../data/types';
import { useStore } from '../state/store';
import { assetOf, ideaOf, platformOf } from '../state/selectors';
import { Cover } from './Cover';
import { Icon } from './Icon';

/**
 * Approximate, platform-flavoured mock of how a version might look.
 * It is not the platform's renderer: crops, fonts and truncation differ.
 */
export function PostPreview({ version, account, lang = 'en' }: { version: Version; account: Account; lang?: string }) {
  const { data } = useStore();
  const platform = platformOf(data, account.platform);
  const idea = ideaOf(data, version.ideaId);
  const cover = assetOf(data, version.coverAssetId) ?? assetOf(data, version.mediaAssetId);
  const art: Art = cover?.art ?? idea?.art ?? { motif: 'grain', hue: 250, hue2: 220 };
  const caption = version.captions[lang] ?? '';
  const firstText = version.onScreenText[0]?.text;

  const frame = (() => {
    switch (account.platform) {
      case 'instagram':
        return version.format === 'Carousel' ? (
          <div className="pv pv--feed pv--ig">
            <div className="pv__bar">
              <span className="pv__avatar" style={{ ['--hue' as string]: platform.hue }} />
              <strong>{account.handle.replace('@', '')}</strong>
              <Icon name="more" size={16} />
            </div>
            <Cover art={art} ratio="4 / 5" className="pv__media">
              <span className="pv__dots" aria-hidden="true">
                <i className="on" />
                <i />
                <i />
              </span>
            </Cover>
            <div className="pv__icons">
              <Icon name="heart" size={18} />
              <Icon name="comment" size={18} />
              <Icon name="share" size={18} />
              <span className="spacer" />
              <Icon name="bookmark" size={18} />
            </div>
            <p className="pv__caption">
              <strong>{account.handle.replace('@', '')}</strong> {truncate(caption, 110) || <em>No caption yet</em>}
            </p>
          </div>
        ) : (
          <Vertical art={art} handle={account.handle} caption={caption} overlay={firstText} rail="ig" hue={platform.hue} />
        );
      case 'tiktok':
      case 'snapchat':
        return <Vertical art={art} handle={account.handle} caption={caption} overlay={firstText} rail="tt" hue={platform.hue} />;
      case 'youtube':
        return (
          <div className="pv pv--yt">
            <Cover art={art} ratio="16 / 9" className="pv__media">
              <span className="pv__duration">6:42</span>
            </Cover>
            <div className="pv__yt-meta">
              <span className="pv__avatar" style={{ ['--hue' as string]: platform.hue }} />
              <div>
                <p className="pv__yt-title">{version.title || idea?.title || 'Untitled video'}</p>
                <p className="pv__muted">{account.displayName} · scheduled</p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="pv pv--feed pv--li">
            <div className="pv__bar">
              <span className="pv__avatar" style={{ ['--hue' as string]: platform.hue }} />
              <div>
                <strong>{account.displayName}</strong>
                <p className="pv__muted">{platform.name}</p>
              </div>
            </div>
            <p className="pv__caption">{truncate(caption, 200) || <em>Nothing written yet — draft the post in the caption field.</em>}</p>
            <Cover art={art} ratio="16 / 9" className="pv__media" />
          </div>
        );
    }
  })();

  return (
    <figure className="preview" aria-label={`Approximate ${platform.name} preview for ${account.handle}`}>
      {frame}
      <figcaption className="preview__note">
        <Icon name="alert" size={13} /> Approximate preview. {platform.name} crops, fonts and truncation will differ.
      </figcaption>
    </figure>
  );
}

function Vertical({ art, handle, caption, overlay, rail, hue }: { art: Art; handle: string; caption: string; overlay?: string; rail: 'ig' | 'tt'; hue: number }) {
  return (
    <div className={`pv pv--vertical pv--${rail}`}>
      <Cover art={art} ratio="9 / 16" className="pv__media">
        <span className="pv__safe" aria-hidden="true" />
        {overlay && <span className="pv__overlay">{overlay}</span>}
        <span className="pv__rail" aria-hidden="true">
          <Icon name="heart" size={20} />
          <Icon name="comment" size={20} />
          <Icon name={rail === 'ig' ? 'share' : 'bookmark'} size={20} />
        </span>
        <span className="pv__bottom">
          <span className="pv__who">
            <span className="pv__avatar pv__avatar--sm" style={{ ['--hue' as string]: hue }} />
            {handle}
          </span>
          <span className="pv__cap">{truncate(caption, 70) || 'No caption yet'}</span>
        </span>
      </Cover>
    </div>
  );
}

function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}… more` : one;
}
