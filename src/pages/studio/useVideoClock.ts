import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Playback state for one <video>. Time updates every animation frame while
 * playing, so notes and the timeline follow the picture closely. Without a
 * playable file the clock is virtual: seeking still moves the playhead.
 */
export function useVideoClock(fallbackDuration: number, src: string | undefined) {
  const hasFile = !!src;
  const ref = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDuration(fallbackDuration);
    setT(0);
    setPlaying(false);
    setError(false);
  }, [fallbackDuration, src]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      setT(v.currentTime);
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      setT(v.currentTime);
    };
    const onSeeked = () => setT(v.currentTime);
    const onError = () => setError(true);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onPause);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('timeupdate', onSeeked);
    v.addEventListener('error', onError);
    onMeta();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('timeupdate', onSeeked);
      v.removeEventListener('error', onError);
    };
  }, [src]);

  const seek = useCallback(
    (sec: number) => {
      const next = Math.max(0, Math.min(duration || sec, sec));
      if (ref.current && hasFile) ref.current.currentTime = next;
      setT(next);
    },
    [duration, hasFile],
  );

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v || !hasFile) return;
    if (v.paused) void v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [hasFile]);

  return { ref, t, duration, playing, error, seek, toggle };
}
