import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import type { Asset } from '../data/types';
import type { Action } from '../state/reducer';
import { authorize } from './access';

const data = createDemoData();
const upload = (over: Partial<Asset>): Asset => ({
  id: 'new', name: 'clip.mov', kind: 'raw', ideaIds: [], inLibrary: false, sizeMB: 1, art: { motif: 'grain', hue: 0, hue2: 0 },
  favorite: false, storage: 'original', uploadedById: 'sam', uploadedAt: data.today, tags: [], platforms: [], moments: [], ...over,
});

/**
 * One sample of every action type. `satisfies` makes this fail to compile
 * when an action type is added without a case here.
 */
const SAMPLES = {
  'task/toggle': { type: 'task/toggle', taskId: 't5' },
  'task/add': { type: 'task/add', task: { title: 'x', ideaId: 'morning-routine', versionId: 'v-yt-pine', ownerId: 'jonah', due: data.today, stage: 'Edit' } },
  'idea/add': { type: 'idea/add', title: 'x', accountIds: ['yt-pine'] },
  'idea/status': { type: 'idea/status', ideaId: 'market-phrases', status: 'Ready' },
  'idea/archive': { type: 'idea/archive', ideaId: 'market-phrases', archived: true },
  'idea/delete': { type: 'idea/delete', ideaId: 'market-phrases' },
  'idea/shot-toggle': { type: 'idea/shot-toggle', ideaId: 'market-phrases', shotId: 's1' },
  'version/add': { type: 'version/add', ideaId: 'market-phrases', accountId: 'yt-pine' },
  'version/status': { type: 'version/status', versionId: 'v-ig-atlas', status: 'Editing' },
  'version/caption': { type: 'version/caption', versionId: 'v-ig-atlas', lang: 'en', text: 'x' },
  'version/check': { type: 'version/check', versionId: 'v-ig-atlas', itemId: 'c1' },
  'version/cover': { type: 'version/cover', versionId: 'v-ig-atlas', assetId: 'a-market-raw' },
  'version/media': { type: 'version/media', versionId: 'v-ig-atlas', assetId: 'a-market-vertical' },
  'version/reschedule': { type: 'version/reschedule', versionId: 'v-ig-atlas', date: data.today },
  'version/live-url': { type: 'version/live-url', versionId: 'v-ig-atlas', url: 'https://example.com/p' },
  'asset/favorite': { type: 'asset/favorite', assetId: 'a-desk-1' },
  'asset/promote': { type: 'asset/promote', assetId: 'a-desk-1' },
  'asset/add-session': { type: 'asset/add-session', asset: upload({ ideaIds: ['market-phrases'] }) },
  'asset/dismiss-duplicate': { type: 'asset/dismiss-duplicate', assetId: 'a-market-raw-copy' },
  'link/add': { type: 'link/add', link: { category: 'brand', label: 'x', url: 'https://example.com' } },
  'notifications/read': { type: 'notifications/read' },
  'member/role': { type: 'member/role', personId: 'sam', role: 'admin' },
  'member/grant': { type: 'member/grant', personId: 'sam', scope: { kind: 'space', id: 'atlas' }, capability: 'view', on: true },
  'member/invite': { type: 'member/invite', name: 'Kai', email: 'kai@example.com', role: 'collaborator', grants: [] },
  'member/remove': { type: 'member/remove', personId: 'sam' },
  // Studio samples use the long morning video, which Sam can't see.
  'studio/plan': { type: 'studio/plan', projectId: 'p-new', ideaId: 'morning-routine', existingIdea: true, title: 'Vertical cut', spaceId: 'pine', accountIds: ['ig-pine'], aspect: '9:16' },
  'studio/plan-update': { type: 'studio/plan-update', ideaId: 'morning-routine', patch: { concept: 'x' } },
  'studio/cut-add': { type: 'studio/cut-add', cut: { id: 'c-new', projectId: 'proj-morning', label: 'Draft 2', kind: 'draft', assetId: 'new', addedAt: '2026-01-01T00:00:00Z', addedById: 'me' }, asset: upload({ ideaIds: ['morning-routine'] }), makeCurrent: true },
  'studio/cut-update': { type: 'studio/cut-update', cutId: 'c-morning-1', label: 'First cut' },
  'studio/cut-current': { type: 'studio/cut-current', cutId: 'c-morning-0' },
  'studio/cut-archive': { type: 'studio/cut-archive', cutId: 'c-morning-0', archived: true },
  'studio/cut-delete': { type: 'studio/cut-delete', cutId: 'c-morning-0' },
  'studio/approve': { type: 'studio/approve', cutId: 'c-morning-1', approved: true },
  'studio/note-add': { type: 'studio/note-add', note: { id: 'n-new', cutId: 'c-morning-1', startSec: 1, text: 'x', resolved: false, authorId: 'sam', createdAt: '2026-01-01T00:00:00Z' } },
  'studio/note-update': { type: 'studio/note-update', noteId: 'n-l-1', patch: { resolved: true } },
  'studio/note-delete': { type: 'studio/note-delete', noteId: 'n-l-1' },
  'studio/note-carry': { type: 'studio/note-carry', noteId: 'n-l-1', toCutId: 'c-morning-1', startSec: 1, newId: 'n-c' },
  'studio/chapter-add': { type: 'studio/chapter-add', chapter: { id: 'ch-new', cutId: 'c-morning-1', title: 'x', startSec: 10 } },
  'studio/chapter-delete': { type: 'studio/chapter-delete', chapterId: 'ch-morning-2' },
  'workspace/storage-add': { type: 'workspace/storage-add', gb: 500 },
} satisfies { [K in Action['type']]: Extract<Action, { type: K }> };

/** Notes are always written in the actor's own name. */
const as = (person: string, a: Action): Action => (a.type === 'studio/note-add' ? { ...a, note: { ...a.note, authorId: person } } : a);
const ok = (person: string, action: Action) => authorize(data, person, as(person, action)).ok;

describe('authorize: every action type has a rule', () => {
  it('the owner and admins may do everything', () => {
    for (const a of Object.values(SAMPLES)) {
      expect(ok('me', a), a.type).toBe(true);
      expect(ok('priya', a), a.type).toBe(true);
    }
  });

  it('an invited person may change nothing until they accept', () => {
    for (const a of Object.values(SAMPLES)) expect(ok('alex', a), a.type).toBe(false);
  });

  it('an account-only collaborator (Sam) is refused everything in the samples except marking notifications read', () => {
    const allowed = Object.values(SAMPLES).filter((a) => ok('sam', a)).map((a) => a.type);
    expect(allowed).toEqual(['notifications/read']);
  });

  it('refusals explain themselves', () => {
    const d = authorize(data, 'sam', SAMPLES['version/caption']);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toMatch(/isn’t shared with you|Needs/);
  });
});

describe('authorize: a collaborator with one account (Sam: TikTok @pinepaper.sample, view + edit)', () => {
  it('edits captions, checklist, dates and media on their own version', () => {
    expect(ok('sam', { type: 'version/caption', versionId: 'v-tt-pine', lang: 'en', text: 'x' })).toBe(true);
    expect(ok('sam', { type: 'version/check', versionId: 'v-tt-pine', itemId: 'c1' })).toBe(true);
    expect(ok('sam', { type: 'version/reschedule', versionId: 'v-tt-pine', date: data.today })).toBe(true);
    expect(ok('sam', { type: 'version/media', versionId: 'v-tt-pine', assetId: 'a-market-vertical' })).toBe(true);
    expect(ok('sam', { type: 'version/status', versionId: 'v-tt-pine-books', status: 'Editing' })).toBe(true);
  });

  it('cannot approve, record a post, or change idea-level fields', () => {
    expect(ok('sam', { type: 'version/status', versionId: 'v-tt-pine-books', status: 'Ready to post' })).toBe(false);
    expect(ok('sam', { type: 'version/live-url', versionId: 'v-tt-pine', url: 'https://example.com' })).toBe(false);
    expect(ok('sam', { type: 'idea/status', ideaId: 'market-phrases', status: 'Ready' })).toBe(false);
    expect(ok('sam', { type: 'idea/shot-toggle', ideaId: 'market-phrases', shotId: 's1' })).toBe(false);
  });

  it('cannot link a file they can’t open, even to their own version', () => {
    expect(ok('sam', { type: 'version/media', versionId: 'v-tt-pine', assetId: 'a-morning-vertical' })).toBe(false);
    expect(ok('sam', { type: 'version/cover', versionId: 'v-tt-pine', assetId: 'a-desk-1' })).toBe(false);
  });

  it('uploads only for their own version, not to the idea or the workspace', () => {
    expect(ok('sam', { type: 'asset/add-session', asset: upload({ ideaIds: ['market-phrases'] }), forVersionId: 'v-tt-pine' })).toBe(true);
    expect(ok('sam', { type: 'asset/add-session', asset: upload({ ideaIds: ['market-phrases'] }) })).toBe(false);
    expect(ok('sam', { type: 'asset/add-session', asset: upload({ inLibrary: true }) })).toBe(false);
  });

  it('creates ideas only for accounts they can edit', () => {
    expect(ok('sam', { type: 'idea/add', title: 'x', accountIds: ['tt-pine'] })).toBe(true);
    expect(ok('sam', { type: 'idea/add', title: 'x', accountIds: ['tt-pine', 'ig-pine'] })).toBe(false);
    expect(ok('sam', { type: 'idea/add', title: 'x', accountIds: [], spaceId: 'pine' })).toBe(false);
  });

  it('adds tasks on their version, assigned only to people who can see it', () => {
    const task = (ownerId: string) => ({ type: 'task/add' as const, task: { title: 'x', ideaId: 'market-phrases', versionId: 'v-tt-pine', ownerId, due: data.today, stage: 'Edit' as const } });
    expect(ok('sam', task('sam'))).toBe(true);
    expect(ok('sam', task('jonah'))).toBe(true);
    expect(ok('sam', task('alex'))).toBe(false);
    expect(ok('sam', { type: 'task/add', task: { title: 'x', ideaId: 'market-phrases', ownerId: 'sam', due: data.today, stage: 'Plan' } })).toBe(false);
  });

  it('ticks off their own task; the owner’s tasks on hidden work are out of reach', () => {
    expect(ok('sam', { type: 'task/toggle', taskId: 't8' })).toBe(true);
    expect(ok('sam', { type: 'task/toggle', taskId: 't1' })).toBe(false);
  });

  it('adds links only for their account', () => {
    expect(ok('sam', { type: 'link/add', link: { category: 'account', label: 'x', url: 'https://example.com', accountId: 'tt-pine' } })).toBe(true);
    expect(ok('sam', { type: 'link/add', link: { category: 'account', label: 'x', url: 'https://example.com', accountId: 'yt-pine' } })).toBe(false);
  });
});

describe('authorize: a Space collaborator (Jonah: Pine & Paper view/edit/review + Instagram @littleatlas.sample view/edit)', () => {
  it('works across the whole Space, including idea fields, files and approval', () => {
    expect(ok('jonah', { type: 'idea/status', ideaId: 'desk-setup', status: 'Ready' })).toBe(true);
    expect(ok('jonah', { type: 'asset/add-session', asset: upload({ ideaIds: ['desk-setup'] }) })).toBe(true);
    expect(ok('jonah', { type: 'asset/promote', assetId: 'a-desk-1' })).toBe(true);
    expect(ok('jonah', { type: 'version/status', versionId: 'v-yt-pine-books', status: 'Ready to post' })).toBe(true);
    expect(ok('jonah', { type: 'idea/add', title: 'x', accountIds: [], spaceId: 'pine' })).toBe(true);
  });

  it('still cannot publish, delete ideas, or manage the team', () => {
    expect(ok('jonah', { type: 'version/live-url', versionId: 'v-yt-pine', url: 'https://example.com' })).toBe(false);
    expect(ok('jonah', { type: 'idea/delete', ideaId: 'desk-setup' })).toBe(false);
    expect(ok('jonah', SAMPLES['member/grant'])).toBe(false);
  });

  it('on the single Little Atlas account: edits the version but cannot approve it or touch the Little Atlas idea', () => {
    expect(ok('jonah', { type: 'version/caption', versionId: 'v-ig-atlas', lang: 'en', text: 'x' })).toBe(true);
    expect(ok('jonah', { type: 'version/status', versionId: 'v-ig-atlas', status: 'Ready to post' })).toBe(false);
    expect(ok('jonah', { type: 'idea/status', ideaId: 'market-phrases', status: 'Ready' })).toBe(false);
  });
});
