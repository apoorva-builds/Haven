/**
 * Pure in-memory reducer for the demo workspace.
 *
 * Nothing here is persisted: every change lasts only for the browser session.
 * The UI says so wherever it matters (uploads, storage, posting).
 */
import { READY_CHECKS } from '../data/demo';
import { addDays, daysBetween } from '../lib/dates';
import { toggleGrant } from '../lib/access';
import type { AccessGrant, AccessScope, Aspect, Asset, Capability, Cut, PublishCheck, DemoData, Idea, IdeaStatus, ISODate, LinkItem, Task, TimeNote, Version, VersionStatus, VideoPlan, WorkspaceRole } from '../data/types';

export type Action =
  | { type: 'task/toggle'; taskId: string }
  | { type: 'task/add'; task: Omit<Task, 'id' | 'done'> }
  | { type: 'idea/add'; title: string; campaignId?: string; accountIds: string[]; spaceId?: string }
  | { type: 'idea/status'; ideaId: string; status: IdeaStatus }
  | { type: 'idea/archive'; ideaId: string; archived: boolean }
  | { type: 'idea/delete'; ideaId: string }
  | { type: 'idea/shot-toggle'; ideaId: string; shotId: string }
  | { type: 'version/add'; ideaId: string; accountId: string }
  | { type: 'version/status'; versionId: string; status: VersionStatus }
  | { type: 'version/caption'; versionId: string; lang: string; text: string }
  | { type: 'version/check'; versionId: string; itemId: string }
  | { type: 'version/cover'; versionId: string; assetId: string }
  | { type: 'version/media'; versionId: string; assetId: string | undefined }
  | { type: 'version/reschedule'; versionId: string; date: ISODate }
  | { type: 'version/live-url'; versionId: string; url: string; at?: string }
  | { type: 'asset/favorite'; assetId: string }
  | { type: 'asset/promote'; assetId: string }
  | { type: 'asset/add-session'; asset: Asset; forVersionId?: string }
  | { type: 'asset/dismiss-duplicate'; assetId: string }
  | { type: 'link/add'; link: Omit<LinkItem, 'id'> }
  | { type: 'notifications/read' }
  | { type: 'member/role'; personId: string; role: Exclude<WorkspaceRole, 'owner'> }
  | { type: 'member/grant'; personId: string; scope: AccessScope; capability: Capability; on: boolean }
  | { type: 'member/invite'; name: string; email: string; role: Exclude<WorkspaceRole, 'owner'>; grants: AccessGrant[] }
  | { type: 'member/remove'; personId: string }
  // Video Studio
  | {
      type: 'studio/plan';
      /** Ids chosen by the caller so the page can open the new plan. */
      projectId: string;
      /** An existing idea, or a new one created with `title`. */
      ideaId: string;
      existingIdea: boolean;
      title: string;
      spaceId: string;
      accountIds: string[];
      aspect: Aspect;
      concept?: string;
      plan?: VideoPlan;
    }
  | { type: 'studio/plan-update'; ideaId: string; patch: PlanPatch }
  | { type: 'studio/cut-add'; cut: Cut; asset?: Asset; makeCurrent: boolean }
  | { type: 'studio/cut-update'; cutId: string; label: string }
  | { type: 'studio/cut-current'; cutId: string }
  | { type: 'studio/cut-archive'; cutId: string; archived: boolean }
  | { type: 'studio/cut-delete'; cutId: string }
  | { type: 'studio/check'; cutId: string; check: PublishCheck; done: boolean }
  | { type: 'studio/ready'; cutId: string; ready: boolean; at?: string }
  | { type: 'studio/note-add'; note: TimeNote }
  | { type: 'studio/note-update'; noteId: string; patch: Partial<Pick<TimeNote, 'text' | 'section' | 'startSec' | 'endSec' | 'resolved'>> }
  | { type: 'studio/note-delete'; noteId: string }
  | { type: 'studio/note-carry'; noteId: string; toCutId: string; startSec: number; endSec?: number; newId: string }
  | { type: 'workspace/storage-add'; gb: number };

/** Plan fields that can be edited after the plan is made. */
export type PlanPatch = Partial<Pick<Idea, 'title' | 'concept' | 'script' | 'references' | 'shotList' | 'plan'>>;

let counter = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function reducer(state: DemoData, action: Action): DemoData {
  switch (action.type) {
    case 'task/toggle':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t)),
      };

    case 'task/add':
      return { ...state, tasks: [...state.tasks, { ...action.task, id: uid('task'), done: false }] };

    case 'idea/add': {
      const id = uid('idea');
      const hue = Math.floor(Math.random() * 360);
      const due = addDays(state.today, 7);
      return {
        ...state,
        ideas: [
          {
            id,
            title: action.title.trim() || 'Untitled idea',
            campaignId: action.campaignId,
            spaceId: state.accounts.find((a) => a.id === action.accountIds[0])?.brandId ?? action.spaceId ?? state.brands[0]?.id ?? '',
            status: 'Idea',
            due,
            art: { motif: 'grain', hue, hue2: (hue + 60) % 360 },
            concept: '',
            script: '',
            shotList: [],
            references: [],
            peopleIds: [state.currentUserId],
            updatedAt: state.today,
            archived: false,
          },
          ...state.ideas,
        ],
        versions: [
          ...state.versions,
          ...action.accountIds.map((accountId) => blankVersion(state, id, accountId, due)),
        ],
      };
    }

    case 'idea/status':
      return {
        ...state,
        ideas: state.ideas.map((i) => (i.id === action.ideaId ? { ...i, status: action.status, updatedAt: state.today } : i)),
      };

    case 'idea/archive':
      return {
        ...state,
        ideas: state.ideas.map((i) => (i.id === action.ideaId ? { ...i, archived: action.archived } : i)),
      };

    case 'idea/delete': {
      // Library originals and assets shared with other ideas are kept; only the
      // reference to this idea is removed. Idea-only assets go with the idea.
      const assets = state.assets
        .filter((a) => !a.ideaIds.includes(action.ideaId) || a.inLibrary || a.ideaIds.length > 1)
        .map((a) => (a.ideaIds.includes(action.ideaId) ? { ...a, ideaIds: a.ideaIds.filter((x) => x !== action.ideaId) } : a));
      const removedVersionIds = new Set(state.versions.filter((v) => v.ideaId === action.ideaId).map((v) => v.id));
      const removedProjects = new Set(state.projects.filter((p) => p.ideaId === action.ideaId).map((p) => p.id));
      const removedCuts = new Set(state.cuts.filter((c) => removedProjects.has(c.projectId)).map((c) => c.id));
      return {
        ...state,
        projects: state.projects.filter((p) => !removedProjects.has(p.id)),
        cuts: state.cuts.filter((c) => !removedCuts.has(c.id)),
        notes: state.notes.filter((n) => !removedCuts.has(n.cutId)),
        chapters: state.chapters.filter((c) => !removedCuts.has(c.cutId)),
        ideas: state.ideas.filter((i) => i.id !== action.ideaId),
        versions: state.versions.filter((v) => v.ideaId !== action.ideaId),
        tasks: state.tasks.filter((t) => t.ideaId !== action.ideaId && !(t.versionId && removedVersionIds.has(t.versionId))),
        links: state.links.filter((l) => l.ideaId !== action.ideaId),
        assets,
      };
    }

    case 'idea/shot-toggle':
      return {
        ...state,
        ideas: state.ideas.map((i) =>
          i.id === action.ideaId
            ? { ...i, shotList: i.shotList.map((s) => (s.id === action.shotId ? { ...s, done: !s.done } : s)) }
            : i,
        ),
      };

    case 'version/add': {
      const account = state.accounts.find((a) => a.id === action.accountId);
      const idea = state.ideas.find((i) => i.id === action.ideaId);
      if (!account || !idea) return state;
      return { ...state, versions: [...state.versions, blankVersion(state, idea.id, account.id, idea.due)] };
    }

    case 'version/status':
      return mapVersion(state, action.versionId, (v) => ({ ...v, status: action.status }));

    case 'version/caption':
      return mapVersion(state, action.versionId, (v) => ({ ...v, captions: { ...v.captions, [action.lang]: action.text } }));

    case 'version/check':
      return mapVersion(state, action.versionId, (v) => ({
        ...v,
        checklist: v.checklist.map((c) => (c.id === action.itemId ? { ...c, done: !c.done } : c)),
      }));

    case 'version/media': {
      // Versions reference a Library video; choosing one never copies it.
      const version = state.versions.find((v) => v.id === action.versionId);
      if (!version) return state;
      const next = mapVersion(state, action.versionId, (v) => ({ ...v, mediaAssetId: action.assetId }));
      if (!action.assetId) return next;
      return mapAsset(next, action.assetId, (a) => (a.ideaIds.includes(version.ideaId) ? a : { ...a, ideaIds: [...a.ideaIds, version.ideaId] }));
    }

    case 'version/cover':
      return mapVersion(state, action.versionId, (v) => ({ ...v, coverAssetId: action.assetId }));

    case 'version/reschedule': {
      // Rescheduling moves the version and any open tasks attached to it by the same offset.
      const version = state.versions.find((v) => v.id === action.versionId);
      if (!version) return state;
      const next = mapVersion(state, action.versionId, (v) => ({ ...v, scheduledFor: action.date }));
      const shift = daysBetween(version.scheduledFor, action.date);
      return {
        ...next,
        tasks: next.tasks.map((t) => (t.versionId === action.versionId && !t.done ? { ...t, due: addDays(t.due, shift) } : t)),
      };
    }

    case 'version/live-url': {
      const url = action.url.trim();
      // Recorded in Haven: the post went live now, unless it already had a time.
      const next = mapVersion(state, action.versionId, (v) =>
        url
          ? { ...v, liveUrl: url, status: 'Posted', postedAt: v.postedAt ?? action.at ?? new Date().toISOString(), postSource: v.postSource ?? 'manual' }
          : { ...v, liveUrl: undefined },
      );
      const version = next.versions.find((v) => v.id === action.versionId);
      if (!url || !version) return next;
      const account = next.accounts.find((a) => a.id === version.accountId);
      const idea = next.ideas.find((i) => i.id === version.ideaId);
      const linkId = `l-live-${version.id}`;
      const link: LinkItem = {
        id: linkId,
        category: 'published',
        label: `${idea?.title ?? 'Post'} — ${account?.displayName ?? ''} ${version.format}`,
        url,
        accountId: version.accountId,
        ideaId: version.ideaId,
      };
      return { ...next, links: [...next.links.filter((l) => l.id !== linkId), link] };
    }

    case 'asset/favorite':
      return mapAsset(state, action.assetId, (a) => ({ ...a, favorite: !a.favorite }));

    case 'asset/promote':
      return mapAsset(state, action.assetId, (a) => ({ ...a, inLibrary: true }));

    case 'asset/add-session':
      return { ...state, assets: [action.asset, ...state.assets] };

    case 'asset/dismiss-duplicate':
      return mapAsset(state, action.assetId, (a) => ({ ...a, duplicateOfId: undefined }));

    case 'link/add':
      return { ...state, links: [...state.links, { ...action.link, id: uid('link') }] };

    case 'notifications/read':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, unread: false })) };

    // Team & access (preview): changes last for this session and are not enforced by a server.
    case 'member/role':
      return {
        ...state,
        members: state.members.map((m) => (m.personId === action.personId && m.role !== 'owner' ? { ...m, role: action.role } : m)),
      };

    case 'member/grant':
      return {
        ...state,
        members: state.members.map((m) => (m.personId === action.personId && m.role === 'collaborator' ? toggleGrant(m, action.scope, action.capability, action.on) : m)),
      };

    case 'member/invite': {
      const email = action.email.trim().toLowerCase();
      if (!email || state.members.some((m) => m.email === email)) return state;
      const id = uid('person');
      const name = action.name.trim() || email.split('@')[0];
      return {
        ...state,
        people: [...state.people, { id, name, role: action.role === 'admin' ? 'Admin (invited)' : 'Collaborator (invited)', hue: Math.floor(Math.random() * 360) }],
        members: [...state.members, { personId: id, email, role: action.role, status: 'invited', grants: action.grants }],
      };
    }

    case 'member/remove':
      return { ...state, members: state.members.filter((m) => m.personId !== action.personId || m.role === 'owner') };

    /* Video Studio. Every change here lasts for this browser session only. */
    case 'studio/plan': {
      let next = state;
      if (!action.existingIdea) {
        next = reducer(state, { type: 'idea/add', title: action.title, accountIds: action.accountIds, spaceId: action.spaceId });
        // idea/add makes its own id; give the new idea the caller's id.
        const made = next.ideas[0];
        next = {
          ...next,
          ideas: next.ideas.map((i) => (i.id === made.id ? { ...i, id: action.ideaId, concept: action.concept ?? '', plan: action.plan } : i)),
          versions: next.versions.map((v) => (v.ideaId === made.id ? { ...v, ideaId: action.ideaId, aspect: action.aspect } : v)),
        };
      } else {
        // Add a version for any chosen account the idea doesn't have yet.
        const idea = next.ideas.find((i) => i.id === action.ideaId);
        if (!idea) return state;
        for (const accountId of action.accountIds) {
          if (!next.versions.some((v) => v.ideaId === idea.id && v.accountId === accountId)) next = reducer(next, { type: 'version/add', ideaId: idea.id, accountId });
        }
        if (action.plan) next = { ...next, ideas: next.ideas.map((i) => (i.id === idea.id ? { ...i, plan: i.plan ?? action.plan } : i)) };
      }
      const versionIds = next.versions.filter((v) => v.ideaId === action.ideaId && action.accountIds.includes(v.accountId)).map((v) => v.id);
      const title = action.title.trim() || next.ideas.find((i) => i.id === action.ideaId)?.title || 'Untitled video';
      return { ...next, projects: [...next.projects, { id: action.projectId, ideaId: action.ideaId, title, aspect: action.aspect, versionIds }] };
    }

    case 'studio/plan-update':
      return {
        ...state,
        ideas: state.ideas.map((i) => (i.id === action.ideaId ? { ...i, ...action.patch, updatedAt: state.today } : i)),
      };

    case 'studio/cut-add': {
      // A new upload is always a new cut. Nothing earlier is replaced.
      const assets = action.asset && !state.assets.some((a) => a.id === action.asset!.id) ? [action.asset, ...state.assets] : state.assets;
      return {
        ...state,
        assets,
        cuts: [...state.cuts, action.cut],
        projects: action.makeCurrent ? state.projects.map((p) => (p.id === action.cut.projectId ? { ...p, currentCutId: action.cut.id } : p)) : state.projects,
      };
    }

    case 'studio/cut-update':
      return { ...state, cuts: state.cuts.map((c) => (c.id === action.cutId ? { ...c, label: action.label.trim() || c.label } : c)) };

    case 'studio/cut-current': {
      const cut = state.cuts.find((c) => c.id === action.cutId);
      if (!cut) return state;
      return {
        ...state,
        cuts: state.cuts.map((c) => (c.id === cut.id ? { ...c, archived: false } : c)),
        projects: state.projects.map((p) => (p.id === cut.projectId ? { ...p, currentCutId: cut.id } : p)),
      };
    }

    case 'studio/cut-archive':
      // Archived cuts stay in history and still use storage.
      return { ...state, cuts: state.cuts.map((c) => (c.id === action.cutId ? { ...c, archived: action.archived } : c)) };

    case 'studio/cut-delete': {
      const cut = state.cuts.find((c) => c.id === action.cutId);
      if (!cut) return state;
      const cuts = state.cuts.filter((c) => c.id !== cut.id);
      // The file goes only if nothing else uses it (another cut, a creation, the Raw Library).
      const asset = state.assets.find((a) => a.id === cut.assetId);
      const stillUsed =
        cuts.some((c) => c.assetId === cut.assetId) ||
        state.versions.some((v) => v.mediaAssetId === cut.assetId || v.coverAssetId === cut.assetId || v.photoAssetIds?.includes(cut.assetId)) ||
        !!asset?.inLibrary;
      const remaining = cuts.filter((c) => c.projectId === cut.projectId).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
      const fallback = remaining.filter((c) => !c.archived).pop() ?? remaining[remaining.length - 1];
      return {
        ...state,
        cuts,
        assets: stillUsed ? state.assets : state.assets.filter((a) => a.id !== cut.assetId),
        notes: state.notes.filter((n) => n.cutId !== cut.id),
        chapters: state.chapters.filter((c) => c.cutId !== cut.id),
        projects: state.projects.map((p) =>
          p.id === cut.projectId
            ? { ...p, currentCutId: p.currentCutId === cut.id ? fallback?.id : p.currentCutId, approvedCutId: p.approvedCutId === cut.id ? undefined : p.approvedCutId }
            : p,
        ),
      };
    }

    case 'studio/check': {
      // Ticking a check never changes the file; it records what someone confirmed.
      const cut = state.cuts.find((c) => c.id === action.cutId);
      if (!cut || cut.kind !== 'final') return state;
      const done = new Set(cut.checklist?.done ?? []);
      if (action.done) done.add(action.check);
      else done.delete(action.check);
      const unready = !action.done;
      return {
        ...state,
        cuts: state.cuts.map((c) => (c.id === cut.id ? { ...c, checklist: { done: [...done], readyAt: unready ? undefined : c.checklist?.readyAt, readyById: unready ? undefined : c.checklist?.readyById } } : c)),
        projects: unready ? state.projects.map((p) => (p.approvedCutId === cut.id ? { ...p, approvedCutId: undefined } : p)) : state.projects,
      };
    }

    case 'studio/ready': {
      // Ready to publish: a decision in Haven, not a post. Needs every check.
      const cut = state.cuts.find((c) => c.id === action.cutId);
      if (!cut || cut.kind !== 'final') return state;
      if (action.ready && (cut.checklist?.done.length ?? 0) < 3) return state;
      return {
        ...state,
        cuts: state.cuts.map((c) =>
          c.id === cut.id ? { ...c, checklist: { done: c.checklist?.done ?? [], readyAt: action.ready ? (action.at ?? new Date().toISOString()) : undefined, readyById: action.ready ? state.currentUserId : undefined } } : c,
        ),
        projects: state.projects.map((p) => (p.id === cut.projectId ? { ...p, approvedCutId: action.ready ? cut.id : undefined, currentCutId: action.ready ? cut.id : p.currentCutId } : p)),
      };
    }

    case 'studio/note-add':
      return { ...state, notes: [...state.notes, action.note] };

    case 'studio/note-update':
      return { ...state, notes: state.notes.map((n) => (n.id === action.noteId ? normaliseNote({ ...n, ...action.patch }) : n)) };

    case 'studio/note-delete':
      // Only the note goes; the video and its other notes are untouched.
      return { ...state, notes: state.notes.filter((n) => n.id !== action.noteId) };

    case 'studio/note-carry': {
      // Carrying forward copies the feedback to the new cut at a time the
      // creator chose. The original stays on its own cut, unchanged.
      const from = state.notes.find((n) => n.id === action.noteId);
      if (!from) return state;
      const note: TimeNote = normaliseNote({
        ...from,
        id: action.newId,
        cutId: action.toCutId,
        startSec: action.startSec,
        endSec: action.endSec,
        resolved: false,
        carriedFrom: from.id,
        createdAt: new Date().toISOString(),
      });
      return { ...state, notes: [...state.notes, note] };
    }

    case 'workspace/storage-add':
      // Preview only: nothing is charged and the allowance resets on reload.
      return { ...state, workspace: { ...state.workspace, addedStorageGB: (state.workspace.addedStorageGB ?? 0) + action.gb } };
  }
}

/** Ranges run forwards; an end at or before the start makes it a moment. */
function normaliseNote(n: TimeNote): TimeNote {
  const startSec = Math.max(0, n.startSec);
  const endSec = n.endSec !== undefined && n.endSec > startSec ? n.endSec : undefined;
  return { ...n, startSec, endSec };
}

function mapVersion(state: DemoData, id: string, fn: (v: DemoData['versions'][number]) => DemoData['versions'][number]): DemoData {
  return { ...state, versions: state.versions.map((v) => (v.id === id ? fn(v) : v)) };
}

function mapAsset(state: DemoData, id: string, fn: (a: Asset) => Asset): DemoData {
  return { ...state, assets: state.assets.map((a) => (a.id === id ? fn(a) : a)) };
}

function blankVersion(state: DemoData, ideaId: string, accountId: string, date: ISODate): Version {
  const platform = state.accounts.find((a) => a.id === accountId)?.platform;
  const wide = platform === 'youtube' || platform === 'newsletter';
  const square = platform === 'linkedin';
  return {
    id: uid('ver'),
    ideaId,
    accountId,
    format: platform === 'newsletter' ? 'Issue' : platform === 'linkedin' ? 'Post' : wide ? 'Video' : platform === 'tiktok' ? 'Clip' : 'Reel',
    aspect: wide ? '16:9' : square ? '1:1' : '9:16',
    captions: { en: '' },
    tags: [],
    links: [],
    onScreenText: [],
    scheduledFor: date,
    status: 'Planned',
    checklist: READY_CHECKS.map((label, i) => ({ id: `c${i + 1}`, label, done: false })),
  };
}
