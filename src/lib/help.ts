/**
 * Short explanations shown behind ⓘ buttons. Kept in one place so the
 * wording stays consistent and out of the way until someone asks.
 */
export const HELP = {
  gallery: {
    topic: 'Creation Gallery',
    text: 'Every post you’re making, finished or planned, grouped by day. Each tile is one account’s version of an idea. Open a tile to watch it or page through its photos without leaving Haven.',
  },
  accounts: {
    topic: 'Account filter',
    text: 'Show all accounts together, or pick one to see only its posts and its Audience Pulse. Accounts are grouped by brand.',
  },
  status: {
    topic: 'Post status',
    text: 'Planned: scheduled, still being made. In review: waiting for approval. Ready: checklist done, ready to post. Posted: you posted it yourself and saved the live link. Haven never posts for you.',
  },
  tiles: {
    topic: 'Tiles and platform borders',
    text: 'The label on each tile names the platform and format, like “Instagram · Reel”. The border colour matches the platform. Underneath: the account, the status and the idea the post came from.',
  },
  pulse: {
    topic: 'Audience Pulse',
    text: 'Followers or subscribers for this account, the change over 7 and 30 days, and a 30-day trend. In this preview the figures are samples. Real accounts would refresh from the platform’s official API, or from snapshots you enter. A count that’s too old shows as “Out of date”, never as current.',
  },
  library: {
    topic: 'Raw Library',
    text: 'Source files you reuse: original photos, audio and music, unedited clips and brand assets. Finished posts live in the Creation Gallery, not here. Nothing is deleted automatically.',
  },
  finished: {
    topic: 'Finished video',
    text: 'The final edit for this account’s version. Several accounts can use the same file without copies. A file chosen from this device plays only in this tab and isn’t uploaded.',
  },
  work: {
    topic: 'Work',
    text: 'Tasks due today or tomorrow: yours, other people’s, and what’s coming up. Tick a task to mark it done for this session.',
  },
  ideas: {
    topic: 'Ideas',
    text: 'One tile per idea. An idea holds its source material and the versions planned for each account.',
  },
  calendar: {
    topic: 'Calendar',
    text: 'Planned versions by date. The content view colours posts by platform; the marketing view colours them by campaign. Drag a post to another day to reschedule it for this session.',
  },
  links: {
    topic: 'Links',
    text: 'Saved links such as live posts and brand resources. Opening a link leaves Haven.',
  },
} as const;

export type HelpKey = keyof typeof HELP;
