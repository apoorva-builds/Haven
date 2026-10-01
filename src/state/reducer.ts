/**
 * Pure in-memory reducer for the demo workspace.
 *
 * Nothing here is persisted: every change lasts only for the browser session.
 * The UI says so wherever it matters (uploads, storage, posting).
 */
import { READY_CHECKS } from '../data/demo';
import { addDays, daysBetween } from '../lib/dates';
import { toggleGrant } from '../lib/access';
import type { AccessGrant, AccessScope, Asset, Capability, DemoData, IdeaStatus, ISODate, LinkItem, Task, Version, VersionStatus, WorkspaceRole } from '../data/types';

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
  | { type: 'version/live-url'; versionId: string; url: string }
  | { type: 'asset/favorite'; assetId: string }
  | { type: 'asset/promote'; assetId: string }
  | { type: 'asset/add-session'; asset: Asset; forVersionId?: string }
  | { type: 'asset/dismiss-duplicate'; assetId: string }
  | { type: 'link/add'; link: Omit<LinkItem, 'id'> }
  | { type: 'notifications/read' }
  | { type: 'member/role'; personId: string; role: Exclude<WorkspaceRole, 'owner'> }
  | { type: 'member/grant'; personId: string; scope: AccessScope; capability: Capability; on: boolean }
  | { type: 'member/invite'; name: string; email: string; role: Exclude<WorkspaceRole, 'owner'>; grants: AccessGrant[] }
  | { type: 'member/remove'; personId: string };

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

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
      return {
        ...state,
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
      const next = mapVersion(state, action.versionId, (v) => ({ ...v, liveUrl: url || undefined, status: url ? 'Posted' : v.status }));
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
  }
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
