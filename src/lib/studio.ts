import type { DemoData, Idea, IdeaStatus } from '../data/types';
import { daysBetween } from './dates';

/**
 * Haven's collection colours. Colour marks a collection (campaign or series)
 * in larger, intentional places: the Up next panel and text-only covers.
 */
export type Tone = 'cobalt' | 'jade' | 'ink';

const COLLECTION_TONE: Record<string, Tone> = {
  'phrase-guides': 'cobalt',
  routines: 'jade',
};

export function toneOf(idea: Pick<Idea, 'campaignId'>): Tone {
  // Coral and amber keep their own jobs (time, attention); other ideas stay ink.
  return (idea.campaignId && COLLECTION_TONE[idea.campaignId]) || 'ink';
}

/** The still that represents an idea: its own cover, else its first finished media. */
export function ideaImage(data: DemoData, idea: Idea): string | undefined {
  if (idea.art.image) return idea.art.image;
  for (const v of data.versions.filter((x) => x.ideaId === idea.id)) {
    const id = v.mediaAssetId ?? v.photoAssetIds?.[0] ?? v.coverAssetId;
    const image = data.assets.find((a) => a.id === id)?.art.image;
    if (image) return image;
  }
  return undefined;
}

export const STAGES: IdeaStatus[] = ['Idea', 'Gathering', 'Editing', 'In review', 'Ready', 'Posted'];

/**
 * The idea that most needs attention: the one behind your earliest open task,
 * otherwise the soonest-due idea that isn't posted yet.
 */
export function upNextIdea(data: DemoData): Idea | undefined {
  const live = (i: Idea | undefined): i is Idea => !!i && !i.archived && i.status !== 'Posted';
  const task = data.tasks
    .filter((t) => !t.done && t.ownerId === data.currentUserId && live(data.ideas.find((i) => i.id === t.ideaId)))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  if (task) return data.ideas.find((i) => i.id === task.ideaId);
  return data.ideas.filter(live).sort((a, b) => daysBetween(b.due, a.due))[0];
}
