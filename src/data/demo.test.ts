import { describe, expect, it } from 'vitest';
import { createDemoData, HERO_IDEA_ID } from './demo';

const data = createDemoData(new Date(2026, 8, 29));

describe('demo workspace', () => {
  it('models one idea across Instagram personal + business, TikTok and YouTube', () => {
    const versions = data.versions.filter((v) => v.ideaId === HERO_IDEA_ID);
    const accounts = versions.map((v) => data.accounts.find((a) => a.id === v.accountId)!);
    expect(accounts.map((a) => a.id).sort()).toEqual(['ig-personal', 'ig-studio', 'tt-main', 'yt-main']);
    const instagram = accounts.filter((a) => a.platform === 'instagram');
    expect(instagram).toHaveLength(2);
    expect(new Set(instagram.map((a) => a.kind))).toEqual(new Set(['Personal', 'Business']));
  });

  it('has referential integrity', () => {
    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const accounts = ids(data.accounts);
    const ideas = ids(data.ideas);
    const assets = ids(data.assets);
    const versions = ids(data.versions);
    const people = ids(data.people);
    const campaigns = ids(data.campaigns);
    for (const v of data.versions) {
      expect(accounts.has(v.accountId)).toBe(true);
      expect(ideas.has(v.ideaId)).toBe(true);
      if (v.mediaAssetId) expect(assets.has(v.mediaAssetId)).toBe(true);
      if (v.coverAssetId) expect(assets.has(v.coverAssetId)).toBe(true);
    }
    for (const t of data.tasks) {
      expect(people.has(t.ownerId)).toBe(true);
      if (t.ideaId) expect(ideas.has(t.ideaId)).toBe(true);
      if (t.versionId) expect(versions.has(t.versionId)).toBe(true);
    }
    for (const a of data.assets) {
      a.ideaIds.forEach((id) => expect(ideas.has(id)).toBe(true));
      if (a.duplicateOfId) expect(assets.has(a.duplicateOfId)).toBe(true);
    }
    for (const i of data.ideas) {
      if (i.campaignId) expect(campaigns.has(i.campaignId)).toBe(true);
      i.peopleIds.forEach((id) => expect(people.has(id)).toBe(true));
    }
    expect(new Set(data.accounts.map((a) => a.platform)).size).toBeGreaterThan(3);
  });

  it('contains no credentials or secrets in any URL', () => {
    const urls = [...data.accounts.flatMap((a) => [a.profileUrl, a.analyticsUrl ?? '']), ...data.links.map((l) => l.url), ...data.versions.flatMap((v) => v.links)].filter(Boolean);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(url.protocol).toBe('https:');
      expect(url.username + url.password).toBe('');
      expect(url.search).not.toMatch(/token|key|secret|password|session/i);
    }
  });

  it('keeps dates relative to today', () => {
    expect(data.today).toBe('2026-09-29');
    expect(data.tasks.some((t) => t.due === data.today)).toBe(true);
  });

  it('seeds playable finished videos in the Library, shared across accounts', () => {
    const finals = data.assets.filter((a) => a.kind === 'final');
    expect(finals.every((a) => a.inLibrary && a.videoUrl?.startsWith('/demo-media/') && a.mediaSource === 'bundled-sample')).toBe(true);
    const vertical = data.versions.filter((v) => v.mediaAssetId === 'a-final-vertical').map((v) => v.accountId);
    expect(vertical.sort()).toEqual(['ig-personal', 'ig-studio', 'tt-main']);
  });
});
