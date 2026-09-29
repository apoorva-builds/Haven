import { useId, type ReactNode } from 'react';
import type { Art } from '../data/types';

/**
 * Generated, replaceable artwork standing in for creator media.
 * Deliberately painterly so it reads as "media" without being real footage.
 */
export function Cover({
  art,
  ratio = '4 / 5',
  className = '',
  children,
  label,
}: {
  art: Art;
  ratio?: string;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const id = useId().replace(/:/g, '');
  const { hue, hue2, motif } = art;
  if (art.image) {
    return (
      <div className={`cover cover--photo ${className}`} style={{ aspectRatio: ratio }} role={label ? 'img' : undefined} aria-label={label}>
        <img src={art.image} alt="" loading="lazy" decoding="async" />
        {children}
      </div>
    );
  }
  const c1 = `hsl(${hue} 72% 62%)`;
  const c2 = `hsl(${hue2} 55% 32%)`;
  const c3 = `hsl(${(hue + 20) % 360} 85% 82%)`;
  const deep = `hsl(${hue2} 45% 16%)`;

  return (
    <div className={`cover ${className}`} style={{ aspectRatio: ratio }} role={label ? 'img' : undefined} aria-label={label}>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`r${id}`} cx="0.7" cy="0.3" r="0.7">
            <stop offset="0" stopColor={c3} stopOpacity="0.95" />
            <stop offset="1" stopColor={c3} stopOpacity="0" />
          </radialGradient>
          <filter id={`n${id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0" />
          </filter>
        </defs>
        <rect width="400" height="500" fill={`url(#g${id})`} />
        <rect width="400" height="500" fill={`url(#r${id})`} />
        {motif === 'sunrise' && (
          <g>
            <circle cx="260" cy="190" r="70" fill={c3} opacity="0.9" />
            <rect x="40" y="60" width="140" height="220" rx="4" fill="none" stroke={c3} strokeOpacity="0.5" strokeWidth="6" />
            <line x1="110" y1="60" x2="110" y2="280" stroke={c3} strokeOpacity="0.4" strokeWidth="4" />
            <path d="M0 360 C120 330 260 340 400 310 L400 500 L0 500Z" fill={deep} opacity="0.85" />
            <path d="M150 360 q10 -40 45 -40 q35 0 45 40z" fill={c1} opacity="0.9" />
          </g>
        )}
        {motif === 'waves' && (
          <g fill="none" strokeWidth="14" strokeLinecap="round" opacity="0.8">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M-20 ${180 + i * 50} C 80 ${140 + i * 50}, 200 ${230 + i * 50}, 420 ${170 + i * 50}`} stroke={i % 2 ? c3 : deep} strokeOpacity={0.35 + i * 0.1} />
            ))}
          </g>
        )}
        {motif === 'rings' && (
          <g fill="none">
            {[160, 125, 92, 60, 30].map((r, i) => (
              <circle key={r} cx="200" cy="270" r={r} stroke={i % 2 ? c3 : deep} strokeWidth={i === 0 ? 10 : 18} strokeOpacity={0.55 + i * 0.08} />
            ))}
          </g>
        )}
        {motif === 'studio' && (
          <g>
            <rect x="30" y="80" width="340" height="12" fill={deep} opacity="0.6" />
            <rect x="30" y="190" width="340" height="12" fill={deep} opacity="0.6" />
            {[50, 110, 170, 240, 300].map((x, i) => (
              <path key={x} d={`M${x} 80 q-4 -${30 + i * 6} 20 -${34 + i * 6} q24 4 20 ${34 + i * 6}z`} fill={i % 2 ? c3 : c1} opacity="0.9" />
            ))}
            {[70, 150, 230, 310].map((x, i) => (
              <rect key={x} x={x} y={150 - i * 6} width="36" height={40 + i * 6} rx="10" fill={i % 2 ? c1 : c3} opacity="0.85" />
            ))}
            <path d="M0 380 L400 330 L400 500 L0 500Z" fill={deep} opacity="0.8" />
          </g>
        )}
        {motif === 'bloom' && (
          <g opacity="0.85">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx="200" cy="250" rx="46" ry="130" fill={c3} fillOpacity="0.35" transform={`rotate(${a} 200 250)`} />
            ))}
            <circle cx="200" cy="250" r="34" fill={deep} />
          </g>
        )}
        {motif === 'city' && (
          <g>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect key={i} x={i * 52 - 6} y={260 - ((i * 37) % 120)} width="46" height="400" fill={i % 2 ? deep : c2} opacity="0.85" />
            ))}
            <circle cx="300" cy="120" r="40" fill={c3} />
          </g>
        )}
        {motif === 'horizon' && (
          <g>
            <rect y="300" width="400" height="200" fill={deep} opacity="0.75" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="0" y={310 + i * 34} width="400" height="3" fill={c3} opacity={0.5 - i * 0.1} />
            ))}
            <circle cx="200" cy="300" r="90" fill={c3} opacity="0.85" />
            <rect y="300" width="400" height="200" fill={deep} opacity="0.55" />
          </g>
        )}
        {motif === 'grain' && (
          <g>
            <circle cx="120" cy="140" r="120" fill={c3} opacity="0.35" />
            <circle cx="300" cy="380" r="150" fill={deep} opacity="0.5" />
            <rect x="120" y="170" width="160" height="200" rx="18" fill={c1} opacity="0.75" />
          </g>
        )}
        <rect width="400" height="500" filter={`url(#n${id})`} />
      </svg>
      {children}
    </div>
  );
}
