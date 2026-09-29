import { describe, expect, it } from 'vitest';
import { createDemoData, HERO_IDEA_ID } from './demo';

const data = createDemoData(new Date(2026, 8, 29, 10, 0));

describe('preview sample workspace', () => {
  it('uses two fictional brands with two YouTube and two Instagram accounts', () => {
    expect(data.brands.map((b) => b.name)).toEqual(['Pine & Paper', 'Little Atlas']);
    expect(data.accounts.filter((a) => a.platform === 'youtube')).toHaveLength(2);
    expect(data.accounts.filter((a) => a.platform === 'instagram')).toHaveLength(2);
  });

  it('keeps every account clearly fictional and unlinked', () => {
    for (const a of data.accounts) {
      expect(a.handle).toMatch(/\.sample$/);
      expect(a.profileUrl).toBeUndefined();
      expect(a.analyticsUrl).toBeUndefined();
    }
  });

  it('follows the hero idea into three platforms and both Instagram accounts with one shared file', () => {
    const versions = data.versions.filter((v) => v.ideaId === HERO_IDEA_ID);
    const accounts = versions.map((v) => data.accounts.find((a) => a.id === v.accountId)!);
    expect(new Set(accounts.map((a) => a.platform))).toEqual(new Set(['tiktok', 'instagram', 'youtube']));
    expect(accounts.filter((a) => a.platform === 'instagram')).toHaveLength(2);
    expect(new Set(versions.map((v) => v.mediaAssetId))).toEqual(new Set(['a-market-vertical']));
  });

  it('has referential integrity', () => {
    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const accounts = ids(data.accounts);
    const ideas = ids(data.ideas);
    const assets = ids(data.assets);
    const versions = ids(data.versions);
    const people = ids(data.people);
    const campaigns = ids(data.campaigns);
    const brands = ids(data.brands);
    for (const a of data.accounts) expect(brands.has(a.brandId)).toBe(true);
    for (const v of data.versions) {
      expect(accounts.has(v.accountId)).toBe(true);
      expect(ideas.has(v.ideaId)).toBe(true);
      [v.mediaAssetId, v.coverAssetId, ...(v.photoAssetIds ?? [])].filter(Boolean).forEach((id) => expect(assets.has(id!), id).toBe(true));
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
    for (const i of data.ideas) if (i.campaignId) expect(campaigns.has(i.campaignId)).toBe(true);
    expect(data.audience.map((s) => s.accountId).sort()).toEqual([...accounts].sort());
  });

  it('only links to example.com placeholders', () => {
    const urls = [...data.links.map((l) => l.url), ...data.versions.flatMap((v) => [...v.links, v.liveUrl ?? '']), ...data.ideas.flatMap((i) => i.references.map((r) => r.url))].filter(Boolean);
    expect(urls.length).toBeGreaterThan(0);
    for (const raw of urls) expect(new URL(raw).hostname).toBe('example.com');
  });

  it('labels every audience series as sample data', () => {
    expect(data.audience.every((s) => s.source.kind === 'sample')).toBe(true);
  });

  it('keeps finished videos out of the Raw Library and bundles only sample media', () => {
    const finals = data.assets.filter((a) => a.kind === 'final');
    expect(finals.length).toBeGreaterThan(0);
    expect(finals.every((a) => !a.inLibrary && a.videoUrl?.startsWith('/demo-media/') && a.mediaSource === 'bundled-sample')).toBe(true);
  });

  it('gives carousels their own ordered photos', () => {
    const carousel = data.versions.find((v) => v.id === 'v-ig-pine-desk')!;
    expect(carousel.photoAssetIds).toHaveLength(3);
    carousel.photoAssetIds!.forEach((id) => expect(data.assets.find((a) => a.id === id)?.kind).toBe('photo'));
  });
});
