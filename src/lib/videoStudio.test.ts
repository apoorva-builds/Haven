import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import type { Asset } from '../data/types';
import { reducer } from '../state/reducer';
import { authorize, scopeData } from './access';
import {
  cutDeletion,
  earlierFeedback,
  focusAt,
  groupBySection,
  lengthLabel,
  notesDocument,
  notesOf,
  parseTimecode,
  projectStorageMB,
  storageLimitGB,
  timecode,
  uniqueFiles,
  workspaceUsedGB,
} from './videoStudio';

const data = createDemoData();
const market = data.projects.find((p) => p.id === 'proj-market')!;
const morning = data.projects.find((p) => p.id === 'proj-morning')!;
const cut = (id: string) => data.cuts.find((c) => c.id === id)!;

describe('timecodes', () => {
  it('shows hours only for videos an hour or longer', () => {
    expect(timecode(26, 26)).toBe('0:26');
    expect(timecode(1700, 3600)).toBe('0:28:20');
    expect(timecode(3599, 3600)).toBe('0:59:59');
    expect(lengthLabel(26)).toBe('26 sec');
    expect(lengthLabel(3600)).toBe('1 hr 00 min');
  });
  it('parses what people type', () => {
    expect(parseTimecode('1:02:03')).toBe(3723);
    expect(parseTimecode('4:05')).toBe(245);
    expect(parseTimecode('45')).toBe(45);
    expect(parseTimecode('soon')).toBeUndefined();
  });
});

describe('the short sample and the one-hour sample', () => {
  it('Draft 2 is 26 seconds and the long cut is genuinely an hour', () => {
    expect(data.assets.find((a) => a.id === 'a-market-vertical')!.durationSec).toBe(26);
    expect(data.assets.find((a) => a.id === 'a-morning-wide')!.durationSec).toBe(3600);
  });
  it('the long cut has notes near the beginning, middle and end, and named chapters', () => {
    const notes = notesOf(data, 'c-morning-1');
    expect(notes.some((n) => n.startSec < 600)).toBe(true);
    expect(notes.some((n) => n.startSec > 1500 && n.startSec < 2100)).toBe(true);
    expect(notes.some((n) => n.startSec > 3000)).toBe(true);
    expect(data.chapters.filter((c) => c.cutId === 'c-morning-1')).toHaveLength(6);
  });
});

describe('notes follow playback', () => {
  const notes = notesOf(data, 'c-morning-1');
  it('focuses the note covering the playhead, with progress through its range', () => {
    const f = focusAt(notes, 1785);
    expect(f.note?.id).toBe('n-l-3');
    expect(f.current).toBe(true);
    expect(f.progress).toBeCloseTo((1785 - 1680) / 210, 3);
  });
  it('points to the next note between notes', () => {
    const f = focusAt(notes, 1000);
    expect(f.current).toBe(false);
    expect(f.note?.id).toBe('n-l-3');
  });
  it('a moment stays current for a few seconds', () => {
    expect(focusAt(notes, 239).note?.id).toBe('n-l-2');
  });
  it('groups by section in timeline order', () => {
    expect(groupBySection(notes, []).map((g) => g.section)[0]).toBe('Welcome and the plan');
  });
});

describe('drafts keep their own notes', () => {
  it('open notes on Draft 1 appear as earlier feedback on Draft 2, never re-timed', () => {
    const earlier = earlierFeedback(data, cut('c-market-2'));
    expect(earlier.map((e) => e.note.id)).toEqual(['n-m1-3']);
    expect(earlier[0].note.startSec).toBe(21);
    expect(earlier[0].from.label).toBe('Draft 1');
  });
  it('carrying forward copies to the new cut at the chosen time and leaves the original alone', () => {
    const next = reducer(data, { type: 'studio/note-carry', noteId: 'n-m1-3', toCutId: 'c-market-2', startSec: 17, endSec: 22, newId: 'n-carried' });
    const carried = next.notes.find((n) => n.id === 'n-carried')!;
    expect(carried).toMatchObject({ cutId: 'c-market-2', startSec: 17, endSec: 22, carriedFrom: 'n-m1-3', resolved: false });
    expect(next.notes.find((n) => n.id === 'n-m1-3')).toEqual(data.notes.find((n) => n.id === 'n-m1-3'));
    expect(earlierFeedback(next, cut('c-market-2'))).toHaveLength(0);
  });
  it('a new upload never replaces an earlier cut', () => {
    const asset = { ...data.assets.find((a) => a.id === 'a-market-draft1')!, id: 'a-d3', fingerprint: 'x3', sizeMB: 400 };
    const next = reducer(data, { type: 'studio/cut-add', cut: { id: 'c-3', projectId: market.id, label: 'Draft 3', kind: 'draft', assetId: 'a-d3', addedAt: new Date().toISOString(), addedById: 'me' }, asset, makeCurrent: true });
    expect(next.cuts.filter((c) => c.projectId === market.id).map((c) => c.label)).toEqual(['Draft 1', 'Draft 2', 'Draft 3']);
    expect(next.projects.find((p) => p.id === market.id)!.currentCutId).toBe('c-3');
    // Going back to an older version.
    const back = reducer(next, { type: 'studio/cut-current', cutId: 'c-market-1' });
    expect(back.projects.find((p) => p.id === market.id)!.currentCutId).toBe('c-market-1');
  });
  it('deleting a note leaves the video file untouched', () => {
    const next = reducer(data, { type: 'studio/note-delete', noteId: 'n-m2-1' });
    expect(next.assets).toBe(data.assets);
    expect(next.notes).toHaveLength(data.notes.length - 1);
  });
  it('exports one organised document with timestamps and sections', () => {
    const doc = notesDocument(data, morning, cut('c-morning-1'), 3600);
    expect(doc).toContain('# A quiet morning — long cut');
    expect(doc).toContain('### Midpoint: what changed this week');
    expect(doc).toContain('- [ ] 0:28:00–0:31:30 — Good honest check-in.');
    expect(doc).toContain('- [x] 0:59:40 — End screen safe area checked.');
    expect(doc).toContain('timestamps refer to Draft 1 only');
  });
});

describe('storage', () => {
  it('counts each file once, however many places use it', () => {
    const a = data.assets[0];
    const twice = [a, a, { ...a, id: 'copy-ref' } as Asset];
    expect(uniqueFiles(twice)).toHaveLength(a.fingerprint ? 1 : 2);
    // Draft 2 is used by four creations and one cut: counted once.
    const total = data.workspace.otherStorageGB + uniqueFiles(data.assets).reduce((s, x) => s + x.sizeMB, 0) / 1024;
    expect(workspaceUsedGB(data)).toBeCloseTo(total, 6);
    expect(projectStorageMB(data, market.id)).toBe(410 + 380);
  });
  it('a file added again with the same fingerprint adds nothing', () => {
    const dup = { ...data.assets.find((a) => a.id === 'a-market-vertical')!, id: 'again' };
    expect(workspaceUsedGB({ ...data, assets: [...data.assets, dup] })).toBeCloseTo(workspaceUsedGB(data), 9);
  });
  it('archived cuts still use storage; deleting frees space only when nothing else uses the file', () => {
    const archived = reducer(data, { type: 'studio/cut-archive', cutId: 'c-market-1', archived: true });
    expect(workspaceUsedGB(archived)).toBe(workspaceUsedGB(data));
    expect(cutDeletion(data, 'c-market-1')).toMatchObject({ freesMB: 410, keptFor: [] });
    const deleted = reducer(data, { type: 'studio/cut-delete', cutId: 'c-market-1' });
    expect(workspaceUsedGB(data) - workspaceUsedGB(deleted)).toBeCloseTo(410 / 1024, 6);
    expect(deleted.notes.some((n) => n.cutId === 'c-market-1')).toBe(false);
    // Draft 2 is used by the creations, so deleting its cut keeps the file.
    expect(cutDeletion(data, 'c-market-2').freesMB).toBe(0);
    const kept = reducer(data, { type: 'studio/cut-delete', cutId: 'c-market-2' });
    expect(kept.assets.some((a) => a.id === 'a-market-vertical')).toBe(true);
    expect(kept.projects.find((p) => p.id === market.id)!.currentCutId).toBe('c-market-1');
  });
  it('adding storage in the preview raises the allowance and charges nothing', () => {
    const next = reducer(data, { type: 'workspace/storage-add', gb: 500 });
    expect(storageLimitGB(next)).toBe(storageLimitGB(data) + 500);
  });
});

describe('Studio access', () => {
  it('an account-only collaborator (Sam) sees only the video made for their account', () => {
    const { data: s, hidden } = scopeData(data, 'sam');
    expect(s.projects.map((p) => p.id)).toEqual(['proj-market']);
    expect(hidden.projects.has('proj-morning')).toBe(true);
    // Only Sam's creation is listed, and the long cut's notes never reach the tab.
    expect(s.projects[0].versionIds).toEqual(['v-tt-pine']);
    expect(s.notes.some((n) => n.cutId === 'c-morning-1')).toBe(false);
    expect(s.assets.some((a) => a.id === 'a-morning-wide')).toBe(false);
  });
  it('Sam can add notes and drafts but not approve or delete', () => {
    const note = { id: 'n', cutId: 'c-market-2', startSec: 1, text: 'x', resolved: false, authorId: 'sam', createdAt: '' };
    expect(authorize(data, 'sam', { type: 'studio/note-add', note }).ok).toBe(true);
    expect(authorize(data, 'sam', { type: 'studio/approve', cutId: 'c-market-2', approved: true }).ok).toBe(false);
    expect(authorize(data, 'sam', { type: 'studio/cut-delete', cutId: 'c-market-1' }).ok).toBe(false);
    expect(authorize(data, 'sam', { type: 'studio/note-add', note: { ...note, cutId: 'c-morning-1' } }).ok).toBe(false);
    expect(authorize(data, 'sam', { type: 'studio/plan-update', ideaId: 'market-phrases', patch: { concept: 'x' } }).ok).toBe(false);
  });
  it('view-only access lets someone watch and read notes, not write them', () => {
    const viewOnly = { ...data, members: data.members.map((m) => (m.personId === 'sam' ? { ...m, grants: [{ scope: { kind: 'account' as const, id: 'tt-pine' }, capabilities: ['view' as const] }] } : m)) };
    expect(scopeData(viewOnly, 'sam').data.projects.map((p) => p.id)).toEqual(['proj-market']);
    const note = { id: 'n', cutId: 'c-market-2', startSec: 1, text: 'x', resolved: false, authorId: 'sam', createdAt: '' };
    expect(authorize(viewOnly, 'sam', { type: 'studio/note-add', note }).ok).toBe(false);
  });
  it('owners and admins see every video', () => {
    expect(scopeData(data, 'priya').data.projects).toHaveLength(2);
  });
});
