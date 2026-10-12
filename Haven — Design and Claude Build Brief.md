# Haven — design and Claude build brief

**Version:** 0.1, 29 September 2026  
**Owner:** Apoorva  
**Working roles:** Apoorva owns product decisions; ChatGPT leads product and interface design; Claude implements the code in GitHub Codespaces/VS Code. Apoorva plans to remain the sole owner and use a small paid team without outside funding.

## Product promise

Haven is a premium daily workspace for content creators and their small teams. It takes a piece of content from an initial idea through gathering footage, planning variants, editing elsewhere, review, posting preparation, and long-term reuse. The core organizing unit is **one idea group** containing its original assets and the versions planned for multiple platforms and multiple accounts on the same platform.

Haven is a web product. It stores links to each social platform and its own analytics page; it does **not** pull analytics into Haven or promise automatic publication. Creators prepare their work in Haven, then publish on the native platforms. Editing happens in the creator's chosen editor; Haven handles the assets, notes, handoff, and review.

## Experience principles

1. **Open and know what to do.** Today presents actionable work, upcoming deadlines, and a path back to the current idea.
2. **One idea, every version.** The creator can see the common source and each account-specific version without duplicating the entire project.
3. **Treat original media as precious.** Storage status, versions, safe deletion, and download access must be unambiguous.
4. **Quiet luxury for working hours.** Spacious editorial hierarchy, polished motion, precise typography, rich media, and subtle depth. Avoid a dashboard made of equally weighted boxes.
5. **Two complete appearances.** Light and dark modes are peers, not an inverted afterthought. Remember the chosen theme.
6. **Every important action has an honest state.** A prototype must not imply that a file is safely archived, a post is published, or a payment succeeded when none of those happened.

## Navigation proposal

**Global:** Haven mark; workspace switcher; universal search; quick-add; notifications; theme toggle; profile.  
**Primary:** Today, Ideas, Calendar, Accounts, Library, Campaigns, Links.  
**Contextual:** Tasks and review live with their idea groups; team & access, storage, billing, and settings live under the workspace menu. Do not split the same work into disconnected duplicate dashboards.

### Today

An editorial welcome with today's date and one clear next action. A prioritized task list (“Needs you,” “Assigned to others,” “Upcoming”), a compact seven-day schedule, a strip of recently active idea groups, and direct links to the accounts the creator uses today. Users can switch to an account or campaign focus.

### Ideas

A media-led, filterable grid. Each tile is one idea and shows its cover, name, campaign/series, status, due date, and small badges for its target accounts. Opening a tile leads to the **Idea workspace**:

- Overview: concept, script, shot list, references, people, campaign, and status.
- Assets: raw videos, cutaways, photos, audio/music, covers, and files saved from the reusable Library; favorite/select useful moments.
- Versions: one row per specific account, with media, cover, captions, tags, links, language variants, mock preview, checklist, and publish status.
- Review: media versions, timestamped comments, annotations, version history/comparison, approval, and scoped review link.
- Tasks: owner, deadline, recurring template, and progress stage.
- History: live URLs, manual learning notes, and archive/reuse controls.

An idea can be archived or deleted; selected media can be promoted to the main Library. Deleting the idea must never silently remove a Library original referenced elsewhere.

### Accounts

Notebook-like pages for Instagram, YouTube, TikTok, LinkedIn, Snapchat, X, and user-added channels, with space for Threads, Pinterest, Facebook, Bluesky, podcasts, and newsletters. Each platform can contain several distinct accounts. There is an all-accounts view and an account-specific view for planned/published versions, links, and calendar items. An account has an external profile URL and an external native analytics URL. The latter opens the platform; Haven has no connected analytics dashboard.

### Calendar

Content and marketing perspectives over the same planned work, with filters for account, platform, campaign, status, and person. Color has a clear legend and remains readable in both themes. Dragging to reschedule should update the relevant task and version dates once persistence exists.

### Library

Reusable originals and brand assets, searchable by topic, campaign, platform, person, and date. Clear storage meter, duplicate warning, upload progress, retry/resume, original/proxy distinction when applicable, and trustworthy download status. Users can upload from phone or computer and can select an organized download package for editing elsewhere. Keep music source and rights notes with the asset. No automatic deletion when a storage limit is reached.

### Campaigns and Links

Campaigns group multiple ideas for a launch, series, sponsorship, or event. Links keeps account pages, native analytics pages, published URLs, affiliate/campaign URLs, and brand resources. A public link-in-bio page is not part of the current brief.

## Workspace, collaborators and access (revised direction)

**One workspace per customer.** Each customer has one shared Haven workspace. **Spaces** (usually a brand or show, such as “Pine & Paper”) and their **social accounts** organise the work inside it. A person can use the workspace alone or invite collaborators.

**Roles and access.** The owner and admins have full access to the workspace's work. An admin assigns each collaborator access to specific Spaces and social accounts, with clear capabilities:

- **View**: open the work and the files it uses.
- **Edit & upload**: change versions, captions and dates, and add files.
- **Review & approve**: move a version to Ready to post.
- **Publish**: record a post as live. Real publishing only where a supported platform connection exists and its granted permissions allow it; otherwise the action stays clearly manual.

A whole-Space grant covers every account in that Space. **Files follow the work**: a collaborator sees the files used by what they can open, never the rest. Access checks cover files and linked creations, so a restricted person can't open them through a direct URL or a shared reference.

**Sign-in and credentials.** Each collaborator signs in to Haven as themselves. Nobody signs in to every social account to plan, edit or review in Haven. Haven never requests, stores, reveals or distributes social account passwords; a handle identifies an account and is not a credential.

**Work activity.** Admins can see work activity inside Haven: who uploaded, edited, approved, changed status or published what. Haven never exposes anyone's personal account activity, private messages or unrelated browsing.

**Not in scope.** No team chat, channels, group rooms or disappearing messages. Feedback attached to a specific creation (timestamped review comments) is a later work feature (Milestone 3).

**Preview status (Milestone 1).** *Team & access* in the workspace menu shows sample members, invitations and an access editor by Space and account, and can *preview as* a collaborator. In the preview this only filters the current browser tab; it is not security. Real sign-in, invitations and server-enforced access follow the backend plan (`docs/backend-plan.md`).

## Full feature inventory to preserve

- Premium web workspace and remembered light/dark appearance.
- Today view; content grid; separate account pages; multiple accounts per platform; all/single account filtering.
- Idea capture, grouping across every platform/account, campaign grouping, reusable series/templates, searchable history, archive/delete/reuse.
- Scripts, shot lists, references, phone inbox, raw media, music, quick selects, timestamped notes, editor handoff across devices.
- Large reliable uploads, safe original storage, duplicate detection, storage usage, downloads, paid storage additions, clear limit handling.
- Brand kit, music-source/license notes, hook and CTA bank, multilingual captions/descriptions entered by the user.
- Account-specific post versions, timed on-screen text plan, covers/opening-frame review, approximate platform preview, final readiness checklist and ready-to-post bundle.
- Version history and comparison, timestamped feedback, private client/brand review link, approvals, scoped team roles.
- Tasks per idea/version, assignees, due dates, daily focus, content calendar, marketing calendar with colors, workflow stages and reminders.
- Published links, optional manual learning notes, account and native analytics bookmarks. No automatic analytics ingestion or auto-posting is promised.
- $50/month entry-plan hypothesis; higher plans in the $100–$1,000+ direction; storage add-ons and potential team/client-workspace differences. Prices and allowances require cost and customer validation before launch.

## Visual starting direction — to review with Apoorva

**Character:** a serene editorial studio rather than a dense social-media dashboard. Large, cinematic media covers are the visual anchors; type and spacing provide hierarchy. Surfaces may have gentle elevation and light, but controls remain crisp and accessible.

**Light:** warm ivory canvas, near-black ink, soft stone dividers, restrained violet-blue accent, and full-color media.  
**Dark:** deep midnight-blue canvas, softly luminous text, slate surfaces, the same violet-blue accent adjusted for contrast, and media that remains vivid.  
**Typography:** expressive display face for a few headings paired with a highly legible interface sans. Exact fonts and colors are provisional until Apoorva reviews screenshots.  
**Motion:** short, calm transitions for opening an idea, changing focus, and marking work complete. Honor reduced-motion settings.  
**Responsive:** desktop-first working canvas, useful tablet layout, and a phone flow optimized for quick capture, review, and checking today's work.

## Build sequence

### Milestone 1 — reviewable product prototype

Claude creates a GitHub repository with a responsive web app and seeded demo workspace. Build Today, Ideas grid, Idea workspace (Overview/Assets/Versions/Tasks), Accounts with multiple profiles, Calendar, Library, and Links. Add the theme toggle with persistence, filters, interactions, clear empty/loading states, and an approximate mock post preview. Demo upload and storage controls must be visibly labeled as demo where they are not persisted. Use realistic, replaceable sample data; no real customer media or credentials.

**Review gate:** Apoorva and ChatGPT inspect desktop and mobile in both themes, follow one idea into two platforms and two accounts on one platform, and revise the hierarchy and feel. This is a design review, not a production launch.

### Milestone 2 — trustworthy core data and media

Authentication (each person signs in as themselves), one workspace per customer with Spaces, invitations, roles and per-Space/per-account capabilities enforced on the server, work-activity history, ideas, account profiles, variants, campaigns, tasks, assets, and saved links; production database and secure object storage. Implement resumable uploads, integrity checks, access controls, download/recovery, quota enforcement, duplicate handling, deletion semantics, and an export path. Keep secrets out of the repository. Test the failure cases that could lose a creator's media.

### Milestone 3 — collaboration and paid workflow

Feedback attached to a specific creation (timestamped review), version comparison, client links/approval, ready-to-post bundles, recurring templates, billing, storage add-ons, usage transparency, and team/client plans. Verify access and payment states before selling plans. Native platform connections, automatic publishing, in-browser editing, and imported analytics are outside the present scope.

## Claude's first implementation task (paste into Claude Code)

> You are implementing Haven in a new GitHub repository from the attached design brief. Start with **Milestone 1 only**: a polished, responsive, interactive demo, without production auth, payments, social APIs, or real customer storage. Use a maintainable TypeScript web stack suited to GitHub Codespaces; document the run commands in README. Keep demo data in a separate typed module and model one idea with versions for Instagram personal, Instagram business, TikTok, and YouTube, so multiple accounts on one platform are exercised. Build remembered light/dark mode, Today, Ideas grid, Idea detail with Overview/Assets/Versions/Tasks, Accounts, Calendar, Library, Links, filtering, approximate account-specific post preview, and coherent navigation. Mark all demo-only upload, download, and publish actions honestly. Make the visual style feel like a calm premium editorial studio with rich media and subtle depth. Make desktop and mobile layouts. Run the build and basic flow checks, then provide preview screenshots of both themes and a concise list of implemented routes, interactions, and remaining limitations. Do not invent live integrations. Ask for design review before Milestone 2.

## Practical setup

1. Create a **private** Haven GitHub repository under Apoorva's account. The repository should remain under her control.
2. Open a **GitHub Codespace**, which supplies the terminal and runtime in browser-based VS Code. Plain `github.dev`/`vscode.dev` is fine for light edits but does not supply the same build-and-run environment.
3. Run Claude Code in the Codespace terminal using its current official setup and account sign-in. Paste the first implementation task and make this brief available in the repository as product/design guidance.
4. Work in small commits and branches. Share the running preview or screenshots for design review. Production video storage is a separate service; the Codespace is only a development machine.

**Decision still to validate:** the exact typefaces/colors, storage allowances and pricing, and the first creator segment. The feature inventory above is preserved while implementation is staged.
