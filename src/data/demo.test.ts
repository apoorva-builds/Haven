import { describe, expect, it } from 'vitest';
import { createDemoData, HERO_IDEA_ID } from './demo';

const data = createDemoData(new Date(2026, 8, 29, 10, 0));

describe('demo workspace', () => {
  it('models two brands with a main and an Explore with Mia account on YouTube and Instagram', () => {
    expect(data.brands.map((b) => b.name)).toEqual(['Mia Yilin', 'Explore with Mia']);
    const youtube = data.accounts.filter((a) => a.platform === 'youtube');
    expect(youtube.map((a) => a.handle).sort()).toEqual(['@explorewith_mia', '@miayilin']);
    const instagram = data.accounts.filter((a) => a.platform === 'instagram');
    expect(new Set(instagram.map((a) => a.brandId))).toEqual(new Set(['mia', 'explore']));
  });

  it('marks unconfirmed and LinkedIn accounts as illustrative, with no real handle or link', () => {
    const illustrative = data.accounts.filter((a) => a.identity === 'illustrative');
    expect(illustrative.map((a) => a.id).sort()).toEqual(['ig-explore', 'li-mia']);
    for (const a of illustrative) {
      expect(a.handle).toMatch(/\(demo\)$/);
      expect(a.profileUrl).toBeUndefined();
      expect(a.analyticsUrl).toBeUndefined();
    }
    for (const a of data.accounts.filter((x) => x.platform === 'linkedin')) expect(a.identity).toBe('illustrative');
    for (const a of data.accounts.filter((x) => x.identity === 'public')) expect(a.identityNote).toMatch(/samples/);
  });

  it('follows the hero idea into three platforms and both Instagram accounts with one shared file', () => {
    const versions = data.versions.filter((v) => v.ideaId === HERO_IDEA_ID);
    const accounts = versions.map((v) => data.accounts.find((a) => a.id === v.accountId)!);
    expect(new Set(accounts.map((a) => a.platform))).toEqual(new Set(['tiktok', 'instagram', 'youtube']));
    expect(accounts.filter((a) => a.platform === 'instagram')).toHaveLength(2);
    expect(new Set(versions.map((v) => v.mediaAssetId))).toEqual(new Set(['a-street-vertical']));
  });

  it('has referential integrity', () => {
    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const [accounts, ideas, assets, versions, people, campaigns, brands] = [data.accounts, data.ideas, data.assets, data.versions, data.people, data.campaigns, data.brands].map(ids);
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
    for (const s of data.audience) expect(accounts.has(s.accountId)).toBe(true);
    expect(data.audience.map((s) => s.accountId).sort()).toEqual([...accounts].sort());
  });

  it('contains no credentials, and sample posted links point at example.com', () => {
    const urls = [...data.accounts.flatMap((a) => [a.profileUrl ?? '', a.analyticsUrl ?? '']), ...data.links.map((l) => l.url), ...data.versions.flatMap((v) => v.links)].filter(Boolean);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(url.protocol).toBe('https:');
      expect(url.username + url.password).toBe('');
      expect(url.search).not.toMatch(/token|key|secret|password|session/i);
    }
    for (const v of data.versions.filter((x) => x.liveUrl)) expect(new URL(v.liveUrl!).hostname).toBe('example.com');
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
    const carousel = data.versions.find((v) => v.id === 'v-ig-mia-desk')!;
    expect(carousel.photoAssetIds).toHaveLength(3);
    carousel.photoAssetIds!.forEach((id) => expect(data.assets.find((a) => a.id === id)?.kind).toBe('photo'));
  });
});
