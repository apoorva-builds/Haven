import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoData, HERO_IDEA_ID } from '../data/demo';
import type { DemoData } from '../data/types';
import { reducer } from './reducer';

let data: DemoData;
beforeEach(() => {
  data = createDemoData(new Date(2026, 8, 29));
});

describe('reducer', () => {
  it('toggles a task', () => {
    const next = reducer(data, { type: 'task/toggle', taskId: 't1' });
    expect(next.tasks.find((t) => t.id === 't1')!.done).toBe(true);
    expect(data.tasks.find((t) => t.id === 't1')!.done).toBe(false);
  });

  it('never removes Library originals or shared assets when deleting an idea', () => {
    const next = reducer(data, { type: 'idea/delete', ideaId: HERO_IDEA_ID });
    expect(next.ideas.find((i) => i.id === HERO_IDEA_ID)).toBeUndefined();
    expect(next.versions.some((v) => v.ideaId === HERO_IDEA_ID)).toBe(false);
    expect(next.tasks.some((t) => t.ideaId === HERO_IDEA_ID)).toBe(false);
    // Library originals stay, minus the reference.
    for (const id of ['a-dip', 'a-mug-photo', 'a-music']) {
      const asset = next.assets.find((a) => a.id === id);
      expect(asset, id).toBeDefined();
      expect(asset!.ideaIds).not.toContain(HERO_IDEA_ID);
    }
    // a-dip is also used by twelve-blues.
    expect(next.assets.find((a) => a.id === 'a-dip')!.ideaIds).toEqual(['twelve-blues']);
    // Idea-only raw footage goes with the idea.
    expect(next.assets.find((a) => a.id === 'a-hands')).toBeUndefined();
  });

  it('moves open tasks with a rescheduled version', () => {
    const next = reducer(data, { type: 'version/reschedule', versionId: 'v-ig-personal', date: '2026-10-05' });
    expect(next.versions.find((v) => v.id === 'v-ig-personal')!.scheduledFor).toBe('2026-10-05');
    // t1 was due today (open) and shifts by +4 days; t6 is done and stays.
    expect(next.tasks.find((t) => t.id === 't1')!.due).toBe('2026-10-03');
    expect(next.tasks.find((t) => t.id === 't6')!.due).toBe(data.tasks.find((t) => t.id === 't6')!.due);
  });

  it('marks posted only with a live URL and records it in Links', () => {
    const next = reducer(data, { type: 'version/live-url', versionId: 'v-tt', url: 'https://www.tiktok.com/@miralane.demo/video/1' });
    const v = next.versions.find((x) => x.id === 'v-tt')!;
    expect(v.status).toBe('Posted');
    expect(next.links.some((l) => l.category === 'published' && l.url === v.liveUrl)).toBe(true);

    const cleared = reducer(data, { type: 'version/live-url', versionId: 'v-yt', url: '   ' });
    expect(cleared.versions.find((x) => x.id === 'v-yt')!.status).toBe('Planned');
  });

  it('captures an idea with versions for chosen accounts', () => {
    const next = reducer(data, { type: 'idea/add', title: 'Ash glaze', accountIds: ['ig-personal', 'yt-main'] });
    const idea = next.ideas[0];
    expect(idea.title).toBe('Ash glaze');
    const versions = next.versions.filter((v) => v.ideaId === idea.id);
    expect(versions.map((v) => v.accountId)).toEqual(['ig-personal', 'yt-main']);
    expect(versions.find((v) => v.accountId === 'yt-main')!.aspect).toBe('16:9');
    expect(versions.every((v) => v.checklist.length > 0 && v.checklist.every((c) => !c.done))).toBe(true);
  });

  it('adds an account with its profile and analytics links', () => {
    const next = reducer(data, {
      type: 'account/add',
      account: { platform: 'x', handle: '@mira', displayName: 'mira', kind: 'Personal', profileUrl: 'https://x.com/mira', analyticsUrl: 'https://analytics.x.com', usedToday: false, purpose: '' },
    });
    const account = next.accounts.at(-1)!;
    expect(account.platform).toBe('x');
    expect(next.links.filter((l) => l.accountId === account.id).map((l) => l.category).sort()).toEqual(['account', 'analytics']);
  });

  it('selects a Library video by reference, so several accounts share one asset', () => {
    const before = data.assets.length;
    let next = reducer(data, { type: 'version/media', versionId: 'v-wheel-tt', assetId: 'a-final-vertical' });
    next = reducer(next, { type: 'version/media', versionId: 'v-wheel-ig', assetId: 'a-final-vertical' });
    expect(next.assets).toHaveLength(before);
    const users = next.versions.filter((v) => v.mediaAssetId === 'a-final-vertical').map((v) => v.accountId);
    expect(users).toEqual(expect.arrayContaining(['ig-personal', 'ig-studio', 'tt-main']));
    expect(next.assets.find((a) => a.id === 'a-final-vertical')!.ideaIds).toEqual(['slow-mornings', 'wheel-60']);
    const cleared = reducer(next, { type: 'version/media', versionId: 'v-wheel-tt', assetId: undefined });
    expect(cleared.versions.find((v) => v.id === 'v-wheel-tt')!.mediaAssetId).toBeUndefined();
  });
});
