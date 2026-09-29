import type { AccessScope, Asset, Capability, DemoData, Idea, Member, Task, Version } from '../data/types';

/*
 * Preview access rules. These decide what a collaborator would see and do,
 * so the Team & access preview can show it. In this prototype they only
 * filter the current browser tab: they are NOT security. Real enforcement
 * belongs on the server (see docs/backend-plan.md), using the same rules.
 */

export const memberOf = (data: DemoData, personId: string): Member | undefined => data.members.find((m) => m.personId === personId);

export const hasFullAccess = (member: Member | undefined): boolean => member?.role === 'owner' || member?.role === 'admin';

const sameScope = (a: AccessScope, b: AccessScope) => a.kind === b.kind && a.id === b.id;

/** Capabilities a member has on one social account: its own grant plus its Space's. */
export function capabilitiesOn(data: DemoData, member: Member | undefined, accountId: string): Set<Capability> {
  const all = new Set<Capability>(['view', 'edit', 'review', 'publish']);
  if (!member || member.status !== 'active') return new Set();
  if (hasFullAccess(member)) return all;
  const account = data.accounts.find((a) => a.id === accountId);
  const caps = new Set<Capability>();
  for (const g of member.grants) {
    if (sameScope(g.scope, { kind: 'account', id: accountId }) || (account && sameScope(g.scope, { kind: 'space', id: account.brandId }))) {
      g.capabilities.forEach((c) => caps.add(c));
    }
  }
  return caps.has('view') ? caps : new Set();
}

/** Capabilities on a whole Space (not counting single-account grants). */
export function capabilitiesOnSpace(member: Member | undefined, spaceId: string): Set<Capability> {
  if (!member || member.status !== 'active') return new Set();
  if (hasFullAccess(member)) return new Set(['view', 'edit', 'review', 'publish']);
  const g = member.grants.find((x) => sameScope(x.scope, { kind: 'space', id: spaceId }));
  return g && g.capabilities.includes('view') ? new Set(g.capabilities) : new Set();
}

export const canSeeVersion = (data: DemoData, member: Member | undefined, v: Version) => capabilitiesOn(data, member, v.accountId).has('view');

/** Space access shows the whole idea; account access shows the idea with only those accounts' versions. */
export function canSeeIdea(data: DemoData, member: Member | undefined, idea: Idea): boolean {
  if (capabilitiesOnSpace(member, idea.spaceId).has('view')) return true;
  return data.versions.some((v) => v.ideaId === idea.id && canSeeVersion(data, member, v));
}

/**
 * Files follow the work. A file is visible if a visible version uses it, or
 * it belongs to an idea or Space the member can see as a whole. Account-only
 * collaborators therefore get the finished media for their accounts, not the
 * idea's raw footage.
 */
export function canSeeAsset(data: DemoData, member: Member | undefined, asset: Asset): boolean {
  if (hasFullAccess(member) && member?.status === 'active') return true;
  const usedBy = data.versions.filter((v) => v.mediaAssetId === asset.id || v.coverAssetId === asset.id || v.photoAssetIds?.includes(asset.id));
  if (usedBy.some((v) => canSeeVersion(data, member, v))) return true;
  const ideaSpaces = asset.ideaIds.map((id) => data.ideas.find((i) => i.id === id)?.spaceId).filter(Boolean) as string[];
  if (ideaSpaces.some((s) => capabilitiesOnSpace(member, s).has('view'))) return true;
  return !!asset.spaceId && capabilitiesOnSpace(member, asset.spaceId).has('view');
}

export function canSeeTask(data: DemoData, member: Member | undefined, task: Task): boolean {
  if (hasFullAccess(member) && member?.status === 'active') return true;
  if (task.versionId) {
    const v = data.versions.find((x) => x.id === task.versionId);
    return !!v && canSeeVersion(data, member, v);
  }
  const idea = data.ideas.find((i) => i.id === task.ideaId);
  return !!idea && capabilitiesOnSpace(member, idea.spaceId).has('view');
}

/** What is hidden from the person being previewed, so direct links can say so. */
export interface Hidden {
  ideas: Set<string>;
  versions: Set<string>;
  assets: Set<string>;
}

/**
 * The workspace as one person would see it. Everything they can't see is
 * removed, including files and creations reached through shared references.
 */
export function scopeData(data: DemoData, personId: string): { data: DemoData; hidden: Hidden } {
  const member = memberOf(data, personId);
  const hidden: Hidden = { ideas: new Set(), versions: new Set(), assets: new Set() };
  const keep = <T extends { id: string }>(list: T[], ok: (x: T) => boolean, bucket?: Set<string>) =>
    list.filter((x) => {
      const yes = ok(x);
      if (!yes) bucket?.add(x.id);
      return yes;
    });

  const accounts = data.accounts.filter((a) => capabilitiesOn(data, member, a.id).has('view'));
  const versions = keep(data.versions, (v) => canSeeVersion(data, member, v), hidden.versions);
  const ideas = keep(data.ideas, (i) => canSeeIdea(data, member, i), hidden.ideas);
  const assets = keep(data.assets, (a) => canSeeAsset(data, member, a), hidden.assets);
  const ideaIds = new Set(ideas.map((i) => i.id));
  const accountIds = new Set(accounts.map((a) => a.id));
  const campaigns = data.campaigns.filter((c) => ideas.some((i) => i.campaignId === c.id));
  const campaignIds = new Set(campaigns.map((c) => c.id));

  return {
    hidden,
    data: {
      ...data,
      currentUserId: personId,
      brands: data.brands.filter((b) => accounts.some((a) => a.brandId === b.id) || capabilitiesOnSpace(member, b.id).has('view')),
      accounts,
      audience: data.audience.filter((s) => accountIds.has(s.accountId)),
      ideas,
      versions,
      assets: assets.map((a) => ({ ...a, ideaIds: a.ideaIds.filter((id) => ideaIds.has(id)) })),
      tasks: data.tasks.filter((t) => canSeeTask(data, member, t)),
      campaigns,
      marketing: data.marketing.filter((m) => !!m.campaignId && campaignIds.has(m.campaignId)),
      links: data.links.filter((l) => (l.accountId ? accountIds.has(l.accountId) : l.ideaId ? ideaIds.has(l.ideaId) : false)),
      notifications: [],
    },
  };
}

/** Plain-language summary of someone's access, e.g. "Pine & Paper · TikTok @pinepaper.sample". */
export function accessSummary(data: DemoData, member: Member): string {
  if (member.role === 'owner') return 'Owner · full access';
  if (member.role === 'admin') return 'Admin · full access';
  if (member.grants.length === 0) return 'No access yet';
  return member.grants
    .map((g) => {
      if (g.scope.kind === 'space') return `${data.brands.find((b) => b.id === g.scope.id)?.name ?? 'Space'} (whole Space)`;
      const a = data.accounts.find((x) => x.id === g.scope.id);
      const p = a && data.platforms.find((x) => x.id === a.platform);
      return a ? `${p?.name} ${a.handle}` : 'Account';
    })
    .join(' · ');
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  view: 'View',
  edit: 'Edit & upload',
  review: 'Review & approve',
  publish: 'Publish',
};

/** Turn one capability on or off for a scope. Edit, review and publish imply view; removing view removes the grant. */
export function toggleGrant(member: Member, scope: AccessScope, capability: Capability, on: boolean): Member {
  const existing = member.grants.find((g) => sameScope(g.scope, scope));
  const caps = new Set(existing?.capabilities ?? []);
  if (on) {
    caps.add(capability);
    caps.add('view');
  } else if (capability === 'view') {
    caps.clear();
  } else {
    caps.delete(capability);
  }
  const others = member.grants.filter((g) => !sameScope(g.scope, scope));
  const order: Capability[] = ['view', 'edit', 'review', 'publish'];
  return { ...member, grants: caps.size ? [...others, { scope, capabilities: order.filter((c) => caps.has(c)) }] : others };
}
