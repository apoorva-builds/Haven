/**
 * Short explanations shown behind ⓘ buttons. Kept in one place so the
 * wording stays consistent and out of the way until someone asks.
 */
export const HELP = {
  team: {
    topic: 'Team & access',
    text: 'The owner and admins have full access. Everyone else sees only the Spaces and social accounts you assign, with view, edit & upload, review & approve, or publish. Each person signs in to Haven as themselves; nobody needs your social account passwords. In this preview, access only filters this browser tab.',
  },
  capabilities: {
    topic: 'Capabilities',
    text: 'View: open the work and its files. Edit & upload: change versions, captions and dates, and add files. Review & approve: move a version to Ready to post. Publish: record a post as live. Haven has no platform connections yet, so posting itself stays manual in each app.',
  },
  gallery: {
    topic: 'Creation Gallery',
    text: 'Every post you’re making: what’s coming up, then what’s posted. Each tile is one account’s version of an idea, shown in its real proportions. Open a tile to watch it or page through its photos without leaving Haven.',
  },
  accounts: {
    topic: 'Account filter',
    text: 'Show all accounts together, or pick one to see only its posts and its Audience Pulse. Accounts are grouped by Space.',
  },
  status: {
    topic: 'Post status',
    text: 'Planned: scheduled, still being made. In review: waiting for approval. Ready: checklist done, ready to post. Posted: you posted it yourself and saved the live link. Haven never posts for you.',
  },
  tiles: {
    topic: 'Tiles and platform marks',
    text: 'Under each tile: its title, the platform and format (like “Instagram · Reel”, with a small mark in the platform’s colour), its status and date. The account and the idea it came from are in the opened view.',
  },
  pulse: {
    topic: 'Audience Pulse',
    text: 'Followers or subscribers for this account, the change over 7 and 30 days, and a 30-day trend. In this preview the figures are samples. Real accounts would refresh from the platform’s official API, or from snapshots you enter. A count that’s too old shows as “Out of date”, never as current.',
  },
  library: {
    topic: 'Raw Library',
    text: 'Source files you reuse: original photos, audio and music, unedited clips and brand assets. Finished posts live in the Creation Gallery, not here. Nothing is deleted automatically.',
  },
  versions: {
    topic: 'Versions',
    text: 'One idea, one version per account. Each version keeps its own finished media, cover, caption, checklist and status, so two Instagram accounts can post different cuts of the same idea.',
  },
  finished: {
    topic: 'Finished video',
    text: 'The final edit for this account’s version. Several accounts can use the same file without copies. A file chosen from this device plays only in this tab and isn’t uploaded.',
  },
  memories: {
    topic: 'Memories',
    text: 'Memories come only from your creations marked as posted, with media you can open. One leads each day, in rotation; a post from this day in an earlier year comes first. Nothing is made up: with nothing posted, there are no memories.',
  },
  work: {
    topic: 'Needs attention',
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
