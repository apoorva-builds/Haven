# Haven backend plan: sign-in, access, activity, media, connections

Status: proposal for review. Nothing here is built yet. The Milestone 1 preview (Team & access, *preview as*) only filters one browser tab and is not security. This plan makes the same rules real on the server.

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
  - Access is revoked immediately.
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

- **Storage:**
  - Private bucket only; nothing public.
  - Keys like `workspace/{id}/assets/{uuid}` are unguessable, but secrecy doesn't rely on that.
- **Downloads and playback:**
  - A server function checks `can_view_asset`.
  - It returns a short-lived signed URL (minutes).
  - Thumbnails and preview versions use the same check.
  - Signed URLs are never cached across people.
- **Uploads:**
  - Resumable uploads to a URL signed for one asset, after an `edit` check.
  - The server verifies size and checksum (`sha256`) before marking the file ready.
  - Failed or partial uploads never replace an existing original.
- **Revoking access:** takes effect for new requests immediately. Existing signed URLs expire quickly.
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

## Phases

Each phase ends with a review and its own tests.

| Phase | Delivers | Done when |
| --- | --- | --- |
| **1. Sign-in and workspace** | Auth, profiles, one workspace per customer, owner membership, Spaces and accounts in the database, demo mode kept | Two real people sign in separately, and each sees only their own workspace |
| **2. Team and access** | Invitations, roles, grants, access editor on real data, RLS on all tables, activity for access changes | The access test fixtures pass against the database, and a restricted person gets nothing through direct URLs, the API or export |
| **3. Shared work** | Ideas, versions, tasks, links, calendar on the server; capability-checked writes; activity history view; live updates | Two browsers as two people see each other's changes; approve and post buttons follow capabilities |
| **4. Secure media** | Private storage, signed URLs, resumable uploads, checksums, quotas, recovery, export | Upload, interruption and restore tests pass; revoked people can't fetch files |
| **5. Creation feedback** (Milestone 3) | Feedback threads attached to a specific creation, with timestamps; no workspace chat | Feedback is visible only to people who can see that creation |
| **6. Platform connections** | Official OAuth connections, platform by platform, where the action is supported | Connected actions obey `publish`; everything else stays manual |

## Testing and review

- **Shared test cases:** turn the scenarios in `src/lib/access.test.ts` into one shared set of cases, run against both the preview rules and the database's row-level rules, so the two can't drift apart.
- **Integration tests:**
  - Owner, admin, Space collaborator, account-only collaborator and invited person.
  - Every table, including files, versions reached through shared files, and exports.
- **End-to-end tests:** two browser contexts signed in as different people.
- **Before selling plans:** a security review of access rules, signed URLs, tokens and invitations, with an external penetration test before a paid launch.
