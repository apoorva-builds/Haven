import { useState } from 'react';
import type { VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { cutsOf, lengthLabel, notesOf, timecode } from '../../lib/videoStudio';
import { useStore } from '../../state/store';
import { useVideoClock } from './useVideoClock';

/** Two cuts side by side. Playback can be linked; timing between cuts may differ, and the page says so. */
export function CompareCuts({ project, left: initialLeft, right: initialRight }: { project: VideoProject; left?: string; right?: string }) {
  const { data } = useStore();
  const cuts = cutsOf(data, project.id);
  const playable = cuts.filter((c) => data.assets.find((a) => a.id === c.assetId)?.videoUrl);
  const [left, setLeft] = useState(initialLeft ?? playable[playable.length - 2]?.id ?? playable[0]?.id);
  const [right, setRight] = useState(initialRight ?? playable[playable.length - 1]?.id);
  const [linked, setLinked] = useState(true);
  const a = useSide(project, left);
  const b = useSide(project, right);

  if (playable.length < 2) {
    return <p className="muted compare__empty">Upload a second playable draft to compare drafts side by side.</p>;
  }

  const playBoth = () => {
    const playing = a.clock.playing || b.clock.playing;
    if (playing) {
      a.clock.ref.current?.pause();
      b.clock.ref.current?.pause();
    } else {
      if (linked && b.clock.ref.current && a.clock.ref.current) b.clock.ref.current.currentTime = Math.min(a.clock.t, b.clock.duration);
      void a.clock.ref.current?.play();
      void b.clock.ref.current?.play();
    }
  };
  const diff = a.duration && b.duration ? b.duration - a.duration : 0;
  const leftCut = cuts.find((c) => c.id === left);
  const rightCut = cuts.find((c) => c.id === right);

  return (
    <section className="compare" aria-label="Compare drafts" data-testid="compare">
      <div className="compare__bar">
        <button type="button" className="btn btn--primary btn--sm" onClick={playBoth}>
          {a.clock.playing || b.clock.playing ? 'Pause both' : <><Icon name="play" size={14} /> Play both</>}
        </button>
        <label className="check-row">
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
          <span>Link playheads</span>
        </label>
        <p className="muted small compare__warn">
          Linked playheads share a timestamp, not a moment: drafts can differ in timing.
          {diff !== 0 && leftCut && rightCut && (
            <>
              {' '}
              <strong>
                {rightCut.label} is {lengthLabel(Math.abs(diff))} {diff < 0 ? 'shorter' : 'longer'} than {leftCut.label}.
              </strong>
            </>
          )}
        </p>
      </div>
      <div className={`compare__grid compare__grid--${project.aspect === '16:9' ? 'wide' : 'tall'}`}>
        {[
          { side: a, value: left, set: setLeft, other: b },
          { side: b, value: right, set: setRight, other: a },
        ].map(({ side, value, set, other }, i) => (
          <figure key={i} className="compare__pane">
            <label className="compare__pick">
              <span className="sr-only">{i === 0 ? 'Left draft' : 'Right draft'}</span>
              <select value={value} onChange={(e) => set(e.target.value)} aria-label={i === 0 ? 'Left draft' : 'Right draft'}>
                {playable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.id === project.currentCutId ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {side.asset?.videoUrl && (
              <video
                ref={side.clock.ref}
                key={side.asset.id}
                src={side.asset.videoUrl}
                poster={side.asset.art.image}
                playsInline
                preload="metadata"
                controls
                onSeeked={() => {
                  if (!linked || !other.clock.ref.current || !side.clock.ref.current) return;
                  const to = Math.min(side.clock.ref.current.currentTime, other.clock.duration);
                  if (Math.abs(other.clock.ref.current.currentTime - to) > 0.3) other.clock.ref.current.currentTime = to;
                }}
                style={{ aspectRatio: project.aspect.replace(':', ' / ') }}
                data-testid={`compare-video-${i}`}
              />
            )}
            <figcaption>
              <span className="mono">{timecode(side.clock.t, side.duration)}</span> / {lengthLabel(side.duration)} · {side.open} open of {side.notes} notes
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function useSide(project: VideoProject, cutId: string | undefined) {
  const { data } = useStore();
  const cut = data.cuts.find((c) => c.id === cutId && c.projectId === project.id);
  const asset = data.assets.find((a) => a.id === cut?.assetId);
  const clock = useVideoClock(asset?.durationSec ?? 0, asset?.videoUrl);
  const notes = cut ? notesOf(data, cut.id) : [];
  return { cut, asset, clock, duration: clock.duration, notes: notes.length, open: notes.filter((n) => !n.resolved).length };
}
