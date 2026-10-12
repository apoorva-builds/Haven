import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import { reducer } from '../state/reducer';
import { accessSummary, canSeeAsset, capabilitiesOn, memberOf, scopeData, toggleGrant } from './access';

const data = createDemoData();
const ids = <T extends { id: string }>(list: T[]) => list.map((x) => x.id).sort();

describe('preview access: owner and admins', () => {
  it('see the whole workspace', () => {
    for (const person of ['me', 'priya']) {
      const { data: scoped, hidden } = scopeData(data, person);
      expect(ids(scoped.ideas)).toEqual(ids(data.ideas));
      expect(ids(scoped.versions)).toEqual(ids(data.versions));
      expect(ids(scoped.assets)).toEqual(ids(data.assets));
      expect(hidden.ideas.size + hidden.versions.size + hidden.assets.size).toBe(0);
    }
  });
});

describe('preview access: a collaborator with one account (Sam, TikTok @pinepaper.sample)', () => {
  const sam = memberOf(data, 'sam')!;
  const { data: scoped, hidden } = scopeData(data, 'sam');

  it('sees only that account and its creations', () => {
    expect(ids(scoped.accounts)).toEqual(['tt-pine']);
    expect(scoped.versions.every((v) => v.accountId === 'tt-pine')).toBe(true);
    expect(ids(scoped.versions)).toEqual(['v-tt-pine', 'v-tt-pine-books']);
  });

  it('sees the ideas behind those creations, but not unrelated ideas', () => {
    expect(ids(scoped.ideas)).toEqual(['market-phrases', 'reading-list']);
    expect(hidden.ideas.has('desk-setup')).toBe(true);
    expect(hidden.versions.has('v-ig-atlas')).toBe(true);
  });

  it('gets only the files its creations use (shared finished video, cover, earlier drafts of that video), not the idea’s other files', () => {
    const shared = data.assets.find((a) => a.id === 'a-market-vertical')!;
    expect(canSeeAsset(data, sam, shared)).toBe(true);
    // v-tt-pine uses the raw market clip as its cover, so that one file comes along.
    // Draft 1 is an earlier cut of the same video, so it comes along in the Studio.
    expect(ids(scoped.assets)).toEqual(['a-market-draft1', 'a-market-draft2', 'a-market-raw', 'a-market-vertical']);
    expect(hidden.assets.has('a-market-raw-copy')).toBe(true);
    expect(hidden.assets.has('a-desk-raw')).toBe(true);
    expect(hidden.assets.has('a-desk-1')).toBe(true);
    expect(hidden.assets.has('a-hooks')).toBe(true);
  });

  it('does not leak hidden work through references on visible records', () => {
    const shared = scoped.assets.find((a) => a.id === 'a-market-vertical')!;
    expect(shared.ideaIds.every((id) => scoped.ideas.some((i) => i.id === id))).toBe(true);
    expect(scoped.tasks.every((t) => !t.versionId || scoped.versions.some((v) => v.id === t.versionId))).toBe(true);
    expect(scoped.tasks.map((t) => t.id)).toContain('t8');
    expect(scoped.tasks.map((t) => t.id)).not.toContain('t2');
    expect(scoped.links.every((l) => !l.accountId || l.accountId === 'tt-pine')).toBe(true);
    expect(scoped.audience.map((a) => a.accountId)).toEqual(['tt-pine']);
    expect(scoped.notifications).toEqual([]);
  });

  it('can edit but not approve or publish', () => {
    const caps = capabilitiesOn(data, sam, 'tt-pine');
    expect([...caps].sort()).toEqual(['edit', 'view']);
    expect(capabilitiesOn(data, sam, 'ig-pine').size).toBe(0);
  });
});

describe('preview access: Space and account grants', () => {
  const jonah = memberOf(data, 'jonah')!;

  it('a whole-Space grant covers every account in that Space', () => {
    for (const a of ['yt-pine', 'ig-pine', 'tt-pine']) expect(capabilitiesOn(data, jonah, a).has('review')).toBe(true);
    expect(capabilitiesOn(data, jonah, 'ig-atlas').has('edit')).toBe(true);
    expect(capabilitiesOn(data, jonah, 'ig-atlas').has('review')).toBe(false);
    expect(capabilitiesOn(data, jonah, 'yt-atlas').size).toBe(0);
  });

  it('Space access includes Space files, such as the brand kit', () => {
    const { data: scoped } = scopeData(data, 'jonah');
    expect(scoped.assets.some((a) => a.id === 'a-brand-kit')).toBe(true);
    expect(scoped.assets.some((a) => a.id === 'a-hooks')).toBe(false);
  });

  it('an invitation grants nothing until it is accepted', () => {
    const alex = memberOf(data, 'alex')!;
    expect(alex.status).toBe('invited');
    expect(capabilitiesOn(data, alex, 'ig-atlas').size).toBe(0);
    expect(scopeData(data, 'alex').data.ideas).toEqual([]);
  });
});

describe('editing access', () => {
  it('edit, review and publish imply view; removing view removes the grant', () => {
    const sam = memberOf(data, 'sam')!;
    const withReview = toggleGrant(sam, { kind: 'account', id: 'ig-pine' }, 'review', true);
    expect(withReview.grants.find((g) => g.scope.id === 'ig-pine')?.capabilities).toEqual(['view', 'review']);
    const removed = toggleGrant(withReview, { kind: 'account', id: 'ig-pine' }, 'view', false);
    expect(removed.grants.some((g) => g.scope.id === 'ig-pine')).toBe(false);
  });

  it('the reducer applies grants to collaborators only and never demotes the owner', () => {
    let s = reducer(data, { type: 'member/grant', personId: 'sam', scope: { kind: 'space', id: 'atlas' }, capability: 'view', on: true });
    expect(scopeData(s, 'sam').data.ideas.some((i) => i.id === 'cafe-words')).toBe(true);
    s = reducer(s, { type: 'member/grant', personId: 'me', scope: { kind: 'account', id: 'tt-pine' }, capability: 'view', on: false });
    expect(memberOf(s, 'me')!.grants).toEqual([]);
    s = reducer(s, { type: 'member/role', personId: 'me', role: 'collaborator' });
    expect(memberOf(s, 'me')!.role).toBe('owner');
    s = reducer(s, { type: 'member/remove', personId: 'me' });
    expect(memberOf(s, 'me')).toBeDefined();
  });

  it('invitations are listed once per address, with the chosen Spaces', () => {
    let s = reducer(data, { type: 'member/invite', name: 'Kai', email: 'Kai@Example.com', role: 'collaborator', grants: [{ scope: { kind: 'space', id: 'atlas' }, capabilities: ['view', 'edit'] }] });
    s = reducer(s, { type: 'member/invite', name: 'Kai again', email: 'kai@example.com', role: 'admin', grants: [] });
    const kai = s.members.filter((m) => m.email === 'kai@example.com');
    expect(kai).toHaveLength(1);
    expect(kai[0].status).toBe('invited');
    expect(accessSummary(s, kai[0])).toBe('Little Atlas (whole Space)');
  });
});
