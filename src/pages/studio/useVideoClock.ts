import { useCallback, useEffect, useRef, useState } from 'react';

/** What the player is doing, so the UI can say so instead of looking stuck. */
export type LoadState = 'loading' | 'ready' | 'seeking' | 'buffering' | 'error';

/**
 * Playback state for one <video>.
 *
 * - Time follows the picture every animation frame while playing, and only
 *   re-renders when the shown time changes.
 * - Seeks go straight to the exact time (no keyframe snapping), and the
 *   state reports "seeking" or "buffering" until the frame is actually ready.
 * - Without a playable file the clock is virtual: seeking moves the playhead.
 */
export function useVideoClock(fallbackDuration: number, src: string | undefined) {
  const hasFile = !!src;
  const ref = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState<LoadState>(hasFile ? 'loading' : 'ready');
  const [buffered, setBuffered] = useState<[number, number][]>([]);
  /** Where a seek is heading, shown while the frame loads. */
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    setDuration(fallbackDuration);
    setT(0);
    setPlaying(false);
    setTarget(null);
    setState(src ? 'loading' : 'ready');
    setBuffered([]);
  }, [fallbackDuration, src]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    let last = -1;
    const show = () => {
      // ~30 updates a second is smooth to the eye and keeps React work small.
      const now = Math.round(v.currentTime * 30) / 30;
      if (now !== last) {
        last = now;
        setT(v.currentTime);
      }
    };
    const tick = () => {
      show();
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const readBuffered = () => {
      const out: [number, number][] = [];
      for (let i = 0; i < v.buffered.length; i++) out.push([v.buffered.start(i), v.buffered.end(i)]);
      setBuffered(out);
    };
    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    };
    const onReady = () => {
      if (v.seeking) return;
      setState('ready');
      setTarget(null);
      show();
      readBuffered();
    };
    const on: Record<string, () => void> = {
      loadedmetadata: onMeta,
      durationchange: onMeta,
      loadeddata: onReady,
      canplay: onReady,
      playing: () => {
        setState('ready');
        setTarget(null);
      },
      play: () => {
        setPlaying(true);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      },
      pause: () => {
        setPlaying(false);
        show();
      },
      ended: () => {
        setPlaying(false);
        show();
      },
      loadstart: () => setState('loading'),
      seeking: () => setState('seeking'),
      seeked: onReady,
      waiting: () => setState(v.seeking ? 'seeking' : 'buffering'),
      progress: readBuffered,
      timeupdate: () => {
        if (v.paused) show();
      },
      error: () => setState('error'),
    };
    for (const [k, fn] of Object.entries(on)) v.addEventListener(k, fn);
    onMeta();
    if (v.readyState >= 2) onReady();
    if (v.error) setState('error');
    return () => {
      cancelAnimationFrame(raf);
      for (const [k, fn] of Object.entries(on)) v.removeEventListener(k, fn);
    };
  }, [src]);

  const seek = useCallback(
    (sec: number) => {
      const next = Math.max(0, Math.min(duration || sec, sec));
      setT(next);
      if (ref.current && hasFile) {
        setTarget(next);
        ref.current.currentTime = next;
      }
    },
    [duration, hasFile],
  );

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v || !hasFile) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [hasFile]);

  const pause = useCallback(() => ref.current?.pause(), []);

  return { ref, t, duration, playing, state, buffered, target, seek, toggle, pause, hasFile };
}
