import { useEffect, useRef, useState } from 'react';
import type { Asset, AssetKind } from '../data/types';
import { formatSize } from '../lib/dates';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { DemoTag, Progress } from './ui';

interface Job {
  id: string;
  name: string;
  sizeMB: number;
  progress: number;
  state: 'uploading' | 'paused' | 'failed' | 'done';
  /** The demo deterministically fails the second file once, to show retry. */
  failAt?: number;
  /** Browser-local URL for a playable video (object URL or bundled sample). */
  videoUrl?: string;
  mediaSource?: Asset['mediaSource'];
}

interface Incoming {
  name: string;
  size: number;
  file?: File;
  sampleUrl?: string;
}

const isVideoFile = (f: Incoming) => (f.file ? f.file.type.startsWith('video/') : /\.(mov|mp4|m4v|webm|mkv)$/i.test(f.name));

/** Object URL for a video chosen on this device. It never leaves the tab. */
export function localVideoUrl(file: File): string | undefined {
  return file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined;
}

function kindFromName(name: string): AssetKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // Uploads here are source material; finished edits go through a version's picker.
  if (['mov', 'mp4', 'm4v', 'avi', 'mkv', 'webm'].includes(ext)) return 'raw';
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'].includes(ext)) return 'photo';
  if (['wav', 'mp3', 'aac', 'm4a', 'aif', 'aiff'].includes(ext)) return 'audio';
  return 'document';
}

/**
 * Simulated upload queue. Nothing is sent anywhere. For videos, the browser
 * makes a local object URL so the file can play in the page; everything else
 * uses only the name and size. Results exist for this browser session only,
 * and every surface says so.
 */
export function DemoUploader({ ideaId, toLibrary = false }: { ideaId?: string; toLibrary?: boolean }) {
  const { data, dispatch } = useStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const failedOnce = useRef(false);

  useEffect(() => {
    if (!jobs.some((j) => j.state === 'uploading')) return;
    const t = setInterval(() => {
      setJobs((list) =>
        list.map((j) => {
          if (j.state !== 'uploading') return j;
          const step = Math.max(0.04, 18 / Math.max(20, j.sizeMB));
          const next = Math.min(1, j.progress + step);
          if (j.failAt && next >= j.failAt) return { ...j, progress: j.failAt, state: 'failed', failAt: undefined };
          return { ...j, progress: next, state: next >= 1 ? 'done' : 'uploading' };
        }),
      );
    }, 220);
    return () => clearInterval(t);
  }, [jobs]);

  // When a job completes, register a session-only asset.
  const registered = useRef(new Set<string>());
  useEffect(() => {
    jobs
      .filter((j) => j.state === 'done' && !registered.current.has(j.id))
      .forEach((j) => {
        registered.current.add(j.id);
        const hue = Math.floor(Math.random() * 360);
        const duplicate = data.assets.find((a) => a.name === j.name && Math.abs(a.sizeMB - j.sizeMB) < 1);
        const asset: Asset = {
          id: j.id,
          name: j.name,
          kind: kindFromName(j.name),
          ideaIds: ideaId ? [ideaId] : [],
          inLibrary: toLibrary,
          sizeMB: j.sizeMB,
          art: { motif: 'grain', hue, hue2: (hue + 40) % 360 },
          favorite: false,
          storage: 'original',
          uploadedById: data.currentUserId,
          uploadedAt: data.today,
          tags: ['session upload'],
          platforms: [],
          moments: [],
          duplicateOfId: duplicate?.id,
          sessionOnly: true,
          videoUrl: j.videoUrl,
          mediaSource: j.videoUrl ? j.mediaSource : undefined,
        };
        dispatch({ type: 'asset/add-session', asset });
      });
  }, [jobs, data.assets, data.currentUserId, data.today, dispatch, ideaId, toLibrary]);

  const addFiles = (files: Incoming[]) => {
    setJobs((list) => [
      ...list,
      ...files.map((f, i) => {
        const shouldFail = !failedOnce.current && (list.length + i) % 2 === 1;
        if (shouldFail) failedOnce.current = true;
        return {
          id: `up-${Date.now().toString(36)}-${i}`,
          name: f.name,
          sizeMB: Math.max(0.1, f.size / 1024 / 1024),
          progress: 0,
          state: 'uploading' as const,
          failAt: shouldFail ? 0.45 : undefined,
          videoUrl: f.sampleUrl ?? (f.file && isVideoFile(f) ? localVideoUrl(f.file) : undefined),
          mediaSource: f.sampleUrl ? ('bundled-sample' as const) : ('device-session' as const),
        };
      }),
    ]);
  };

  const sample = () =>
    addFiles([
      { name: 'Phone clip — kiln glow.webm', size: 640 * 1024 * 1024, sampleUrl: '/demo-media/slow-mornings-vertical.webm' },
      { name: 'Phone photo — shelf.heic', size: 4.2 * 1024 * 1024 },
    ]);

  const update = (id: string, patch: Partial<Job>) => setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  return (
    <div className="uploader">
      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files).map((f) => ({ name: f.name, size: f.size, file: f })));
        }}
      >
        <Icon name="upload" size={22} />
        <div>
          <p className="dropzone__title">
            Drop footage, photos or audio <DemoTag>Demo upload</DemoTag>
          </p>
          <p className="dropzone__hint">Simulated progress only. Files never leave your browser; videos play in the page from this tab and are gone after reload.</p>
        </div>
        <div className="dropzone__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()}>
            Choose files
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={sample}>
            Try sample files
          </button>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          data-testid="upload-input"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size, file: f })));
            e.target.value = '';
          }}
        />
      </div>
      {jobs.length > 0 && (
        <ul className="upload-list" aria-label="Demo upload queue">
          {jobs.map((j) => (
            <li key={j.id} className={`upload upload--${j.state}`}>
              <span className="upload__name">
                {j.name}
                <span className="muted"> · {formatSize(j.sizeMB)}</span>
              </span>
              <Progress
                value={j.progress}
                label={`Demo upload of ${j.name}`}
                tone={j.state === 'failed' ? 'danger' : j.state === 'done' ? 'ok' : j.state === 'paused' ? 'warn' : 'accent'}
              />
              <span className="upload__state">
                {j.state === 'uploading' && `${Math.round(j.progress * 100)}% (simulated)`}
                {j.state === 'paused' && `Paused at ${Math.round(j.progress * 100)}%`}
                {j.state === 'failed' && `Interrupted at ${Math.round(j.progress * 100)}% (simulated)`}
                {j.state === 'done' && 'Added for this session only — not stored'}
              </span>
              <span className="upload__actions">
                {j.state === 'uploading' && (
                  <button type="button" className="link-btn" onClick={() => update(j.id, { state: 'paused' })}>
                    Pause
                  </button>
                )}
                {j.state === 'paused' && (
                  <button type="button" className="link-btn" onClick={() => update(j.id, { state: 'uploading' })}>
                    Resume
                  </button>
                )}
                {j.state === 'failed' && (
                  <button type="button" className="link-btn" onClick={() => update(j.id, { state: 'uploading' })}>
                    Retry from {Math.round(j.progress * 100)}%
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
