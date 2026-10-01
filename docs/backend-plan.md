# Haven backend plan: sign-in, access, activity, media, connections

Status: in progress. Supabase is the chosen backend. Sign-in and the workspace data model come first, then server-enforced permissions with tests, before any real invitations. The Milestone 1 preview (Team & access, *preview as*) only filters one browser tab and is not security. This plan makes the same rules real on the server.

## Principles

- **One workspace per customer.** Spaces (usually a brand or show) and social accounts organise the work inside it.
- **Every person signs in to Haven as themselves.** Nobody shares a login or signs in to social accounts to plan, edit or review.
- **No social passwords, ever.** Haven never requests, stores, reveals or distributes them. A handle identifies an account; it is not a credential. Platform actions use official connections (OAuth) with the permissions the account owner granted.
- **The server decides.** The database and API enforce access. The UI only reflects it. Every read and write passes the same checks, including files and linked records reached by URL or reference.
- **Work activity, not surveillance.** Admins see what happened to the work in Haven, and nothing about anyone's personal accounts, messages or browsing.

## Recommended stack

- **Database:** managed Postgres with row-level security (RLS).
- **Auth:** email magic link, optional Google sign-in, passkeys later.
- **Storage:** private object storage with signed URLs.
- **Server functions:** for invitations, uploads and platform connections.
- **Suggested platform:** Supabase provides all of the above; any equivalent (Postgres, an auth provider, S3-compatible storage) works with the same design.
- **Secrets:** kept in the host's secret store, never in the repository.
- **Demo mode:** the current in-memory preview stays as a separate mode for design reviews.

## Data model

All tables carry `workspace_id`. No table has a column for social account passwords.

| Table | Purpose and key columns |
| --- | --- |
| `profiles` | One per signed-in person: `id` (auth user), `name`, `avatar_url` |
| `workspaces` | `id`, `name`, `created_by` |
| `memberships` | `workspace_id`, `user_id`, `role` (`owner` \| `admin` \| `collaborator`), `status` (`active` \| `suspended`). A trigger keeps at least one active owner |
| `spaces` | `id`, `workspace_id`, `name` |
| `social_accounts` | `id`, `space_id`, `platform`, `handle`, `display_name`, `profile_url`, `kind`. Identity only, no credentials |
| `access_grants` | `user_id`, `scope_type` (`space` \| `account`), `scope_id`, `capabilities` (`view`, `edit`, `review`, `publish`), `granted_by`, `granted_at`. Unique per user and scope |
| `invitations` | `email` (case-insensitive), `role`, `grants` (JSON), `token_hash`, `expires_at`, `invited_by`, `accepted_at`, `revoked_at` |
| `ideas` | Existing fields plus `space_id`, `owner_id`, `created_by` |
| `versions` | Existing fields plus `account_id` |
| `tasks` | Existing fields plus `owner_id` (assignee) |
| `assets` | `space_id` (nullable = workspace-wide), `storage_key`, `sha256`, `size_bytes`, `mime`, `uploaded_by`, `state` (`uploading` \| `ready` \| `quarantined` \| `deleted`) |
| `asset_links` | Which ideas an asset belongs to |
| `version_media` | `version_id`, `asset_id`, `role` (`media` \| `cover` \| `photo`), `position`. Shared files are referenced, never copied |
| `activity_events` | Append-only: `actor_id`, `verb`, `subject_type`, `subject_id`, `space_id`, `account_id`, `summary`, `created_at` |
| `video_projects` | `id`, `idea_id`, `title`, `aspect`, `current_cut_id`, `approved_cut_id`; `project_versions` links it to the versions (creations) it's made for |
| `cuts` | `id`, `project_id`, `label`, `kind` (`footage` \| `draft` \| `final`), `asset_id`, `added_by`, `added_at`, `archived_at` |
| `chapters` | `id`, `cut_id`, `title`, `start_ms` |
| `time_notes` | `id`, `cut_id`, `section`, `start_ms`, `end_ms` (null = a moment), `body`, `resolved_at`, `resolved_by`, `author_id`, `carried_from` (note id). Belongs to one cut; never re-timed automatically |
| `storage_addons` | `workspace_id`, `gb`, `price_id`, `status`, `billing_ref`. Allowance = plan + active add-ons |
| `platform_connections` | `account_id`, `provider`, `provider_account_id`, `scopes`, `status`, `connected_by`, `token_ref` (pointer to an encrypted secret), `expires_at` |

## Access rules

These are the same rules as `src/lib/access.ts`, moved into the database.

- **Owner and admins:** everything in the workspace. Only they manage members, grants and connections.
- **Capabilities on an account:** the union of the person's grant on that account and their grant on the account's Space. `view` is required for anything; `edit`, `review` and `publish` imply `view`.
- **Version:** visible with `view` on its account.
- **Idea:**
  - Visible in full with `view` on its Space.
  - Visible in part, showing only their accounts' versions, when the person can see at least one of its versions.
- **File (asset):** visible if any of these holds:
  - a visible version uses it (media, cover or photo);
  - it belongs to an idea whose Space the person can view;
  - its own Space is viewable.
  - Account-only collaborators never see an idea's other raw footage.
- **Task:** visible if its version is visible, or, when it has no version, if its idea's Space is viewable.
- **Writes:**
  - Changing a version needs `edit`.
  - Moving it to *Ready to post* needs `review`.
  - Recording it as live or publishing needs `publish`.
  - Uploading to an idea or Space needs `edit` there.

### Enforcement

- **Database helpers:** SQL functions `can(user, account, capability)`, `can_view_idea(user, idea)`, `can_view_asset(user, asset)` and `can_view_task(user, task)`.
- **Row-level rules:** RLS policies on every table call these helpers. Queries, joins and exports can only return permitted rows, so a direct URL or a shared reference to hidden work returns nothing.
- **Writes:** go through server functions (RPCs) that check the capability and write the activity event in the same transaction. Direct table writes by clients are denied.
- **UI:** the screens use the same answers to hide or disable actions, as the preview does now.

## Sign-in

- Email magic link, with verified email required; optional Google sign-in; passkeys later.
- Sessions in secure, HTTP-only cookies with short lifetimes and refresh.
- Two-factor sign-in (TOTP) recommended for owners and admins, with an option to require it.
- A person can belong to several workspaces (for example, an editor who works for two creators). The workspace switcher lists memberships.
- Leaving or being removed:
  - Their membership and grants are deleted at once, so every new database query, API call and request for a file link is refused from that moment.
  - Their open sessions are signed out; any session token already in the browser stops working at its next refresh (short token lifetime, so within minutes).
  - File links already issued to them are not revoked (see *Revocation, honestly* below); they expire on their own within the stated lifetime.
  - Past work stays and is attributed to "former member".
  - Their personal profile data can be deleted on request.

## Invitations

1. An owner or admin invites an email address with a role and optional starting grants.
2. The server stores only a hash of a random 32-byte token. The email contains a single-use link that expires in 7 days.
3. Accepting requires signing in with that same verified email. The membership and grants are created in one transaction, and the invitation is marked accepted.
4. Admins can resend (which issues a new token) or withdraw invitations. Sending is rate-limited.
5. Invitation emails go through a transactional email provider. Every step is recorded as activity.

## Activity history

- **What is recorded:** events are written by the same transaction as the change. Examples: `uploaded`, `edited`, `changed status`, `approved`, `recorded as posted`, `published`, `granted access`, `invited`, `removed`.
- **Who sees it:** owners and admins see the full workspace history, filterable by person, Space, account and idea. Collaborators see history on the work they can view.
- **What is excluded:** Haven records only work inside Haven. Nothing about personal social accounts, private messages, browsing, device or location is shown to admins. Sign-in records are visible only to the person themselves, for security.
- **Retention and export:** events are append-only, kept at least one year (configurable), and included in workspace export.

## Secure media access

- **Storage:** private bucket only; nothing public. Keys like `workspace/{id}/assets/{uuid}` are unguessable, but secrecy doesn't rely on that.
- **How files are delivered:**
  - **Default, signed links:** a server function checks `can_view_asset` and returns a short-lived signed URL. Lifetimes: about 2 minutes for full downloads and originals; about 10 minutes for playback of preview versions (long enough to start and seek a video). Thumbnails use the same check with the same short lifetime.
  - **Guarded delivery for sensitive files:** an asset can be marked *guarded*. Its bytes are then served through Haven's own file endpoint, which checks the person's access on every request, including each range request while a video plays. This is the only mode that can stop delivery the moment access changes. It costs more bandwidth and latency, so it's opt-in per file or per Space.
  - Signed URLs are never cached across people, stored in the database, or included in activity history.
- **Revocation, honestly:**
  - Removing a member or a grant takes effect at once for everything the server checks: queries, API calls, new file links, and guarded delivery.
  - **A signed URL that was already issued keeps working until it expires.** Supabase Storage can't revoke a single signed URL. The plan therefore keeps lifetimes short, and the UI says: "Removing someone stops new access right away. File links they already opened expire within 10 minutes."
  - A file already downloaded to someone's device can't be taken back by any system. Haven says so when an admin removes a person.
  - If an admin needs a hard stop for one file, they can rotate it: Haven copies it to a new storage key and deletes the old object, which invalidates every existing link to it. This is an explicit action with a confirmation, not something that happens silently.
- **Uploads:**
  - Resumable uploads to a URL signed for one asset, after an `edit` check.
  - The server verifies size and checksum (`sha256`) before marking the file ready.
  - Failed or partial uploads never replace an existing original.
- **No leaks through references:** API responses include file IDs and URLs only for files the person can view. A version's media field is empty for anyone who can't see that file.
- **Deletion and recovery:** a soft delete with a recovery window, and originals referenced elsewhere are never removed silently. Quotas are enforced on the server.

## Social account connections

- **Default is manual.** Haven prepares the post, the person posts natively, and *Mark as posted* records the live link. This needs `publish` in Haven, no platform login, and is labelled manual.
- **Connected, where supported:**
  - The social account's own holder connects it through the platform's official OAuth flow and approves the listed permissions.
  - Haven stores only an encrypted token reference (never shown to anyone or sent to the browser) and the granted scopes.
  - A Haven `publish` capability decides who may trigger a connected action.
- **Per platform:** each platform is added only after confirming its current API and review requirements (for example, business/creator account types and app review), and only for actions its API officially supports.
- **Unsupported actions:** anything a platform doesn't support stays clearly manual in the UI.
- **Upkeep:** connections can be disconnected or revoked at any time. Tokens are refreshed by background jobs, and failures mark the connection as needing attention.

## Publishing history

- **Where posts come from:**
  - **Recorded in Haven:** someone with Publish marks a version as posted and saves the live link. Haven stores `posted_at` (the moment it went live) and `post_source = 'manual'`.
  - **Imported from a connected account:** only where the platform's official API lets the account's owner grant read access to their published posts. A background job imports posts the API returns, matched to existing versions by live URL or platform post ID, otherwise kept as imported posts. `post_source = 'connected'`, with the connection and the API's post ID.
  - Haven never scrapes profiles or asks for passwords. If a platform has no supported import, its history in Haven is whatever was recorded manually, and the calendar says so.
- **Honest coverage:** each connection stores how far back the import reached (`synced_from`, `synced_until`, last run, errors). The calendar labels days outside that range as "not imported" rather than implying nothing was posted.
- **Time zones:** `posted_at` is stored in UTC; the workspace has an IANA time zone (changeable in settings), and calendar days are computed in it, server-side and in the client, with the same function.
- **Access:** posts follow their account's access rules, so the database returns only permitted posts for any month, day or direct link.
- **Scale:** month and day queries use an index on `(workspace_id, account_id, posted_at)`. The months ribbon reads a small per-month summary (counts and up to three covers), so years of work stay fast.

## Video Studio

The Studio is for watching and reviewing drafts, not editing them: no trimming, rendering or modified exports, so the server never transforms a creator's video beyond making playback renditions. The preview's Studio (`src/lib/videoStudio.ts`, `src/lib/access.ts`) defines the behaviour; the server makes it real.

- **Access:** a project is visible when its idea's Space grants `view`, or any of its linked versions' accounts does; capabilities are the union. Cuts, chapters, notes and the cut files follow the project. RLS policies use one `project_capabilities(user, project)` function, and the shared test cases in `videoStudio.test.ts` (Sam sees only the market video; notes need edit or review; approve needs review; deleting a cut needs Space edit) run against it.
- **Uploads:** resumable, chunked uploads (tus/S3 multipart) so hour-long footage survives a dropped connection, with progress from the server. Each upload creates a new `assets` row and a new cut; nothing overwrites an earlier file. `sha256` is computed on the server; a matching hash in the workspace links the existing file instead of storing a second copy.
- **Playback at length:** a background job makes streaming renditions (HLS, a few bitrates, short segments and frequent keyframes for accurate seeking), a poster, timeline thumbnails and an audio waveform, so a long draft seeks quickly anywhere. Originals stay untouched. No arbitrary length limit: storage and the plan's quota are the limits.
- **Viewer settings:** volume and brightness are per-person display preferences (a `viewer_preferences` row or local storage). Brightness is a display filter only; renditions, originals and posted videos are never re-encoded for it.
- **Notes and timing:** times are stored in milliseconds against one cut. Earlier feedback is offered on a new cut with its original times; carrying it forward writes a new note with `carried_from` at a time the person chose. Haven doesn't guess new timings.
- **Storage accounting:** usage = sum of distinct `sha256` files in the workspace (archived cuts included), computed by the server and cached. Deleting a cut is a soft delete; the file's bytes are released only when no cut, version, library entry or other reference uses it, after the recovery window. Deleting notes or links never touches files. Uploads that would exceed the allowance are refused before any bytes are sent.
- **Billing:** extra storage is a subscription add-on through the payment provider. The confirmation shows the price, proration and the new allowance before anything is charged; only owners and admins can change it; usage alerts at 80% and 95%. The preview's *Add storage* shows the same summary and charges nothing.
- **Export:** the notes document is generated from the same data on the server (Markdown and PDF), including only notes on cuts the person can see.

## Phases

Each phase ends with a review and its own tests.

| Phase | Delivers | Done when |
| --- | --- | --- |
| **1. Sign-in and workspace** | Auth, profiles, one workspace per customer, owner membership, Spaces and accounts in the database, demo mode kept | Two real people sign in separately, and each sees only their own workspace |
| **2. Team and access** | Invitations, roles, grants, access editor on real data, RLS on all tables, activity for access changes | The access test fixtures pass against the database, and a restricted person gets nothing through direct URLs, the API or export |
| **3. Shared work** | Ideas, versions, tasks, links, calendar on the server; capability-checked writes; activity history view; live updates | Two browsers as two people see each other's changes; approve and post buttons follow capabilities |
| **4. Secure media** | Private storage, short-lived signed URLs, guarded delivery, rotation, resumable uploads, checksums, quotas, recovery, export | Upload, interruption and restore tests pass; a removed person can't get new links or guarded bytes, and old links expire within their stated lifetime |
| **5. Video Studio on the server** | Projects, cuts, chapters and timed notes in the database; resumable uploads and streaming renditions; storage accounting; storage add-ons through billing | A one-hour upload survives interruption and seeks instantly; notes appear for every permitted person and no one else; storage totals match the distinct files; an add-on is charged only after confirmation |
| **6. Platform connections** | Official OAuth connections, platform by platform, where the action is supported | Connected actions obey `publish`; everything else stays manual |

## Testing and review

- **Shared test cases:** turn the scenarios in `src/lib/access.test.ts` into one shared set of cases, run against both the preview rules and the database's row-level rules, so the two can't drift apart.
- **Integration tests:**
  - Owner, admin, Space collaborator, account-only collaborator and invited person.
  - Every table, including files, versions reached through shared files, and exports.
- **End-to-end tests:** two browser contexts signed in as different people.
- **Before selling plans:** a security review of access rules, signed URLs, tokens and invitations, with an external penetration test before a paid launch.
