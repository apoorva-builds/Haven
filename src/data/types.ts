/**
 * Domain types for the Haven demo workspace.
 *
 * These mirror the product brief closely so that Milestone 2 can swap the
 * in-memory demo module for a real persistence layer without reshaping the UI.
 */

export type ISODate = string; // YYYY-MM-DD, local calendar day

export type PlatformId =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'linkedin'
  | 'snapchat'
  | 'x'
  | 'threads'
  | 'pinterest'
  | 'facebook'
  | 'bluesky'
  | 'podcast'
  | 'newsletter';

export interface Platform {
  id: PlatformId;
  name: string;
  /** Short mark used in badges. */
  glyph: string;
  /** Hue used for the calendar legend and badges; tuned per theme in CSS. */
  hue: number;
  /** Listed as a core platform in the brief, or as a "space for" future channel. */
  tier: 'core' | 'more';
}

export interface Person {
  id: string;
  name: string;
  role: string;
  hue: number;
  /** External reviewers only see scoped review links (Milestone 3). */
  external?: boolean;
}

export type AccountKind = 'Personal' | 'Business' | 'Creator' | 'Brand' | 'Channel';

/** A creator brand that owns one or more accounts, e.g. a main channel and a spin-off series. */
export interface Brand {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  brandId: string;
  platform: PlatformId;
  handle: string;
  displayName: string;
  kind: AccountKind;
  /** External profile page. Haven stores the link only. Sample accounts have none. */
  profileUrl?: string;
  /** Native analytics page on the platform. Haven never imports analytics. */
  analyticsUrl?: string;
  analyticsNote?: string;
  usedToday: boolean;
  purpose: string;
}

export type CampaignKind = 'Launch' | 'Series' | 'Sponsorship' | 'Event';

export interface Campaign {
  id: string;
  name: string;
  kind: CampaignKind;
  hue: number;
  start: ISODate;
  end: ISODate;
  summary: string;
}

/** Generated cover art so the demo ships with rich imagery but no real media. */
export type ArtMotif = 'sunrise' | 'waves' | 'studio' | 'rings' | 'bloom' | 'city' | 'horizon' | 'grain';

export interface Art {
  motif: ArtMotif;
  hue: number;
  hue2: number;
  /** A bundled sample still (public/demo-media). Covers use it in place of generated art. */
  image?: string;
}

export type IdeaStatus = 'Idea' | 'Gathering' | 'Editing' | 'In review' | 'Ready' | 'Posted';

export const IDEA_STATUSES: IdeaStatus[] = ['Idea', 'Gathering', 'Editing', 'In review', 'Ready', 'Posted'];

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Reference {
  id: string;
  label: string;
  url: string;
}

export interface Idea {
  id: string;
  title: string;
  campaignId?: string;
  series?: string;
  status: IdeaStatus;
  due: ISODate;
  art: Art;
  concept: string;
  script: string;
  shotList: ChecklistItem[];
  references: Reference[];
  peopleIds: string[];
  updatedAt: ISODate;
  archived: boolean;
  learningNotes?: string;
}

export type AssetKind = 'final' | 'raw' | 'cutaway' | 'photo' | 'audio' | 'cover' | 'document';

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  final: 'Finished video',
  raw: 'Raw video',
  cutaway: 'Cutaway',
  photo: 'Photo',
  audio: 'Audio & music',
  cover: 'Cover',
  document: 'File',
};

export interface Moment {
  id: string;
  /** Seconds from the start of the clip. */
  t: number;
  label: string;
}

export interface MusicRights {
  source: string;
  license: string;
  notes: string;
}

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** Idea this asset was gathered for, if any. Library assets may be shared. */
  ideaIds: string[];
  /**
   * In the Raw Library of reusable source material. Finished videos
   * (kind 'final') never are: they belong to the Creation Gallery via the
   * versions that use them.
   */
  inLibrary: boolean;
  sizeMB: number;
  durationSec?: number;
  art: Art;
  favorite: boolean;
  storage: 'original' | 'original+proxy' | 'proxy-only';
  uploadedById: string;
  uploadedAt: ISODate;
  tags: string[];
  campaignId?: string;
  platforms: PlatformId[];
  musicRights?: MusicRights;
  duplicateOfId?: string;
  moments: Moment[];
  /** Created during this browser session only. Never persisted. */
  sessionOnly?: boolean;
  /**
   * Playable video in this prototype. Either a small sample bundled with the
   * app, or a browser-local object URL for a file chosen on this device.
   */
  videoUrl?: string;
  mediaSource?: VideoSource;
}

/**
 * Where a playable video comes from in the demo. Neither is online storage:
 * bundled samples ship with the prototype; device files stay in this tab.
 */
export type VideoSource = 'bundled-sample' | 'device-session';

export type VersionStatus = 'Planned' | 'Editing' | 'In review' | 'Ready to post' | 'Posted';

export const VERSION_STATUSES: VersionStatus[] = ['Planned', 'Editing', 'In review', 'Ready to post', 'Posted'];

export type VersionFormat = 'Reel' | 'Carousel' | 'Story' | 'Short' | 'Video' | 'Post' | 'Clip' | 'Issue';

export type Aspect = '9:16' | '4:5' | '1:1' | '16:9';

export interface OnScreenText {
  id: string;
  /** Seconds from start. */
  t: number;
  text: string;
}

export interface Version {
  id: string;
  ideaId: string;
  accountId: string;
  format: VersionFormat;
  aspect: Aspect;
  /** Finished video for this account's version (a shared asset, never a copy). */
  mediaAssetId?: string;
  coverAssetId?: string;
  /** Photos for carousel/photo posts, in order. */
  photoAssetIds?: string[];
  title?: string;
  /** Captions keyed by language code; entered by the user, never machine-generated here. */
  captions: Record<string, string>;
  tags: string[];
  links: string[];
  onScreenText: OnScreenText[];
  scheduledFor: ISODate;
  status: VersionStatus;
  checklist: ChecklistItem[];
  /** Filled in by the creator after posting natively. */
  liveUrl?: string;
}

export type TaskStage = 'Plan' | 'Shoot' | 'Edit' | 'Review' | 'Post';

export interface Task {
  id: string;
  title: string;
  ideaId?: string;
  versionId?: string;
  ownerId: string;
  due: ISODate;
  stage: TaskStage;
  done: boolean;
  recurring?: string;
}

export type LinkCategory = 'account' | 'analytics' | 'published' | 'affiliate' | 'brand';

export const LINK_CATEGORY_LABEL: Record<LinkCategory, string> = {
  account: 'Account pages',
  analytics: 'Native analytics',
  published: 'Published posts',
  affiliate: 'Affiliate & campaign',
  brand: 'Brand resources',
};

export interface LinkItem {
  id: string;
  category: LinkCategory;
  label: string;
  url: string;
  note?: string;
  accountId?: string;
  campaignId?: string;
  ideaId?: string;
}

export interface MarketingEvent {
  id: string;
  title: string;
  date: ISODate;
  campaignId?: string;
  kind: 'Launch' | 'Deadline' | 'Email' | 'Event';
}

export interface Notification {
  id: string;
  text: string;
  when: string;
  href?: string;
  unread: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  planLabel: string;
  storageLimitGB: number;
  /** Demo baseline for media not modelled as individual assets. */
  otherStorageGB: number;
}

/**
 * Where an audience count came from. Real accounts will refresh on a schedule
 * from an authorized platform API, or take manual snapshots when they can't
 * connect. The demo ships sample snapshots only.
 */
export type AudienceSource =
  | { kind: 'sample'; plannedUpdate: 'platform-api' | 'manual' }
  | { kind: 'platform-api'; provider: PlatformId; refreshEveryHours: number }
  | { kind: 'manual'; enteredBy: string };

export interface AudienceSnapshot {
  /** ISO 8601 timestamp of when the count was observed. */
  at: string;
  count: number;
}

export interface AudienceSeries {
  accountId: string;
  metric: 'followers' | 'subscribers';
  source: AudienceSource;
  /** Oldest first. */
  snapshots: AudienceSnapshot[];
  /** After this long without a new snapshot, the count is shown as out of date, never as current. */
  staleAfterHours: number;
}

export interface DemoData {
  today: ISODate;
  /** When the demo data was generated; the reference "now" for sample snapshots. */
  generatedAt: string;
  brands: Brand[];
  audience: AudienceSeries[];
  workspace: Workspace;
  currentUserId: string;
  people: Person[];
  platforms: Platform[];
  accounts: Account[];
  campaigns: Campaign[];
  ideas: Idea[];
  assets: Asset[];
  versions: Version[];
  tasks: Task[];
  links: LinkItem[];
  marketing: MarketingEvent[];
  notifications: Notification[];
}
