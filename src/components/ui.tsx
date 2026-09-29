import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Account, IdeaStatus, Person, Platform, VersionStatus } from '../data/types';
import { useStore } from '../state/store';
import { platformOf } from '../state/selectors';
import { Icon, type IconName } from './Icon';
import { InfoButton } from './InfoButton';
import type { HelpKey } from '../lib/help';

/** Honest marker for anything that only works in this demo session. */
export function DemoTag({ children = 'Demo only', title }: { children?: ReactNode; title?: string }) {
  return (
    <span className="demo-tag" title={title ?? 'Not persisted. This prototype does not store or send files.'}>
      <span className="demo-tag__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function PlatformGlyph({ platform, size = 'md' }: { platform: Platform; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`pglyph pglyph--${size}`} style={{ ['--hue' as string]: platform.hue }} aria-hidden="true">
      {platform.glyph}
    </span>
  );
}

/** Badge for one specific account, e.g. "IG · Personal". */
export function AccountBadge({ account, showHandle = false }: { account: Account; showHandle?: boolean }) {
  const { data } = useStore();
  const platform = platformOf(data, account.platform);
  return (
    <span className="abadge" style={{ ['--hue' as string]: platform.hue }} title={`${platform.name} · ${account.handle}`}>
      <span className="abadge__glyph">{platform.glyph}</span>
      <span className="abadge__label">{showHandle ? account.handle : account.kind}</span>
    </span>
  );
}

const statusTone: Record<IdeaStatus | VersionStatus, string> = {
  Idea: 'neutral',
  Gathering: 'sand',
  Editing: 'violet',
  'In review': 'amber',
  Ready: 'green',
  'Ready to post': 'green',
  Planned: 'neutral',
  Posted: 'blue',
};

export function StatusPill({ status }: { status: IdeaStatus | VersionStatus }) {
  return (
    <span className={`status status--${statusTone[status]}`}>
      <span className="status__dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  const initials = person.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
  return (
    <span className="avatar" style={{ width: size, height: size, ['--hue' as string]: person.hue, fontSize: size * 0.38 }} title={`${person.name} — ${person.role}`}>
      {initials}
    </span>
  );
}

export function AvatarStack({ people }: { people: Person[] }) {
  return (
    <span className="avatar-stack">
      {people.map((p) => (
        <Avatar key={p.id} person={p} size={26} />
      ))}
    </span>
  );
}

export function PageHeader({ eyebrow, title, lede, actions, info }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; actions?: ReactNode; info?: HelpKey }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && (
          <p className="eyebrow">
            {eyebrow}
            {info && <InfoButton k={info} />}
          </p>
        )}
        <h1 className="display">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon = 'sparkle', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3, block = false }: { lines?: number; block?: boolean }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {block && <div className="skeleton__block" />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton__line" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

/** Grid of skeleton cards shown while a view "loads" (simulated in the demo). */
export function LoadingGrid({ count = 6, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div className="loading-grid" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <Skeleton block lines={2} />
        </div>
      ))}
    </div>
  );
}

/**
 * Simulates first-load latency so loading states are reviewable.
 * Set `?instant` in the URL (used by automated checks) to skip it.
 */
export function useSimulatedLoad(ms = 420): boolean {
  const skip = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('instant');
  const [ready, setReady] = useState(skip);
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms, ready]);
  return ready;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  compact = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <label className={`select ${compact ? 'select--compact' : ''}`}>
      <span className="select__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} className="select__chev" />
    </label>
  );
}

export function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a className={`ext-link ${className}`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Icon name="external" size={13} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function Progress({ value, label, tone = 'accent' }: { value: number; label: string; tone?: 'accent' | 'warn' | 'danger' | 'ok' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={`progress progress--${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <Icon name="arrowRight" size={14} />
    </Link>
  );
}

/** Close a popover when clicking outside or pressing Escape. */
export function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
