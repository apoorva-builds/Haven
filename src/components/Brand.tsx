/*
 * Haven's brand: the geometric H and the lowercase "haven" wordmark, taken
 * from the supplied Haven logo sheet (public/brand/). The artwork is used
 * as supplied: only the flat sheet background was made transparent. Files
 * without a suffix have dark lettering for light surfaces; "-light" files
 * have cream lettering for dark surfaces.
 *
 *   horizontal  symbol beside the wordmark: navigation and page headers
 *   stacked     symbol over the wordmark and tagline: large placements
 *   symbol      the H alone: compact spaces
 */

type Variant = 'horizontal' | 'stacked' | 'symbol';

const ASSETS: Record<Variant, { light: string; dark: string; width: number; height: number }> = {
  horizontal: { light: '/brand/haven-logo-horizontal.png', dark: '/brand/haven-logo-horizontal-light.png', width: 466, height: 104 },
  stacked: { light: '/brand/haven-logo-stacked.png', dark: '/brand/haven-logo-stacked-light.png', width: 341, height: 301 },
  symbol: { light: '/brand/haven-symbol.png', dark: '/brand/haven-symbol-light.png', width: 187, height: 196 },
};

/**
 * The Haven logo at a given height; width follows the artwork's aspect ratio.
 * Light and dark files are both in the page and the theme shows one, so a
 * theme change never waits on a download.
 */
export function BrandLogo({ variant, height, className = '', decorative = false }: { variant: Variant; height: number; className?: string; decorative?: boolean }) {
  const a = ASSETS[variant];
  const width = Math.round((a.width / a.height) * height);
  const alt = decorative ? '' : variant === 'stacked' ? 'Haven. Creators belong here.' : 'Haven';
  const common = { width, height, draggable: false, decoding: 'async' as const };
  // Height can be overridden per layout in CSS (--logo-h-override); the
  // aspect ratio always comes from the artwork, so it never stretches.
  const style = { ['--logo-h' as string]: `${height}px`, ['--logo-ar' as string]: `${a.width} / ${a.height}` };
  return (
    <span className={`brand-logo brand-logo--${variant} ${className}`} style={style} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : alt} aria-hidden={decorative || undefined}>
      <img {...common} src={a.light} alt="" className="brand-logo__light" />
      <img {...common} src={a.dark} alt="" className="brand-logo__dark" />
    </span>
  );
}
