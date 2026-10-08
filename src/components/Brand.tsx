/*
 * Haven's brand: the Sunlit Rose H heart. The artwork is the supplied PNGs in
 * public/brand/, used as-is (only transparent margins trimmed). The dark
 * versions recolour the ink (wordmark and the H) to cream so it reads on dark
 * surfaces; the heart, sparkle, tick and byline keep their colours.
 *
 *   founder  "haven / BY APOORVA": public-facing and welcome surfaces
 *   wordmark "haven" without the byline: everyday navigation
 *   icon     the square app icon: tight spaces, browser tab, home screen
 */

type Variant = 'founder' | 'wordmark' | 'icon';

const ASSETS: Record<Variant, { light: string; dark?: string; width: number; height: number }> = {
  founder: { light: '/brand/haven-logo-founder.png', dark: '/brand/haven-logo-founder-dark.png', width: 1184, height: 400 },
  wordmark: { light: '/brand/haven-logo.png', dark: '/brand/haven-logo-dark.png', width: 1184, height: 327 },
  icon: { light: '/brand/icon-192.png', width: 192, height: 192 },
};

/**
 * The Haven logo at a given height; width follows the artwork's aspect ratio.
 * Light and dark files are both in the page and the theme shows one, so a
 * theme change never waits on a download.
 */
export function BrandLogo({ variant, height, className = '', decorative = false }: { variant: Variant; height: number; className?: string; decorative?: boolean }) {
  const a = ASSETS[variant];
  const width = Math.round((a.width / a.height) * height);
  const alt = decorative ? '' : variant === 'founder' ? 'Haven, by Apoorva' : 'Haven';
  const common = { width, height, draggable: false, decoding: 'async' as const };
  // Height can be overridden per layout in CSS (--logo-h-override); the
  // aspect ratio always comes from the artwork, so it never stretches.
  const style = { ['--logo-h' as string]: `${height}px`, ['--logo-ar' as string]: `${a.width} / ${a.height}` };
  if (!a.dark) return <img {...common} src={a.light} alt={alt} style={style} className={`brand-logo brand-logo--${variant} ${className}`} />;
  return (
    <span className={`brand-logo brand-logo--${variant} ${className}`} style={style} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : alt} aria-hidden={decorative || undefined}>
      <img {...common} src={a.light} alt="" className="brand-logo__light" />
      <img {...common} src={a.dark} alt="" className="brand-logo__dark" />
    </span>
  );
}
