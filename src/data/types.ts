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

/**
 * A Space organises work inside the workspace, usually one brand or show
 * with its own social accounts (e.g. "Pine & Paper"). Access is granted per
 * Space or per account.
 */
export interface Brand {
  id: string;
  name: string;
}

/** Owner and admins have full access; collaborators see only what they're granted. */
export type WorkspaceRole = 'owner' | 'admin' | 'collaborator';

/**
 * What a collaborator may do with a Space or account.
 * view: open the work and its files · edit: change it and upload files ·
 * review: approve versions (Ready to post) · publish: record a post as live.
 * Publishing stays manual until a supported platform connection exists.
 */
export type Capability = 'view' | 'edit' | 'review' | 'publish';

export const CAPABILITIES: Capability[] = ['view', 'edit', 'review', 'publish'];

/** Access to a whole Space (all its accounts and Space-level work) or one social account. */
export type AccessScope = { kind: 'space'; id: string } | { kind: 'account'; id: string };

export interface AccessGrant {
  scope: AccessScope;
  capabilities: Capability[];
}

/**
 * A person in the workspace. Each signs in to Haven as themselves; nobody
 * shares or stores social account passwords (none are ever requested).
 */
export interface Member {
  personId: string;
  /** Sample addresses on example.com in the preview. */
  email: string;
  role: WorkspaceRole;
  status: 'active' | 'invited';
  /** Only used for collaborators; owner and admins have full access. */
  grants: AccessGrant[];
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
  /** The Space this idea belongs to. Its versions may also target other Spaces' accounts. */
  spaceId: string;
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
  /** Planning fields for a video; everything except the title is optional. */
  plan?: VideoPlan;
}

export interface PlannedSection {
  id: string;
  title: string;
  /** Rough target length in seconds, if known. */
  targetSec?: number;
}

export interface VideoPlan {
  audience?: string;
  hook?: string;
  /** One line per beat. */
  outline: string[];
  sections: PlannedSection[];
}

/*
 * Video Studio. A VideoProject is one video being made for an idea (e.g. the
 * vertical edit, or the long YouTube cut). It keeps every cut together, from
 * original footage to the final cut, and links to the account versions
 * (creations) that will post it. Notes belong to one exact cut.
 */
export type CutKind = 'footage' | 'draft' | 'final';

export interface Cut {
  id: string;
  projectId: string;
  /** "Original footage", "Draft 1", "Final cut"… editable. */
  label: string;
  kind: CutKind;
  assetId: string;
  addedAt: string;
  addedById: string;
  /** Archived cuts stay in history and still use storage. */
  archived?: boolean;
}

export interface Chapter {
  id: string;
  cutId: string;
  title: string;
  startSec: number;
}

export interface TimeNote {
  id: string;
  cutId: string;
  /** Section name, e.g. "Opening". */
  section?: string;
  startSec: number;
  /** A range when set; a single moment otherwise. */
  endSec?: number;
  text: string;
  resolved: boolean;
  authorId: string;
  createdAt: string;
  /** Carried forward deliberately from a note on an earlier cut. */
  carriedFrom?: string;
}

export interface VideoProject {
  id: string;
  ideaId: string;
  title: string;
  aspect: Aspect;
  /** The account versions (creations) that will post this video. */
  versionIds: string[];
  currentCutId?: string;
  approvedCutId?: string;
}

export type AssetKind = 'final' | 'draft' | 'raw' | 'cutaway' | 'photo' | 'audio' | 'cover' | 'document';

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  final: 'Finished video',
  draft: 'Draft cut',
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
  /** For library files not tied to an idea: the Space they belong to. None means workspace-wide (owner and admins). */
  spaceId?: string;
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
  /**
   * Content fingerprint. Two references to the same fingerprint are one file
   * and count once towards storage.
   */
  fingerprint?: string;
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
  /** When it went live (UTC ISO). Its calendar day is taken in the workspace time zone. */
  postedAt?: string;
  /**
   * Where the posted record came from. "manual": recorded in Haven (Mark as
   * posted). "connected": imported from a connected account where the platform
   * supports it (none in the preview).
   */
  postSource?: 'manual' | 'connected';
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
  /** IANA time zone for calendar days, e.g. "America/Los_Angeles". */
  timeZone: string;
  storageLimitGB: number;
  /** Extra storage added in this preview session (no charge; resets on reload). */
  addedStorageGB?: number;
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
  members: Member[];
  platforms: Platform[];
  accounts: Account[];
  campaigns: Campaign[];
  ideas: Idea[];
  assets: Asset[];
  versions: Version[];
  tasks: Task[];
  links: LinkItem[];
  projects: VideoProject[];
  cuts: Cut[];
  chapters: Chapter[];
  notes: TimeNote[];
  marketing: MarketingEvent[];
  notifications: Notification[];
}
