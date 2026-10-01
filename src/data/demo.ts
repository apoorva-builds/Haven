/**
 * Sample workspace for the Haven preview (Milestone 1).
 *
 * Everything here is fictional: the two brands (Pine & Paper, Little Atlas),
 * their accounts, the people, posts, files and audience figures. Handles end
 * in ".sample" and no account links to a real profile. Artwork is generated
 * and the videos are original synthetic samples (scripts/make-demo-media.mjs).
 *
 * Dates are relative to "today" so the gallery and calendar always look current.
 */
import { addDays, toISODate } from '../lib/dates';
import { sampleSnapshots } from '../lib/audience';
import { zonedInstant } from '../lib/time';

/** The sample workspace's time zone. Calendar days for posts are taken here. */
export const TIME_ZONE = 'America/Los_Angeles';
import type { Account, Asset, AudienceSeries, Campaign, ChecklistItem, DemoData, Idea, LinkItem, MarketingEvent, Member, Notification, Person, Platform, Task, Version } from './types';

export const PLATFORMS: Platform[] = [
  { id: 'youtube', name: 'YouTube', glyph: 'YT', hue: 10, tier: 'core' },
  { id: 'instagram', name: 'Instagram', glyph: 'IG', hue: 338, tier: 'core' },
  { id: 'tiktok', name: 'TikTok', glyph: 'TT', hue: 168, tier: 'core' },
  { id: 'linkedin', name: 'LinkedIn', glyph: 'in', hue: 210, tier: 'core' },
  { id: 'snapchat', name: 'Snapchat', glyph: 'SC', hue: 52, tier: 'core' },
  { id: 'x', name: 'X', glyph: 'X', hue: 230, tier: 'core' },
  { id: 'threads', name: 'Threads', glyph: 'Th', hue: 280, tier: 'more' },
  { id: 'pinterest', name: 'Pinterest', glyph: 'Pi', hue: 355, tier: 'more' },
  { id: 'facebook', name: 'Facebook', glyph: 'Fb', hue: 220, tier: 'more' },
  { id: 'bluesky', name: 'Bluesky', glyph: 'Bs', hue: 200, tier: 'more' },
  { id: 'podcast', name: 'Podcast', glyph: 'Pod', hue: 265, tier: 'more' },
  { id: 'newsletter', name: 'Newsletter', glyph: 'NL', hue: 35, tier: 'more' },
];

/** The hero idea: one file, four versions, three platforms, two Instagram accounts. */
export const HERO_IDEA_ID = 'market-phrases';

const checklist = (labels: string[], doneCount = 0): ChecklistItem[] => labels.map((label, i) => ({ id: `c${i + 1}`, label, done: i < doneCount }));

export const READY_CHECKS = [
  'Final media exported from editor',
  'Cover or opening frame approved',
  'Caption and tags proofread',
  'Links and mentions checked',
  'Music rights noted',
  'Posting time confirmed',
];

export function createDemoData(now: Date = new Date()): DemoData {
  const today = toISODate(now);
  const d = (offset: number) => addDays(today, offset);
  /** A wall-clock time on a sample day, in the workspace time zone. */
  const at = (date: string, time: string) => zonedInstant(date, time, TIME_ZONE);
  /** The same calendar day one year earlier, so the sample has an honest "on this day" memory. */
  const yearAgo = (() => {
    const t = new Date(now);
    t.setFullYear(t.getFullYear() - 1);
    return toISODate(t);
  })();
  const t = now.getTime();

  const people: Person[] = [
    { id: 'me', name: 'Robin', role: 'Creator · Owner (sample)', hue: 262 },
    { id: 'jonah', name: 'Jonah', role: 'Editor (sample)', hue: 188 },
    { id: 'priya', name: 'Priya', role: 'Producer (sample)', hue: 32 },
    { id: 'sam', name: 'Sam', role: 'Short-form editor (sample)', hue: 150 },
    { id: 'alex', name: 'Alex', role: 'Reviewer (sample)', hue: 210 },
  ];

  // Sample workspace members. Access here is a preview: it filters this tab only.
  const members: Member[] = [
    { personId: 'me', email: 'robin@example.com', role: 'owner', status: 'active', grants: [] },
    { personId: 'priya', email: 'priya@example.com', role: 'admin', status: 'active', grants: [] },
    {
      personId: 'jonah',
      email: 'jonah@example.com',
      role: 'collaborator',
      status: 'active',
      grants: [
        { scope: { kind: 'space', id: 'pine' }, capabilities: ['view', 'edit', 'review'] },
        { scope: { kind: 'account', id: 'ig-atlas' }, capabilities: ['view', 'edit'] },
      ],
    },
    {
      personId: 'sam',
      email: 'sam@example.com',
      role: 'collaborator',
      status: 'active',
      grants: [{ scope: { kind: 'account', id: 'tt-pine' }, capabilities: ['view', 'edit'] }],
    },
    {
      personId: 'alex',
      email: 'alex@example.com',
      role: 'collaborator',
      status: 'invited',
      grants: [{ scope: { kind: 'space', id: 'atlas' }, capabilities: ['view', 'review'] }],
    },
  ];

  const brands = [
    { id: 'pine', name: 'Pine & Paper' },
    { id: 'atlas', name: 'Little Atlas' },
  ];

  const account = (id: string, brandId: string, platform: Account['platform'], handle: string, displayName: string, kind: Account['kind'], purpose: string, usedToday = false): Account => ({
    id,
    brandId,
    platform,
    handle,
    displayName,
    kind,
    analyticsNote: 'Sample account: not connected to the platform.',
    usedToday,
    purpose,
  });

  const accounts: Account[] = [
    account('yt-pine', 'pine', 'youtube', '@pinepaper.sample', 'Pine & Paper', 'Channel', 'Study routines and calm desks.', true),
    account('ig-pine', 'pine', 'instagram', '@pinepaper.sample', 'Pine & Paper', 'Creator', 'Desk photos and short routines.', true),
    account('tt-pine', 'pine', 'tiktok', '@pinepaper.sample', 'Pine & Paper', 'Creator', 'Short study clips.'),
    account('yt-atlas', 'atlas', 'youtube', '@littleatlas.sample', 'Little Atlas', 'Channel', 'Travel phrase guides.', true),
    account('ig-atlas', 'atlas', 'instagram', '@littleatlas.sample', 'Little Atlas', 'Creator', 'Phrase cards and travel photos.', true),
  ];

  // Sample audience series. Invented figures for the preview.
  const series = (accountId: string, metric: AudienceSeries['metric'], endCount: number, dailyGrowth: number, latestAgeHours: number, plannedUpdate: 'platform-api' | 'manual', seed: number, staleAfterHours = 48): AudienceSeries => ({
    accountId,
    metric,
    source: { kind: 'sample', plannedUpdate },
    staleAfterHours,
    snapshots: sampleSnapshots({ now: t, latestAgeHours, endCount, dailyGrowth, seed }),
  });
  const audience: AudienceSeries[] = [
    series('yt-pine', 'subscribers', 24_800, 42, 3, 'platform-api', 11),
    series('ig-pine', 'followers', 18_300, 25, 5, 'platform-api', 23),
    series('tt-pine', 'followers', 41_200, -15, 2, 'platform-api', 37),
    series('yt-atlas', 'subscribers', 9_650, 18, 6, 'platform-api', 53),
    series('ig-atlas', 'followers', 6_120, 9, 24 * 9, 'manual', 67, 24 * 7),
  ];

  const campaigns: Campaign[] = [
    { id: 'routines', name: 'Study routines', kind: 'Series', hue: 262, start: d(-10), end: d(25), summary: 'Sample series: calm routines for busy weeks.' },
    { id: 'phrase-guides', name: 'Phrase guides', kind: 'Series', hue: 175, start: d(-20), end: d(40), summary: 'Sample series: short, useful travel phrases.' },
  ];

  const idea = (partial: Partial<Idea> & Pick<Idea, 'id' | 'title' | 'status' | 'due' | 'art' | 'concept' | 'spaceId'>): Idea => ({
    script: '',
    shotList: [],
    references: [],
    peopleIds: ['me'],
    updatedAt: today,
    archived: false,
    ...partial,
  });

  const ideas: Idea[] = [
    idea({
      id: HERO_IDEA_ID,
      title: 'Five phrases for a night market',
      campaignId: 'phrase-guides',
      spaceId: 'atlas',
      series: 'Phrase guides',
      status: 'Editing',
      due: d(2),
      art: { motif: 'city', hue: 18, hue2: 175, image: '/demo-media/market-vertical.jpg' },
      concept: 'A walk through a lantern-lit market with five phrases on screen, each said slowly and then at speed. One vertical edit serves every short-form account.',
      script: 'OPEN: Market noise, lanterns.\nPHRASE 1: “One of these, please.”\nPHRASE 2: “Not too spicy.”\nPHRASE 3: “How much is it?”\nPHRASE 4: “To go, please.”\nPHRASE 5: “That was delicious!”',
      shotList: [
        { id: 's1', label: 'Lantern wide, locked off', done: true },
        { id: 's2', label: 'Each phrase to camera, two speeds', done: true },
        { id: 's3', label: 'Vertical safe-frame pass', done: false },
      ],
      peopleIds: ['me', 'jonah'],
    }),
    idea({
      id: 'morning-routine',
      title: 'A quiet morning at the desk',
      campaignId: 'routines',
      spaceId: 'pine',
      series: 'Study routines',
      status: 'In review',
      due: d(1),
      art: { motif: 'sunrise', hue: 28, hue2: 250, image: '/demo-media/morning-vertical.jpg' },
      concept: 'The first quiet hour: window light, tea, three priorities. A long cut for YouTube and a vertical cut for short-form.',
      shotList: [
        { id: 's1', label: 'Window light, locked off', done: true },
        { id: 's2', label: 'Planner close-up', done: false },
      ],
      peopleIds: ['me', 'jonah', 'priya'],
    }),
    idea({
      id: 'desk-setup',
      title: 'Three small desk changes',
      campaignId: 'routines',
      spaceId: 'pine',
      status: 'Ready',
      due: d(0),
      art: { motif: 'studio', hue: 205, hue2: 262, image: '/demo-media/desk-notebook.jpg' },
      concept: 'A three-photo carousel with one tip per slide.',
      peopleIds: ['me', 'priya'],
      updatedAt: d(-1),
    }),
    idea({
      id: 'reading-list',
      title: 'Books on focus',
      spaceId: 'pine',
      status: 'Idea',
      due: d(16),
      art: { motif: 'horizon', hue: 32, hue2: 14 },
      concept: 'Five books, one idea from each.',
      updatedAt: d(-4),
    }),
    idea({
      id: 'study-spots',
      title: 'Four quiet places to work',
      spaceId: 'pine',
      series: 'Study routines',
      status: 'Posted',
      due: d(-6),
      art: { motif: 'rings', hue: 250, hue2: 200, image: '/demo-media/quiet-places-vertical.jpg' },
      concept: 'Four quiet places, one clip each.',
      updatedAt: d(-6),
      learningNotes: 'Sample note: the quietest spot got the most saves.',
    }),
    idea({
      id: 'cafe-words',
      title: 'Café words to know',
      campaignId: 'phrase-guides',
      spaceId: 'atlas',
      status: 'Posted',
      due: d(-3),
      art: { motif: 'bloom', hue: 120, hue2: 40, image: '/demo-media/cafe-cup.jpg' },
      concept: 'Two photo slides of café vocabulary.',
      updatedAt: d(-3),
    }),
    idea({
      id: 'packing-list',
      title: 'Carry-on packing list',
      spaceId: 'atlas',
      status: 'Posted',
      due: yearAgo,
      art: { motif: 'grain', hue: 30, hue2: 330, image: '/demo-media/packing.jpg' },
      concept: 'Archived sample idea: one photo of everything that fits in a carry-on, posted a year ago.',
      updatedAt: yearAgo,
      archived: true,
    }),
    // Earlier published work, archived after posting. It still belongs to the creator's history.
    idea({
      id: 'evening-desk',
      title: 'One lamp, three evenings',
      campaignId: 'routines',
      spaceId: 'pine',
      status: 'Posted',
      due: d(-20),
      art: { motif: 'studio', hue: 220, hue2: 30, image: '/demo-media/desk-lamp.jpg' },
      concept: 'Archived sample: an evening desk set-up, posted as a carousel and a Short.',
      updatedAt: d(-20),
      archived: true,
    }),
    idea({
      id: 'counter-phrases',
      title: 'Ordering at the counter',
      campaignId: 'phrase-guides',
      spaceId: 'atlas',
      status: 'Posted',
      due: d(-20),
      art: { motif: 'bloom', hue: 30, hue2: 20, image: '/demo-media/cafe-table.jpg' },
      concept: 'Archived sample: one photo post with three counter phrases.',
      updatedAt: d(-20),
      archived: true,
    }),
    idea({
      id: 'first-morning',
      title: 'My first slow morning',
      campaignId: 'routines',
      spaceId: 'pine',
      status: 'Posted',
      due: d(-75),
      art: { motif: 'sunrise', hue: 30, hue2: 240, image: '/demo-media/morning-wide.jpg' },
      concept: 'Archived sample: the first long video in the series.',
      updatedAt: d(-75),
      archived: true,
    }),
  ];

  const base = { favorite: false, storage: 'original' as const, platforms: [] as Asset['platforms'], moments: [] as Asset['moments'], tags: [] as string[] };
  const finished = (id: string, name: string, file: string, ideaIds: string[], hue: number, hue2: number, sizeMB: number): Asset => ({
    ...base,
    id,
    name,
    kind: 'final',
    ideaIds,
    inLibrary: false,
    sizeMB,
    durationSec: 6,
    art: { motif: 'sunrise', hue, hue2, image: `/demo-media/${file.replace('.webm', '.jpg')}` },
    uploadedById: 'jonah',
    uploadedAt: d(-1),
    tags: ['finished', 'sample'],
    videoUrl: `/demo-media/${file}`,
    mediaSource: 'bundled-sample',
  });
  const photo = (id: string, name: string, ideaId: string, motif: Asset['art']['motif'], hue: number, image: string): Asset => ({
    ...base,
    id,
    name,
    kind: 'photo',
    ideaIds: [ideaId],
    inLibrary: false,
    sizeMB: 8,
    art: { motif, hue, hue2: (hue + 50) % 360, image: `/demo-media/${image}` },
    uploadedById: 'priya',
    uploadedAt: d(-2),
    tags: ['sample photo'],
    platforms: ['instagram'],
  });

  const assets: Asset[] = [
    finished('a-market-vertical', 'Night market phrases — vertical.webm', 'market-vertical.webm', [HERO_IDEA_ID], 18, 175, 380),
    finished('a-morning-vertical', 'Quiet morning — vertical.webm', 'morning-vertical.webm', ['morning-routine'], 28, 250, 290),
    finished('a-morning-wide', 'Quiet morning — long cut.webm', 'morning-wide.webm', ['morning-routine'], 30, 230, 2100),
    finished('a-spots-vertical', 'Quiet places — Short.webm', 'quiet-places-vertical.webm', ['study-spots'], 250, 200, 260),
    {
      ...base,
      id: 'a-market-raw',
      name: 'Market walk — raw.mov',
      kind: 'raw',
      ideaIds: [HERO_IDEA_ID],
      inLibrary: true,
      sizeMB: 9200,
      durationSec: 412,
      art: { motif: 'city', hue: 20, hue2: 180, image: '/demo-media/market-wide.jpg' },
      favorite: true,
      storage: 'original+proxy',
      uploadedById: 'me',
      uploadedAt: d(-3),
      tags: ['market', 'b-roll'],
      campaignId: 'phrase-guides',
      moments: [{ id: 'm1', t: 42, label: 'Lanterns come on' }],
    },
    {
      ...base,
      id: 'a-market-raw-copy',
      name: 'Market walk — raw (1).mov',
      kind: 'raw',
      ideaIds: [HERO_IDEA_ID],
      inLibrary: false,
      sizeMB: 9200,
      durationSec: 412,
      art: { motif: 'city', hue: 20, hue2: 180, image: '/demo-media/market-wide.jpg' },
      uploadedById: 'jonah',
      uploadedAt: d(-2),
      duplicateOfId: 'a-market-raw',
    },
    {
      ...base,
      id: 'a-music',
      name: 'Soft focus — instrumental.wav',
      kind: 'audio',
      ideaIds: ['morning-routine'],
      inLibrary: true,
      sizeMB: 48,
      durationSec: 146,
      art: { motif: 'horizon', hue: 265, hue2: 200 },
      uploadedById: 'jonah',
      uploadedAt: d(-12),
      tags: ['music', 'calm'],
      platforms: ['youtube', 'instagram', 'tiktok'],
      musicRights: { source: 'Example music library (placeholder)', license: 'Sample licence note', notes: 'Not cleared for paid ads (sample).' },
    },
    {
      ...base,
      id: 'a-desk-raw',
      name: 'Desk timelapse — raw.mov',
      kind: 'raw',
      ideaIds: ['morning-routine'],
      inLibrary: true,
      sizeMB: 5400,
      durationSec: 240,
      art: { motif: 'sunrise', hue: 30, hue2: 240, image: '/demo-media/morning-wide.jpg' },
      storage: 'original+proxy',
      uploadedById: 'me',
      uploadedAt: d(-4),
      tags: ['timelapse', 'desk'],
      campaignId: 'routines',
      moments: [{ id: 'm1', t: 88, label: 'Sun reaches the planner' }],
    },
    photo('a-desk-1', 'Desk — slide 1.jpg', 'desk-setup', 'studio', 205, 'desk-notebook.jpg'),
    photo('a-desk-2', 'Desk — slide 2.jpg', 'desk-setup', 'grain', 225, 'desk-lamp.jpg'),
    photo('a-desk-3', 'Desk — slide 3.jpg', 'desk-setup', 'bloom', 245, 'desk-plant.jpg'),
    photo('a-cafe-1', 'Café words — slide 1.jpg', 'cafe-words', 'bloom', 110, 'cafe-cup.jpg'),
    photo('a-cafe-2', 'Café words — slide 2.jpg', 'cafe-words', 'waves', 90, 'cafe-table.jpg'),
    { ...photo('a-packing-1', 'Carry-on — flat lay.jpg', 'packing-list', 'grain', 200, 'packing.jpg'), uploadedAt: yearAgo },
    photo('a-evening-1', 'Evening desk — slide 1.jpg', 'evening-desk', 'studio', 220, 'desk-lamp.jpg'),
    photo('a-evening-2', 'Evening desk — slide 2.jpg', 'evening-desk', 'studio', 160, 'desk-plant.jpg'),
    photo('a-counter-1', 'Counter phrases.jpg', 'counter-phrases', 'bloom', 30, 'cafe-table.jpg'),
    finished('a-evening-short', 'Evening desk — Short.webm', 'morning-vertical.webm', ['evening-desk'], 220, 30, 240),
    finished('a-first-wide', 'First slow morning — long cut.webm', 'morning-wide.webm', ['first-morning'], 30, 240, 1900),
    {
      ...base,
      id: 'a-brand-kit',
      name: 'Sample brand kit.pdf',
      kind: 'document',
      ideaIds: [],
      inLibrary: true,
      spaceId: 'pine',
      sizeMB: 3,
      art: { motif: 'grain', hue: 262, hue2: 40 },
      uploadedById: 'priya',
      uploadedAt: d(-60),
      tags: ['brand kit'],
    },
    {
      ...base,
      id: 'a-hooks',
      name: 'Hook & CTA bank.md',
      kind: 'document',
      ideaIds: [],
      inLibrary: true,
      sizeMB: 1,
      art: { motif: 'horizon', hue: 262, hue2: 200 },
      uploadedById: 'me',
      uploadedAt: d(-20),
      tags: ['brand kit', 'hooks'],
    },
  ];

  const v = (partial: Omit<Version, 'tags' | 'links' | 'onScreenText' | 'checklist'> & Partial<Pick<Version, 'tags' | 'links' | 'onScreenText'>> & { done?: number }): Version => {
    const { done = 0, ...rest } = partial;
    return { tags: [], links: [], onScreenText: [], ...rest, checklist: checklist(READY_CHECKS, done) };
  };

  const versions: Version[] = [
    v({
      id: 'v-tt-pine',
      ideaId: HERO_IDEA_ID,
      accountId: 'tt-pine',
      format: 'Clip',
      aspect: '9:16',
      mediaAssetId: 'a-market-vertical',
      coverAssetId: 'a-market-raw',
      captions: { en: 'five phrases for your next night market', es: 'cinco frases para el mercado nocturno' },
      tags: ['#travelphrases'],
      onScreenText: [{ id: 'o1', t: 0, text: '5 night-market phrases' }],
      scheduledFor: d(2),
      status: 'Ready to post',
      done: 6,
    }),
    v({
      id: 'v-ig-atlas',
      ideaId: HERO_IDEA_ID,
      accountId: 'ig-atlas',
      format: 'Reel',
      aspect: '9:16',
      mediaAssetId: 'a-market-vertical',
      captions: { en: 'Save this before your next trip. Five phrases, two speeds.' },
      tags: ['#travelphrases'],
      scheduledFor: d(2),
      status: 'In review',
      done: 4,
    }),
    v({
      id: 'v-yt-atlas-short',
      ideaId: HERO_IDEA_ID,
      accountId: 'yt-atlas',
      format: 'Short',
      aspect: '9:16',
      mediaAssetId: 'a-market-vertical',
      title: 'Five night-market phrases',
      captions: { en: 'Five phrases for night markets.' },
      scheduledFor: d(3),
      status: 'Editing',
      done: 2,
    }),
    v({
      id: 'v-ig-pine-cross',
      ideaId: HERO_IDEA_ID,
      accountId: 'ig-pine',
      format: 'Reel',
      aspect: '9:16',
      mediaAssetId: 'a-market-vertical',
      captions: { en: 'New from our sister series: five market phrases.' },
      scheduledFor: d(4),
      status: 'Planned',
      done: 1,
    }),
    v({
      id: 'v-yt-pine',
      ideaId: 'morning-routine',
      accountId: 'yt-pine',
      format: 'Video',
      aspect: '16:9',
      mediaAssetId: 'a-morning-wide',
      title: 'A Quiet Morning at the Desk',
      captions: { en: 'A calm first hour.\n\n00:00 Window light\n01:10 Tea and planning' },
      scheduledFor: d(5),
      status: 'In review',
      done: 3,
    }),
    v({
      id: 'v-ig-pine',
      ideaId: 'morning-routine',
      accountId: 'ig-pine',
      format: 'Reel',
      aspect: '9:16',
      mediaAssetId: 'a-morning-vertical',
      captions: { en: 'Before the day gets loud.' },
      scheduledFor: d(1),
      status: 'Editing',
      done: 2,
    }),
    v({
      id: 'v-ig-pine-desk',
      ideaId: 'desk-setup',
      accountId: 'ig-pine',
      format: 'Carousel',
      aspect: '4:5',
      coverAssetId: 'a-desk-1',
      photoAssetIds: ['a-desk-1', 'a-desk-2', 'a-desk-3'],
      captions: { en: 'Three small desk changes. Swipe →' },
      scheduledFor: d(0),
      status: 'Ready to post',
      done: 6,
    }),
    v({ id: 'v-yt-pine-books', ideaId: 'reading-list', accountId: 'yt-pine', format: 'Video', aspect: '16:9', captions: { en: '' }, scheduledFor: d(18), status: 'Planned' }),
    v({ id: 'v-tt-pine-books', ideaId: 'reading-list', accountId: 'tt-pine', format: 'Clip', aspect: '9:16', captions: { en: '' }, scheduledFor: d(18), status: 'Planned' }),
    v({
      id: 'v-yt-pine-spots',
      ideaId: 'study-spots',
      accountId: 'yt-pine',
      format: 'Short',
      aspect: '9:16',
      mediaAssetId: 'a-spots-vertical',
      captions: { en: 'Four quiet places to work.' },
      scheduledFor: d(-6),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-short',
      postedAt: at(d(-6), '17:05'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-ig-atlas-cafe',
      ideaId: 'cafe-words',
      accountId: 'ig-atlas',
      format: 'Carousel',
      aspect: '4:5',
      coverAssetId: 'a-cafe-1',
      photoAssetIds: ['a-cafe-1', 'a-cafe-2'],
      captions: { en: 'Café words to know.' },
      scheduledFor: d(-3),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-carousel',
      postedAt: at(d(-3), '09:20'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-ig-atlas-packing',
      ideaId: 'packing-list',
      accountId: 'ig-atlas',
      format: 'Post',
      aspect: '4:5',
      coverAssetId: 'a-packing-1',
      photoAssetIds: ['a-packing-1'],
      captions: { en: 'Everything in one carry-on. Sample post from a year ago.' },
      scheduledFor: yearAgo,
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-packing',
      postedAt: at(yearAgo, '10:00'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-ig-pine-spots',
      ideaId: 'study-spots',
      accountId: 'ig-pine',
      format: 'Reel',
      aspect: '9:16',
      mediaAssetId: 'a-spots-vertical',
      captions: { en: 'Four quiet places to work. Which one is yours?' },
      scheduledFor: d(-6),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-reel',
      postedAt: at(d(-6), '18:30'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-ig-pine-evening',
      ideaId: 'evening-desk',
      accountId: 'ig-pine',
      format: 'Carousel',
      aspect: '4:5',
      coverAssetId: 'a-evening-1',
      photoAssetIds: ['a-evening-1', 'a-evening-2'],
      captions: { en: 'One lamp, three evenings. Swipe for the plant corner.' },
      scheduledFor: d(-20),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-evening',
      postedAt: at(d(-20), '19:30'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-yt-pine-evening',
      ideaId: 'evening-desk',
      accountId: 'yt-pine',
      format: 'Short',
      aspect: '9:16',
      mediaAssetId: 'a-evening-short',
      captions: { en: 'The evening desk in thirty seconds.' },
      scheduledFor: d(-20),
      status: 'Posted',
      // Late at night: already the next day in UTC, still this day for the workspace.
      postedAt: at(d(-20), '23:40'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-ig-atlas-counter',
      ideaId: 'counter-phrases',
      accountId: 'ig-atlas',
      format: 'Post',
      aspect: '4:5',
      coverAssetId: 'a-counter-1',
      photoAssetIds: ['a-counter-1'],
      captions: { en: 'Three phrases for the counter. Save it for your next trip.' },
      scheduledFor: d(-20),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-counter',
      postedAt: at(d(-20), '12:15'),
      postSource: 'manual',
      done: 6,
    }),
    v({
      id: 'v-yt-pine-first',
      ideaId: 'first-morning',
      accountId: 'yt-pine',
      format: 'Video',
      aspect: '16:9',
      mediaAssetId: 'a-first-wide',
      captions: { en: 'My first slow morning, the long version.' },
      scheduledFor: d(-75),
      status: 'Posted',
      liveUrl: 'https://example.com/sample-posted-first',
      postedAt: at(d(-75), '08:05'),
      postSource: 'manual',
      done: 6,
    }),
  ];

  const tasks: Task[] = [
    { id: 't1', title: 'Approve the market Reel cover', ideaId: HERO_IDEA_ID, versionId: 'v-ig-atlas', ownerId: 'me', due: d(0), stage: 'Review', done: false },
    { id: 't2', title: 'Record phrase 5 again, slower', ideaId: HERO_IDEA_ID, ownerId: 'me', due: d(0), stage: 'Shoot', done: false },
    { id: 't3', title: 'Add captions to the Short', ideaId: HERO_IDEA_ID, versionId: 'v-yt-atlas-short', ownerId: 'jonah', due: d(1), stage: 'Edit', done: false },
    { id: 't4', title: 'Post the desk carousel', ideaId: 'desk-setup', versionId: 'v-ig-pine-desk', ownerId: 'me', due: d(0), stage: 'Post', done: false },
    { id: 't5', title: 'Trim long cut to under 8 minutes', ideaId: 'morning-routine', versionId: 'v-yt-pine', ownerId: 'jonah', due: d(1), stage: 'Edit', done: false },
    { id: 't6', title: 'Pick five books', ideaId: 'reading-list', ownerId: 'me', due: d(8), stage: 'Plan', done: false },
    { id: 't7', title: 'Write the Spanish caption', ideaId: HERO_IDEA_ID, versionId: 'v-tt-pine', ownerId: 'priya', due: d(2), stage: 'Post', done: true },
    { id: 't8', title: 'Tighten the TikTok hook to two seconds', ideaId: HERO_IDEA_ID, versionId: 'v-tt-pine', ownerId: 'sam', due: d(1), stage: 'Edit', done: false },
  ];

  const links: LinkItem[] = [
    { id: 'l-live-spots', category: 'published', label: 'Four quiet places: YouTube Short (sample link)', url: 'https://example.com/sample-posted-short', accountId: 'yt-pine', ideaId: 'study-spots' },
    { id: 'l-live-cafe', category: 'published', label: 'Café words: carousel (sample link)', url: 'https://example.com/sample-posted-carousel', accountId: 'ig-atlas', ideaId: 'cafe-words' },
    { id: 'l-brandkit', category: 'brand', label: 'Sample brand kit', url: 'https://example.com/brand-kit-sample' },
  ];

  const marketing: MarketingEvent[] = [
    { id: 'mk1', title: 'Phrase guides: new episode', date: d(3), campaignId: 'phrase-guides', kind: 'Launch' },
    { id: 'mk2', title: 'Sample newsletter', date: d(5), campaignId: 'routines', kind: 'Email' },
  ];

  const notifications: Notification[] = [
    { id: 'n1', text: 'Jonah uploaded “Night market phrases — vertical”', when: '12 min ago', href: `/ideas/${HERO_IDEA_ID}/assets`, unread: true },
    { id: 'n2', text: 'Possible duplicate: “Market walk — raw (1).mov”', when: '1 h ago', href: `/ideas/${HERO_IDEA_ID}/assets`, unread: true },
  ];

  return {
    today,
    generatedAt: now.toISOString(),
    workspace: { id: 'preview', name: 'Haven Preview', planLabel: 'Workspace', timeZone: TIME_ZONE, storageLimitGB: 1024, otherStorageGB: 240 },
    currentUserId: 'me',
    brands,
    audience,
    people,
    members,
    platforms: PLATFORMS,
    accounts,
    campaigns,
    ideas,
    assets,
    versions,
    tasks,
    links,
    marketing,
    notifications,
  };
}
