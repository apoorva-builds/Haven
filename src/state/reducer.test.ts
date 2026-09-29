import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoData, HERO_IDEA_ID } from '../data/demo';
import type { DemoData } from '../data/types';
import { reducer } from './reducer';

let data: DemoData;
beforeEach(() => {
  data = createDemoData(new Date(2026, 8, 29, 10, 0));
});

describe('reducer', () => {
  it('toggles a task', () => {
    const next = reducer(data, { type: 'task/toggle', taskId: 't1' });
    expect(next.tasks.find((t) => t.id === 't1')!.done).toBe(true);
    expect(data.tasks.find((t) => t.id === 't1')!.done).toBe(false);
  });

  it('never removes Raw Library originals or files shared with another idea when deleting an idea', () => {
    // Share the hero's finished video with another idea first.
    const shared = reducer(data, { type: 'version/media', versionId: 'v-yt-mia-books', assetId: 'a-street-vertical' });
    const next = reducer(shared, { type: 'idea/delete', ideaId: HERO_IDEA_ID });
    expect(next.ideas.find((i) => i.id === HERO_IDEA_ID)).toBeUndefined();
    expect(next.versions.some((v) => v.ideaId === HERO_IDEA_ID)).toBe(false);
    expect(next.tasks.some((t) => t.ideaId === HERO_IDEA_ID)).toBe(false);
    for (const id of ['a-market-raw', 'a-market-audio']) {
      const asset = next.assets.find((a) => a.id === id);
      expect(asset, id).toBeDefined();
      expect(asset!.ideaIds).not.toContain(HERO_IDEA_ID);
    }
    expect(next.assets.find((a) => a.id === 'a-street-vertical')!.ideaIds).toEqual(['reading-list']);
    // Idea-only copies go with the idea.
    expect(next.assets.find((a) => a.id === 'a-market-raw-copy')).toBeUndefined();
  });

  it('moves open tasks with a rescheduled version, but not finished ones', () => {
    const next = reducer(data, { type: 'version/reschedule', versionId: 'v-ig-explore', date: '2026-10-05' });
    expect(next.versions.find((v) => v.id === 'v-ig-explore')!.scheduledFor).toBe('2026-10-05');
    expect(next.tasks.find((t) => t.id === 't1')!.due).toBe('2026-10-03'); // +4 days
    const moved = reducer(data, { type: 'version/reschedule', versionId: 'v-tt-explore', date: '2026-10-09' });
    expect(moved.tasks.find((t) => t.id === 't10')!.due).toBe(data.tasks.find((t) => t.id === 't10')!.due);
  });

  it('marks posted only with a live URL and records it in Links', () => {
    const next = reducer(data, { type: 'version/live-url', versionId: 'v-tt-explore', url: 'https://example.com/sample-live' });
    const v = next.versions.find((x) => x.id === 'v-tt-explore')!;
    expect(v.status).toBe('Posted');
    expect(next.links.some((l) => l.category === 'published' && l.url === v.liveUrl)).toBe(true);

    const cleared = reducer(data, { type: 'version/live-url', versionId: 'v-yt-explore', url: '   ' });
    expect(cleared.versions.find((x) => x.id === 'v-yt-explore')!.status).toBe('Planned');
  });

  it('captures an idea with versions for chosen accounts', () => {
    const next = reducer(data, { type: 'idea/add', title: 'Night train phrases', accountIds: ['ig-explore', 'yt-explore'] });
    const idea = next.ideas[0];
    expect(idea.title).toBe('Night train phrases');
    const versions = next.versions.filter((v) => v.ideaId === idea.id);
    expect(versions.map((v) => v.accountId)).toEqual(['ig-explore', 'yt-explore']);
    expect(versions.find((v) => v.accountId === 'yt-explore')!.aspect).toBe('16:9');
    expect(versions.every((v) => v.checklist.length > 0 && v.checklist.every((c) => !c.done))).toBe(true);
  });

  it('selects a finished video by reference, so several accounts share one asset', () => {
    const before = data.assets.length;
    let next = reducer(data, { type: 'version/media', versionId: 'v-yt-mia-books', assetId: 'a-morning-vertical' });
    next = reducer(next, { type: 'version/media', versionId: 'v-yt-explore', assetId: 'a-morning-vertical' });
    expect(next.assets).toHaveLength(before);
    const users = next.versions.filter((v) => v.mediaAssetId === 'a-morning-vertical').map((v) => v.accountId);
    expect(users.sort()).toEqual(['ig-mia', 'tt-mia', 'yt-explore', 'yt-mia']);
    expect(next.assets.find((a) => a.id === 'a-morning-vertical')!.ideaIds).toEqual(['morning-routine', 'reading-list', 'hangzhou']);
    const cleared = reducer(next, { type: 'version/media', versionId: 'v-yt-explore', assetId: undefined });
    expect(cleared.versions.find((v) => v.id === 'v-yt-explore')!.mediaAssetId).toBeUndefined();
  });
});
