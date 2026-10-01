import { workspaceUsedGB } from '../lib/videoStudio';
import type { Account, Asset, DemoData, Idea, Person, Platform, Task, Version } from '../data/types';

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined =>
  id ? list.find((x) => x.id === id) : undefined;

export const accountOf = (data: DemoData, id: string | undefined): Account | undefined => byId(data.accounts, id);
export const platformOf = (data: DemoData, id: string): Platform => data.platforms.find((p) => p.id === id)!;
export const personOf = (data: DemoData, id: string): Person | undefined => byId(data.people, id);
export const ideaOf = (data: DemoData, id: string | undefined): Idea | undefined => byId(data.ideas, id);
export const assetOf = (data: DemoData, id: string | undefined): Asset | undefined => byId(data.assets, id);

export const versionsForIdea = (data: DemoData, ideaId: string): Version[] =>
  data.versions.filter((v) => v.ideaId === ideaId);

export const versionsForAccount = (data: DemoData, accountId: string): Version[] =>
  data.versions.filter((v) => v.accountId === accountId).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

export const accountsForIdea = (data: DemoData, ideaId: string): Account[] => {
  const ids = new Set(versionsForIdea(data, ideaId).map((v) => v.accountId));
  return data.accounts.filter((a) => ids.has(a.id));
};

export const tasksForIdea = (data: DemoData, ideaId: string): Task[] => data.tasks.filter((t) => t.ideaId === ideaId);

export const assetsForIdea = (data: DemoData, ideaId: string): Asset[] => data.assets.filter((a) => a.ideaIds.includes(ideaId));

export const checklistProgress = (v: Version) => {
  const done = v.checklist.filter((c) => c.done).length;
  return { done, total: v.checklist.length, ratio: v.checklist.length ? done / v.checklist.length : 0 };
};

/** Workspace storage in GB. Each file counts once, however many places link to it. */
export const storageUsedGB = (data: DemoData): number => workspaceUsedGB(data);

/** Focus filter used on Today: everything, one account, or one campaign. */
export type Focus = { kind: 'all' } | { kind: 'account'; id: string } | { kind: 'campaign'; id: string };

export function taskMatchesFocus(data: DemoData, task: Task, focus: Focus): boolean {
  if (focus.kind === 'all') return true;
  const version = byId(data.versions, task.versionId);
  const idea = ideaOf(data, task.ideaId);
  if (focus.kind === 'account') {
    if (version) return version.accountId === focus.id;
    return !!idea && versionsForIdea(data, idea.id).some((v) => v.accountId === focus.id);
  }
  return idea?.campaignId === focus.id;
}

export function versionMatchesFocus(data: DemoData, v: Version, focus: Focus): boolean {
  if (focus.kind === 'all') return true;
  if (focus.kind === 'account') return v.accountId === focus.id;
  return ideaOf(data, v.ideaId)?.campaignId === focus.id;
}

export const isVideo = (a: Asset): boolean => a.kind === 'final' || a.kind === 'draft' || a.kind === 'raw' || a.kind === 'cutaway';

/** Finished videos that can play in the prototype; versions pick from these. */
export const finishedVideos = (data: DemoData): Asset[] => data.assets.filter((a) => a.kind === 'final' && !!a.videoUrl);

/** Raw Library: reusable source material only, never finished posts. */
export const rawLibrary = (data: DemoData): Asset[] => data.assets.filter((a) => a.inLibrary && a.kind !== 'final');

export const versionsUsingAsset = (data: DemoData, assetId: string): Version[] => data.versions.filter((v) => v.mediaAssetId === assetId);
