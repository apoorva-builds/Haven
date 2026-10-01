import type { Asset, Chapter, Cut, DemoData, Person, TimeNote, VideoProject } from '../data/types';

/*
 * Video Studio helpers: timecodes, which note is "now", earlier feedback to
 * carry forward, the notes document, and storage that counts each file once.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** 0:07, 4:05, 1:02:03. Hours appear only when the video is at least an hour long. */
export function timecode(sec: number, totalSec = sec): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return totalSec >= 3600 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "26 sec", "4 min 05 sec", "1 hr 00 min": always the real length. */
export function lengthLabel(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} sec`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${pad(s % 60)} sec`;
  return `${Math.floor(s / 3600)} hr ${pad(Math.floor((s % 3600) / 60))} min`;
}

/** Parse "1:02:03", "4:05" or "45" into seconds. Undefined when it isn't a time. */
export function parseTimecode(text: string): number | undefined {
  const parts = text.trim().split(':');
  if (!parts.length || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export const noteRange = (n: Pick<TimeNote, 'startSec' | 'endSec'>) => (n.endSec !== undefined ? `${n.startSec}-${n.endSec}` : `${n.startSec}`);

/** A moment note stays "current" for this long after its time. */
export const MOMENT_WINDOW = 3;

export const noteEnd = (n: TimeNote) => n.endSec ?? n.startSec + MOMENT_WINDOW;

export const cutsOf = (data: DemoData, projectId: string): Cut[] =>
  data.cuts.filter((c) => c.projectId === projectId).sort((a, b) => a.addedAt.localeCompare(b.addedAt));

export const notesOf = (data: DemoData, cutId: string): TimeNote[] =>
  data.notes.filter((n) => n.cutId === cutId).sort((a, b) => a.startSec - b.startSec || (a.endSec ?? a.startSec) - (b.endSec ?? b.startSec));

export const chaptersOf = (data: DemoData, cutId: string): Chapter[] => data.chapters.filter((c) => c.cutId === cutId).sort((a, b) => a.startSec - b.startSec);

/** The chapter playing at a time. */
export const chapterAt = (chapters: Chapter[], t: number): Chapter | undefined => chapters.reduce<Chapter | undefined>((acc, c) => (t >= c.startSec ? c : acc), undefined);

/**
 * The note to focus at a playback time: the most recently started note that
 * covers it; otherwise the next one coming up (so the panel always has a
 * place). `progress` is how far through the current range playback is.
 */
export function focusAt(notes: TimeNote[], t: number): { note?: TimeNote; current: boolean; progress: number } {
  const covering = notes.filter((n) => t >= n.startSec && t < noteEnd(n));
  if (covering.length) {
    const note = covering.reduce((a, b) => (b.startSec >= a.startSec ? b : a));
    return { note, current: true, progress: Math.min(1, (t - note.startSec) / Math.max(0.001, noteEnd(note) - note.startSec)) };
  }
  const next = notes.find((n) => n.startSec > t);
  return { note: next, current: false, progress: 0 };
}

/**
 * Open notes on earlier cuts that haven't been carried to this cut. Their
 * timestamps refer to the earlier cut; the UI must say so.
 */
export function earlierFeedback(data: DemoData, cut: Cut): { note: TimeNote; from: Cut }[] {
  const earlier = cutsOf(data, cut.projectId).filter((c) => c.addedAt < cut.addedAt && c.id !== cut.id);
  const carried = new Set(data.notes.filter((n) => n.carriedFrom).map((n) => n.carriedFrom));
  return earlier.flatMap((from) =>
    notesOf(data, from.id)
      .filter((n) => !n.resolved && !carried.has(n.id))
      .map((note) => ({ note, from })),
  );
}

/** Notes grouped by section, sections in order of first appearance on the timeline. */
export function groupBySection(notes: TimeNote[], chapters: Chapter[]): { section: string; notes: TimeNote[] }[] {
  const groups = new Map<string, TimeNote[]>();
  for (const n of notes) {
    const key = n.section?.trim() || chapterAt(chapters, n.startSec)?.title || 'Notes';
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups.entries()].map(([section, list]) => ({ section, notes: list }));
}

/** One organised document of every note on a cut, for export. */
export function notesDocument(data: DemoData, project: VideoProject, cut: Cut, durationSec: number): string {
  const notes = notesOf(data, cut.id);
  const chapters = chaptersOf(data, cut.id);
  const who = (id: string): Person | undefined => data.people.find((p) => p.id === id);
  const fmt = (n: TimeNote) => (n.endSec !== undefined ? `${timecode(n.startSec, durationSec)}–${timecode(n.endSec, durationSec)}` : timecode(n.startSec, durationSec));
  const open = notes.filter((n) => !n.resolved).length;
  const lines = [
    `# ${project.title}`,
    `## Notes on ${cut.label}`,
    '',
    `Length ${timecode(durationSec, durationSec)} · ${notes.length} notes · ${open} open · ${notes.length - open} resolved`,
    `Exported from Haven (preview) · timestamps refer to ${cut.label} only`,
    '',
  ];
  if (chapters.length) {
    lines.push('### Chapters', ...chapters.map((c) => `- ${timecode(c.startSec, durationSec)} ${c.title}`), '');
  }
  for (const g of groupBySection(notes, chapters)) {
    lines.push(`### ${g.section}`);
    for (const n of g.notes) {
      const carried = n.carriedFrom ? ' (carried forward from an earlier cut)' : '';
      lines.push(`- [${n.resolved ? 'x' : ' '}] ${fmt(n)} — ${n.text} — ${who(n.authorId)?.name ?? 'Someone'}${carried}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------------
 * Storage. A file is counted once however many places link to it: the same
 * asset used by several cuts and creations, or two references with the same
 * content fingerprint.
 * ---------------------------------------------------------------------- */

export const fileKey = (a: Asset) => a.fingerprint ?? a.id;

export function uniqueFiles(assets: Asset[]): Asset[] {
  const seen = new Map<string, Asset>();
  for (const a of assets) if (!seen.has(fileKey(a))) seen.set(fileKey(a), a);
  return [...seen.values()];
}

export const sumMB = (assets: Asset[]) => uniqueFiles(assets).reduce((s, a) => s + a.sizeMB, 0);

export const storageLimitGB = (data: DemoData) => data.workspace.storageLimitGB + (data.workspace.addedStorageGB ?? 0);

/** Workspace total: the modelled baseline plus every distinct file. */
export const workspaceUsedGB = (data: DemoData) => data.workspace.otherStorageGB + sumMB(data.assets) / 1024;

/** Storage used by one video's cuts (each file once). */
export function projectStorageMB(data: DemoData, projectId: string): number {
  const ids = new Set(cutsOf(data, projectId).map((c) => c.assetId));
  return sumMB(data.assets.filter((a) => ids.has(a.id)));
}

/** Everywhere else a file is used, besides one cut. */
export function otherUses(data: DemoData, assetId: string, exceptCutId?: string): string[] {
  const uses: string[] = [];
  const asset = data.assets.find((a) => a.id === assetId);
  for (const c of data.cuts) {
    if (c.assetId === assetId && c.id !== exceptCutId) {
      const p = data.projects.find((x) => x.id === c.projectId);
      uses.push(`${c.label} of “${p?.title ?? 'another video'}”`);
    }
  }
  for (const v of data.versions) {
    if (v.mediaAssetId === assetId || v.coverAssetId === assetId || v.photoAssetIds?.includes(assetId)) {
      const a = data.accounts.find((x) => x.id === v.accountId);
      const p = a && data.platforms.find((x) => x.id === a.platform);
      uses.push(`${p?.name ?? ''} ${a?.handle ?? ''} creation`.trim());
    }
  }
  if (asset?.inLibrary) uses.push('Raw Library');
  if (asset?.fingerprint && data.assets.some((x) => x.id !== assetId && x.fingerprint === asset.fingerprint)) uses.push('another reference to the same file');
  return uses;
}

/** What deleting a cut would do: notes removed; the file freed only when nothing else uses it. */
export function cutDeletion(data: DemoData, cutId: string): { notes: number; freesMB: number; keptFor: string[] } {
  const cut = data.cuts.find((c) => c.id === cutId);
  if (!cut) return { notes: 0, freesMB: 0, keptFor: [] };
  const keptFor = otherUses(data, cut.assetId, cutId);
  const size = data.assets.find((a) => a.id === cut.assetId)?.sizeMB ?? 0;
  return { notes: data.notes.filter((n) => n.cutId === cutId).length, freesMB: keptFor.length ? 0 : size, keptFor };
}

/** Sample add-on pricing for the preview. Illustrative, not an offer. */
export const STORAGE_ADDONS = [
  { gb: 500, monthlyUSD: 6 },
  { gb: 1024, monthlyUSD: 10 },
  { gb: 2048, monthlyUSD: 18 },
] as const;

/** The path a video takes through Haven. */
export const STUDIO_STEPS = ['Plan', 'Upload', 'Annotate', 'Revise', 'Approve', 'Post', 'Revisit'] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

/** How far a video has come, step by step. */
export function stepsDone(data: DemoData, project: VideoProject): Record<StudioStep, boolean> {
  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const cuts = cutsOf(data, project.id);
  const cutIds = new Set(cuts.map((c) => c.id));
  const notes = data.notes.filter((n) => cutIds.has(n.cutId));
  const versions = data.versions.filter((v) => project.versionIds.includes(v.id));
  const posted = versions.some((v) => v.status === 'Posted');
  return {
    Plan: !!idea && (!!idea.plan?.hook || !!idea.concept || (idea.plan?.outline.length ?? 0) > 0),
    Upload: cuts.length > 0,
    Annotate: notes.length > 0,
    Revise: cuts.filter((c) => c.kind !== 'footage').length > 1,
    Approve: !!project.approvedCutId,
    Post: posted,
    Revisit: posted,
  };
}
