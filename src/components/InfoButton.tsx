import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HELP, type HelpKey } from '../lib/help';

const OPEN_EVENT = 'haven:info-open';

/**
 * ⓘ button that reveals a short explanation on click or tap.
 * One open at a time; closes on Escape (returning focus), outside click, or
 * another ⓘ opening. The panel stays within the viewport on small screens.
 */
export function InfoButton({ k }: { k: HelpKey }) {
  const { topic, text } = HELP[k];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const vw = document.documentElement.clientWidth;
    const width = Math.min(300, vw - 32);
    const left = Math.max(16, Math.min(r.left - 12, vw - width - 16));
    setPos({ top: r.bottom + 8, left, width });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrap.current?.contains(target) && !pop.current?.contains(target)) close();
    };
    const onOther = (e: Event) => (e as CustomEvent<string>).detail !== id && close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener(OPEN_EVENT, onOther);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener(OPEN_EVENT, onOther);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, close, place, id]);

  return (
    <span className="info" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`info__btn ${open ? 'is-open' : ''}`}
        aria-label={`About ${topic}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (!open) document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
          setOpen((o) => !o);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.9" r="1" fill="currentColor" />
          <path d="M8 7.2v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {/* Toggletip: announce the explanation next to the button for screen readers. */}
      <span className="sr-only" role="status">
        {open ? `${topic}. ${text}` : ''}
      </span>
      {open &&
        pos &&
        createPortal(
          <span ref={pop} id={id} role="region" aria-label={`About ${topic}`} className="info__pop" style={{ top: pos.top, left: pos.left, width: pos.width }}>
            <span className="info__topic">{topic}</span>
            <span className="info__text">{text}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
