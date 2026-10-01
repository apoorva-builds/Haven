import { useRef, useState } from 'react';
import type { Asset, Cut, CutKind, VideoProject } from '../../data/types';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { AddStorageModal } from '../../components/Storage';
import { DemoTag, Progress } from '../../components/ui';
import { formatSize } from '../../lib/dates';
import { cutsOf, storageLimitGB, workspaceUsedGB } from '../../lib/videoStudio';
import { uid } from '../../state/reducer';
import { useStore } from '../../state/store';

type Phase =
  | { kind: 'idle' }
  | { kind: 'working'; step: string; progress: number }
  | { kind: 'error'; message: string; storage?: boolean }
  | { kind: 'done' };

const KIND_LABEL: Record<CutKind, string> = { footage: 'Original footage', draft: 'Draft', final: 'Final video' };

/**
 * Fingerprint a file from evenly spaced samples plus its size, so the same
 * file added twice is recognised and stored once. Progress is real: one step
 * per sample read.
 */
async function fingerprint(file: Blob, onProgress: (p: number) => void): Promise<string> {
  const samples = 16;
  const chunk = 256 * 1024;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samples; i++) {
    const at = Math.floor(((file.size - chunk) * i) / Math.max(1, samples - 1));
    parts.push(new Uint8Array(await file.slice(Math.max(0, at), Math.max(0, at) + chunk).arrayBuffer()));
    onProgress((i + 1) / samples);
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0) + 8);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  new DataView(all.buffer).setFloat64(o, file.size);
  if (crypto?.subtle) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
    return 'sha256:' + [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const b of all) h = Math.imul(h ^ b, 16777619);
  return 'fnv:' + (h >>> 0).toString(16);
}

/** Read a video's real length in this browser; fails if the browser can't decode it. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => (Number.isFinite(v.duration) ? resolve(v.duration) : reject(new Error('no duration')));
    v.onerror = () => reject(new Error('unreadable'));
    v.src = url;
  });
}

export function UploadCut({ project, onClose, onAdded, initialKind }: { project: VideoProject; onClose: () => void; onAdded: (cut: Cut) => void; initialKind?: CutKind }) {
  const { data, dispatch } = useStore();
  const cuts = cutsOf(data, project.id);
  const drafts = cuts.filter((c) => c.kind === 'draft').length;
  const current = cuts.find((c) => c.id === project.currentCutId);
  const finals = cuts.filter((c) => c.kind === 'final').length;
  const labelFor = (k: CutKind) => (k === 'draft' ? `Draft ${drafts + 1}` : k === 'final' ? (finals ? `Final ${finals + 1}` : 'Final') : KIND_LABEL[k]);
  const [kind, setKind] = useState<CutKind>(initialKind ?? (cuts.length === 0 ? 'footage' : 'draft'));
  const [label, setLabel] = useState(labelFor(initialKind ?? (cuts.length === 0 ? 'footage' : 'draft')));
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [file, setFile] = useState<{ name: string; size: number; blob?: Blob; url: string; sample?: string } | null>(null);
  // The sample button re-uses this video's latest bundled draft, so it links rather than copies.
  const sampleAsset = [...cuts].reverse().map((c) => data.assets.find((a) => a.id === c.assetId)).find((a) => a?.mediaSource === 'bundled-sample' && a.fingerprint);
  const [linkedTo, setLinkedTo] = useState<Asset | null>(null);
  /** The version that was current when this upload started; it stays in the history. */
  const [previous, setPrevious] = useState<string | undefined>();
  const [addStorage, setAddStorage] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const idea = data.ideas.find((i) => i.id === project.ideaId);

  const freeMB = (storageLimitGB(data) - workspaceUsedGB(data)) * 1024;

  const run = async (f: NonNullable<typeof file>) => {
    setFile(f);
    setLinkedTo(null);
    if (f.blob && f.blob.type && !f.blob.type.startsWith('video/')) {
      setPhase({ kind: 'error', message: `“${f.name}” isn’t a video file. Nothing was added.` });
      return;
    }
    if (f.size === 0) {
      setPhase({ kind: 'error', message: `“${f.name}” is empty. Nothing was added.` });
      return;
    }
    try {
      setPhase({ kind: 'working', step: 'Reading the file on this device', progress: 0 });
      const blob = f.blob ?? (await (await fetch(f.url)).blob());
      const print = f.sample ? f.sample : await fingerprint(blob, (p) => setPhase({ kind: 'working', step: 'Reading the file on this device', progress: p * 0.7 }));
      const existing = data.assets.find((a) => a.fingerprint === print);
      const sizeMB = f.size / 1024 / 1024;
      if (!existing && sizeMB > freeMB) {
        setPhase({ kind: 'error', storage: true, message: `This file needs ${formatSize(sizeMB)}, and ${formatSize(Math.max(0, freeMB))} is free. Nothing was added or replaced.` });
        return;
      }
      setPhase({ kind: 'working', step: 'Checking it plays in this browser', progress: 0.8 });
      const duration = existing?.durationSec ?? (await probeDuration(f.url));
      setPhase({ kind: 'working', step: 'Adding to the video', progress: 1 });

      const cutId = uid('cut');
      const asset: Asset | undefined = existing
        ? undefined
        : {
            id: uid('asset'),
            name: f.name,
            kind: kind === 'footage' ? 'raw' : kind === 'final' ? 'final' : 'draft',
            ideaIds: [project.ideaId],
            inLibrary: false,
            sizeMB,
            durationSec: duration,
            art: { motif: 'grain', hue: idea?.art.hue ?? 30, hue2: idea?.art.hue2 ?? 200 },
            favorite: false,
            storage: 'original',
            uploadedById: data.currentUserId,
            uploadedAt: data.today,
            tags: ['session upload'],
            platforms: [],
            moments: [],
            sessionOnly: true,
            fingerprint: print,
            videoUrl: f.url,
            mediaSource: 'device-session',
          };
      const cut: Cut = { id: cutId, projectId: project.id, label: label.trim() || KIND_LABEL[kind], kind, assetId: existing?.id ?? asset!.id, addedAt: new Date().toISOString(), addedById: data.currentUserId };
      setPrevious(current?.label);
      dispatch({ type: 'studio/cut-add', cut, asset, makeCurrent });
      setLinkedTo(existing ?? null);
      setPhase({ kind: 'done' });
      onAdded(cut);
    } catch {
      setPhase({ kind: 'error', message: `This browser can’t play “${f.name}”, so it wasn’t added. Try MP4 (H.264) or WebM.` });
    }
  };

  const choose = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    void run({ name: f.name, size: f.size, blob: f, url: URL.createObjectURL(f) });
  };

  const busy = phase.kind === 'working';

  return (
    <Modal
      title={kind === 'final' ? `Upload the final video of “${project.title}”` : `Upload a draft of “${project.title}”`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <DemoTag title="Files stay in this browser tab. Nothing is uploaded to a server in the preview.">Stays on this device</DemoTag>
          <span className="spacer" />
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            {phase.kind === 'done' ? 'Done' : 'Cancel'}
          </button>
        </>
      }
    >
      {phase.kind !== 'done' && (
        <>
          <div className="upcut__fields">
            <label className="field">
              <span>Name</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} />
            </label>
            <label className="field">
              <span>What is it?</span>
              <select
                value={kind}
                disabled={busy}
                onChange={(e) => {
                  const k = e.target.value as CutKind;
                  setKind(k);
                  setLabel(labelFor(k));
                }}
              >
                {(Object.keys(KIND_LABEL) as CutKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} disabled={busy} />
            <span>
              Make it the current version{current && <span className="muted"> · {current.label} stays in the history, unchanged</span>}
            </span>
          </label>

          <div
            className={`upcut__drop ${busy ? 'is-busy' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) choose(e.dataTransfer.files);
            }}
          >
            <Icon name="upload" size={22} />
            <p>
              Drop a video here, or{' '}
              <button type="button" className="inline-link" onClick={() => input.current?.click()} disabled={busy}>
                choose a file
              </button>
              . No length limit; storage is the only limit ({formatSize(Math.max(0, freeMB))} free).
            </p>
            <input ref={input} type="file" accept="video/*" hidden onChange={(e) => choose(e.target.files)} data-testid="cut-file" />
            {sampleAsset && (
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void run({ name: sampleAsset.name, size: sampleAsset.sizeMB * 1024 * 1024, url: sampleAsset.videoUrl!, sample: sampleAsset.fingerprint })}>
              Try with a sample file
            </button>
            )}
          </div>
        </>
      )}

      {phase.kind === 'working' && (
        <div className="upcut__progress" role="status" data-testid="upload-progress">
          <p>
            <strong>{file?.name}</strong> · {phase.step}…
          </p>
          <Progress value={phase.progress} label={phase.step} />
        </div>
      )}
      {phase.kind === 'error' && (
        <div className="upcut__error" role="alert" data-testid="upload-error">
          <Icon name="alert" size={16} />
          <div>
            <p>{phase.message}</p>
            <p className="muted small">Earlier drafts are untouched.</p>
            <div className="upcut__retry">
              {phase.storage && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setAddStorage(true)}>
                  Add storage
                </button>
              )}
              {file && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void run(file)}>
                  Try again
                </button>
              )}
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()}>
                Choose another file
              </button>
            </div>
          </div>
        </div>
      )}
      {phase.kind === 'done' && file && (
        <div className="upcut__done" role="status" data-testid="upload-done">
          <Icon name="check" size={18} />
          <div>
            <p>
              <strong>{label}</strong> added{makeCurrent ? ' and is now the current version' : ''}.{previous && makeCurrent && ` ${previous} is kept in the history.`}
            </p>
            {linkedTo ? (
              <p className="muted small">
                This file is already in the workspace as “{linkedTo.name}”. It’s linked, not copied, so storage counts it once.
              </p>
            ) : (
              <p className="muted small">
                {formatSize(file.size / 1024 / 1024)} · plays from this device for this session only.
              </p>
            )}
          </div>
        </div>
      )}
      {addStorage && <AddStorageModal onClose={() => setAddStorage(false)} />}
    </Modal>
  );
}
