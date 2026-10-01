import type { AccessScope, Asset, Capability, Cut, DemoData, Idea, Member, Task, Version, VideoProject } from '../data/types';
import type { Action } from '../state/reducer';

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
 * A video in the Studio follows its idea's Space and the creations it is made
 * for: Space access gives the whole video; account access gives the videos
 * made for that account. Capabilities are the union of both.
 */
export function capabilitiesOnProject(data: DemoData, member: Member | undefined, project: VideoProject): Set<Capability> {
  const idea = data.ideas.find((i) => i.id === project.ideaId);
  const caps = new Set<Capability>(idea ? capabilitiesOnSpace(member, idea.spaceId) : []);
  for (const id of project.versionIds) {
    const v = data.versions.find((x) => x.id === id);
    if (v) capabilitiesOn(data, member, v.accountId).forEach((c) => caps.add(c));
  }
  return caps.has('view') ? caps : new Set();
}

export const canSeeProject = (data: DemoData, member: Member | undefined, project: VideoProject) => capabilitiesOnProject(data, member, project).has('view');

const projectOfCut = (data: DemoData, cut: Cut | undefined) => (cut ? data.projects.find((p) => p.id === cut.projectId) : undefined);

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
  // A cut of a video the member can open.
  if (data.cuts.some((c) => c.assetId === asset.id && canSeeVersionlessProject(data, member, c))) return true;
  const ideaSpaces = asset.ideaIds.map((id) => data.ideas.find((i) => i.id === id)?.spaceId).filter(Boolean) as string[];
  if (ideaSpaces.some((s) => capabilitiesOnSpace(member, s).has('view'))) return true;
  return !!asset.spaceId && capabilitiesOnSpace(member, asset.spaceId).has('view');
}

function canSeeVersionlessProject(data: DemoData, member: Member | undefined, cut: Cut): boolean {
  const p = projectOfCut(data, cut);
  return !!p && canSeeProject(data, member, p);
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
  projects: Set<string>;
}

/**
 * The workspace as one person would see it. Everything they can't see is
 * removed, including files and creations reached through shared references.
 */
export function scopeData(data: DemoData, personId: string): { data: DemoData; hidden: Hidden } {
  const member = memberOf(data, personId);
  const hidden: Hidden = { ideas: new Set(), versions: new Set(), assets: new Set(), projects: new Set() };
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
  const versionIds = new Set(versions.map((v) => v.id));
  // A video is shown with only the creations this person can see.
  const projects = keep(data.projects, (p) => canSeeProject(data, member, p), hidden.projects).map((p) => ({ ...p, versionIds: p.versionIds.filter((id) => versionIds.has(id)) }));
  const projectIds = new Set(projects.map((p) => p.id));
  const cuts = data.cuts.filter((c) => projectIds.has(c.projectId));
  const cutIds = new Set(cuts.map((c) => c.id));
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
      projects,
      cuts,
      notes: data.notes.filter((n) => cutIds.has(n.cutId)),
      chapters: data.chapters.filter((c) => cutIds.has(c.cutId)),
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

/* ------------------------------------------------------------------------
 * Every change goes through authorize(). One rule per action type; the
 * exhaustive switch makes a new action impossible to add without a rule.
 * ---------------------------------------------------------------------- */

export type Decision = { ok: true } | { ok: false; reason: string };

const OK: Decision = { ok: true };
const no = (reason: string): Decision => ({ ok: false, reason });

function accountLabel(data: DemoData, accountId: string): string {
  const a = data.accounts.find((x) => x.id === accountId);
  const p = a && data.platforms.find((x) => x.id === a.platform);
  return a ? `${p?.name ?? ''} ${a.handle}`.trim() : 'this account';
}
const spaceLabel = (data: DemoData, spaceId: string) => data.brands.find((b) => b.id === spaceId)?.name ?? 'this Space';

function needOnAccount(data: DemoData, m: Member | undefined, accountId: string, cap: Capability): Decision {
  return capabilitiesOn(data, m, accountId).has(cap) ? OK : no(`Needs ${CAPABILITY_LABEL[cap]} on ${accountLabel(data, accountId)}.`);
}
function needOnSpace(data: DemoData, m: Member | undefined, spaceId: string, cap: Capability): Decision {
  return capabilitiesOnSpace(m, spaceId).has(cap) ? OK : no(`Needs ${CAPABILITY_LABEL[cap]} on the whole ${spaceLabel(data, spaceId)} Space.`);
}
const all = (...ds: Decision[]): Decision => ds.find((d) => !d.ok) ?? OK;

function needOnProject(data: DemoData, m: Member | undefined, p: VideoProject, cap: Capability): Decision {
  return capabilitiesOnProject(data, m, p).has(cap) ? OK : no(`Needs ${CAPABILITY_LABEL[cap]} on “${p.title}”.`);
}
/** Feedback (notes) comes from people who edit or review the video. */
function mayGiveFeedback(data: DemoData, m: Member | undefined, p: VideoProject): Decision {
  const caps = capabilitiesOnProject(data, m, p);
  return caps.has('edit') || caps.has('review') ? OK : no(`Needs Edit or Review on “${p.title}” to leave notes.`);
}

/** Change a file: through a version that uses it (edit on that account), or its idea's or own Space (edit). */
export function canEditAsset(data: DemoData, m: Member | undefined, asset: Asset): boolean {
  if (!canSeeAsset(data, m, asset)) return false;
  if (hasFullAccess(m) && m?.status === 'active') return true;
  const usedBy = data.versions.filter((v) => v.mediaAssetId === asset.id || v.coverAssetId === asset.id || v.photoAssetIds?.includes(asset.id));
  if (usedBy.some((v) => capabilitiesOn(data, m, v.accountId).has('edit'))) return true;
  const projects = data.cuts.filter((c) => c.assetId === asset.id).map((c) => projectOfCut(data, c));
  if (projects.some((p) => p && capabilitiesOnProject(data, m, p).has('edit'))) return true;
  const spaces = [...asset.ideaIds.map((id) => data.ideas.find((i) => i.id === id)?.spaceId), asset.spaceId].filter((s): s is string => !!s);
  return spaces.some((s) => capabilitiesOnSpace(m, s).has('edit'));
}

const versionOf = (data: DemoData, id: string) => data.versions.find((v) => v.id === id);
const ideaById = (data: DemoData, id: string | undefined) => data.ideas.find((i) => i.id === id);
const MISSING = no('That work isn’t shared with you.');

/**
 * Whether a person may perform an action. The same rule set will run on the
 * server (Postgres functions and RLS); here it guards the preview's store.
 */
export function authorize(data: DemoData, personId: string, action: Action): Decision {
  const m = memberOf(data, personId);
  if (!m || m.status !== 'active') return no('Only active members can make changes.');
  const full = hasFullAccess(m);
  const adminOnly = full ? OK : no('Only the owner and admins can do this.');

  switch (action.type) {
    case 'notifications/read':
      return OK;

    case 'member/role':
    case 'member/grant':
    case 'member/invite':
    case 'member/remove':
      return adminOnly;

    case 'idea/add': {
      if (full) return OK;
      if (action.accountIds.length) return all(...action.accountIds.map((a) => needOnAccount(data, m, a, 'edit')));
      return action.spaceId ? needOnSpace(data, m, action.spaceId, 'edit') : no('Choose an account or Space you can edit.');
    }
    case 'idea/status':
    case 'idea/shot-toggle':
    case 'idea/archive': {
      const idea = ideaById(data, action.ideaId);
      if (!idea || !canSeeIdea(data, m, idea)) return MISSING;
      // Idea-level fields belong to the Space; account-only collaborators can't change them.
      return full ? OK : needOnSpace(data, m, idea.spaceId, 'edit');
    }
    case 'idea/delete':
      return adminOnly;

    case 'version/add': {
      const idea = ideaById(data, action.ideaId);
      if (!idea || !canSeeIdea(data, m, idea)) return MISSING;
      return needOnAccount(data, m, action.accountId, 'edit');
    }
    case 'version/status': {
      const v = versionOf(data, action.versionId);
      if (!v || !canSeeVersion(data, m, v)) return MISSING;
      if (action.status === 'Ready to post') return needOnAccount(data, m, v.accountId, 'review');
      if (action.status === 'Posted' || v.status === 'Posted') return needOnAccount(data, m, v.accountId, 'publish');
      return needOnAccount(data, m, v.accountId, 'edit');
    }
    case 'version/live-url': {
      const v = versionOf(data, action.versionId);
      return v && canSeeVersion(data, m, v) ? needOnAccount(data, m, v.accountId, 'publish') : MISSING;
    }
    case 'version/caption':
    case 'version/check':
    case 'version/reschedule': {
      const v = versionOf(data, action.versionId);
      return v && canSeeVersion(data, m, v) ? needOnAccount(data, m, v.accountId, 'edit') : MISSING;
    }
    case 'version/cover':
    case 'version/media': {
      const v = versionOf(data, action.versionId);
      if (!v || !canSeeVersion(data, m, v)) return MISSING;
      // A linked file must itself be one this person can open.
      const asset = action.assetId ? data.assets.find((a) => a.id === action.assetId) : undefined;
      if (action.assetId && (!asset || !canSeeAsset(data, m, asset))) return no('That file isn’t shared with you.');
      return needOnAccount(data, m, v.accountId, 'edit');
    }

    case 'asset/favorite':
    case 'asset/dismiss-duplicate': {
      const asset = data.assets.find((a) => a.id === action.assetId);
      if (!asset || !canSeeAsset(data, m, asset)) return MISSING;
      return canEditAsset(data, m, asset) ? OK : no('Needs Edit & upload on the work this file belongs to.');
    }
    case 'asset/promote': {
      const asset = data.assets.find((a) => a.id === action.assetId);
      if (!asset || !canSeeAsset(data, m, asset)) return MISSING;
      if (full) return OK;
      // The Raw Library is Space-level: promoting needs edit on the whole Space.
      const space = ideaById(data, asset.ideaIds[0])?.spaceId ?? asset.spaceId;
      return space ? needOnSpace(data, m, space, 'edit') : adminOnly;
    }
    case 'asset/add-session': {
      if (full) return OK;
      if (action.forVersionId) {
        const v = versionOf(data, action.forVersionId);
        return v && canSeeVersion(data, m, v) ? needOnAccount(data, m, v.accountId, 'edit') : MISSING;
      }
      const idea = ideaById(data, action.asset.ideaIds[0]);
      if (idea) return needOnSpace(data, m, idea.spaceId, 'edit');
      if (action.asset.spaceId) return needOnSpace(data, m, action.asset.spaceId, 'edit');
      return no('Only the owner and admins add workspace-wide files.');
    }

    case 'task/add': {
      const t = action.task;
      const owner = memberOf(data, t.ownerId);
      if (!owner || !canSeeTask(data, owner, { ...t, id: 'draft', done: false })) return no('The assignee can’t see that work.');
      if (full) return OK;
      if (t.versionId) {
        const v = versionOf(data, t.versionId);
        return v && canSeeVersion(data, m, v) ? needOnAccount(data, m, v.accountId, 'edit') : MISSING;
      }
      const idea = ideaById(data, t.ideaId);
      return idea ? needOnSpace(data, m, idea.spaceId, 'edit') : adminOnly;
    }
    case 'task/toggle': {
      const t = data.tasks.find((x) => x.id === action.taskId);
      if (!t || !canSeeTask(data, m, t)) return MISSING;
      // The assignee may tick off their own task; others need edit on the work.
      if (full || t.ownerId === personId) return OK;
      if (t.versionId) {
        const v = versionOf(data, t.versionId);
        return v ? needOnAccount(data, m, v.accountId, 'edit') : MISSING;
      }
      const idea = ideaById(data, t.ideaId);
      return idea ? needOnSpace(data, m, idea.spaceId, 'edit') : adminOnly;
    }

    case 'link/add': {
      if (full) return OK;
      const l = action.link;
      if (l.accountId) return needOnAccount(data, m, l.accountId, 'edit');
      const idea = ideaById(data, l.ideaId);
      if (idea) return needOnSpace(data, m, idea.spaceId, 'edit');
      return no('Only the owner and admins add workspace-wide links.');
    }

    /* Video Studio */
    case 'studio/plan': {
      if (!action.existingIdea) {
        if (full) return OK;
        if (action.accountIds.length) return all(...action.accountIds.map((a) => needOnAccount(data, m, a, 'edit')));
        return needOnSpace(data, m, action.spaceId, 'edit');
      }
      const idea = ideaById(data, action.ideaId);
      if (!idea || !canSeeIdea(data, m, idea)) return MISSING;
      if (full || capabilitiesOnSpace(m, idea.spaceId).has('edit')) return OK;
      if (!action.accountIds.length) return needOnSpace(data, m, idea.spaceId, 'edit');
      return all(...action.accountIds.map((a) => needOnAccount(data, m, a, 'edit')));
    }
    case 'studio/plan-update': {
      const idea = ideaById(data, action.ideaId);
      if (!idea || !canSeeIdea(data, m, idea)) return MISSING;
      // The plan belongs to the idea, which belongs to the Space.
      return full ? OK : needOnSpace(data, m, idea.spaceId, 'edit');
    }
    case 'studio/cut-add': {
      const p = data.projects.find((x) => x.id === action.cut.projectId);
      if (!p || !canSeeProject(data, m, p)) return MISSING;
      // Linking an existing file needs access to that file.
      if (!action.asset) {
        const existing = data.assets.find((a) => a.id === action.cut.assetId);
        if (!existing || !canSeeAsset(data, m, existing)) return no('That file isn’t shared with you.');
      }
      return needOnProject(data, m, p, 'edit');
    }
    case 'studio/cut-update':
    case 'studio/cut-current':
    case 'studio/cut-archive': {
      const p = projectOfCut(data, data.cuts.find((c) => c.id === action.cutId));
      if (!p || !canSeeProject(data, m, p)) return MISSING;
      return needOnProject(data, m, p, 'edit');
    }
    case 'studio/cut-delete': {
      const p = projectOfCut(data, data.cuts.find((c) => c.id === action.cutId));
      if (!p || !canSeeProject(data, m, p)) return MISSING;
      // Deleting a file is Space-level: owner, admins, or edit on the whole Space.
      const idea = ideaById(data, p.ideaId);
      return full ? OK : idea ? needOnSpace(data, m, idea.spaceId, 'edit') : adminOnly;
    }
    case 'studio/approve': {
      const p = projectOfCut(data, data.cuts.find((c) => c.id === action.cutId));
      if (!p || !canSeeProject(data, m, p)) return MISSING;
      return needOnProject(data, m, p, 'review');
    }
    case 'studio/note-add': {
      const p = projectOfCut(data, data.cuts.find((c) => c.id === action.note.cutId));
      if (!p || !canSeeProject(data, m, p)) return MISSING;
      if (action.note.authorId !== personId) return no('Notes are added in your own name.');
      return mayGiveFeedback(data, m, p);
    }
    case 'studio/note-update':
    case 'studio/note-delete': {
      const n = data.notes.find((x) => x.id === action.noteId);
      const p = projectOfCut(data, data.cuts.find((c) => c.id === n?.cutId));
      if (!n || !p || !canSeeProject(data, m, p)) return MISSING;
      return mayGiveFeedback(data, m, p);
    }
    case 'studio/note-carry': {
      const n = data.notes.find((x) => x.id === action.noteId);
      const from = projectOfCut(data, data.cuts.find((c) => c.id === n?.cutId));
      const to = projectOfCut(data, data.cuts.find((c) => c.id === action.toCutId));
      if (!n || !from || !to || from.id !== to.id || !canSeeProject(data, m, to)) return MISSING;
      return mayGiveFeedback(data, m, to);
    }
    case 'workspace/storage-add':
      // Billing changes belong to the owner and admins.
      return adminOnly;
  }
  const unreachable: never = action;
  return unreachable;
}
