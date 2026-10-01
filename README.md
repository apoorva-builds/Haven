# Haven

A calm, premium daily workspace for creators and their small teams. It takes one idea from capture, through footage, versions for each account, editing handoff and review, to posting prep and reuse.

> **Status: Milestone 1 — Haven preview · sample data.** An interactive prototype with a small amount of clearly fictional sample content. No accounts, no database, no uploads, no payments, no platform connections. Every change lives in your browser tab and resets on reload; only your light/dark choice is remembered.

Product and design guidance lives in [`Haven — Design and Claude Build Brief.md`](Haven%20%E2%80%94%20Design%20and%20Claude%20Build%20Brief.md).

## Run it

Requires Node 20+ (Node 22 recommended). In GitHub Codespaces the included dev container installs everything.

```bash
npm install
npm run dev          # http://localhost:5173 — hot-reloading dev server
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests (Vitest): demo data integrity, reducer rules, date helpers |
| `npm run test:e2e` | Flow checks (Playwright) on desktop and phone against the build |
| `npm run screenshots` | Regenerates review screenshots in `docs/screenshots/` (both themes, desktop + phone) |
| `npm run check` | typecheck → unit tests → build → flow checks |

Playwright needs a Chromium: `npx playwright install chromium` (the dev container does this). If you already have a Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome` instead.

Add `?instant` to any URL to skip the simulated loading states (the automated checks do this).

## Stack

Vite + React 19 + TypeScript + React Router. Plain CSS with design tokens (`src/styles/app.css`) — light and dark are two full token sets, not an inversion. Fonts are self-hosted via Fontsource (Fraunces for display, Inter for UI); both are provisional pending design review.

```
src/
  data/types.ts        Domain model (ideas, versions, accounts, assets, tasks, links…)
  data/demo.ts         Fictional sample workspace (Pine & Paper, Little Atlas); dates relative to today
  state/reducer.ts     All in-memory interactions (pure, unit tested)
  state/store.tsx      React context around the reducer
  state/theme.tsx      Remembered light/dark appearance
  components/          Shell, cover art, post preview, uploader, asset card, primitives
  lib/creations.ts     Creation Gallery labels ("Instagram · Reel"), day grouping (unit tested)
  lib/audience.ts      Audience Pulse maths: freshness, 7/30-day change, trend (unit tested)
  lib/help.ts          The short explanations behind every ⓘ button
  pages/               Today, Ideas, Idea workspace (4 tabs), Creation Gallery, Calendar, Raw Library, Campaigns, Links
e2e/                   Playwright flow checks + screenshot capture
docs/screenshots/      Review screenshots (light/dark × desktop/phone)
```

## The preview

- **Label.** The top bar carries a **Preview · sample data** chip (“Preview” on phones). It opens the single **About this preview** panel: sample content is fictional; uploads are session-only; follower counts are sample figures; nothing is published and no accounts are connected; changes reset on reload.
- **Sample content.** Two fictional brands, **Pine & Paper** and **Little Atlas**, with five accounts (two YouTube, two Instagram, one TikTok). Handles end in `.sample` and none link to a real profile. Six ideas, a handful of posts and files, and two placeholder links on example.com. Every still and clip in `public/demo-media/` is painted on a canvas by `scripts/demo-media/scenes.js` (a night market, a desk in morning light, a reading room, desks and café tables from above). None are real photos or footage, and each carries a small burned-in “Haven sample · not a real photo / not real footage” mark. Regenerate with `node scripts/make-demo-media.mjs` (add `--only=packing.jpg` for one file).
- **ⓘ buttons.** Main sections and less familiar features have an ⓘ button: Creation Gallery, account filter, post status, tiles and platform borders, Audience Pulse, Raw Library, finished video, Work, Ideas, Calendar and Links. The explanation appears on click or tap, one at a time, and closes on Escape (focus returns to the button), on an outside click, or when another opens. Panels stay inside the screen on phones and are announced to screen readers. The wording lives in `src/lib/help.ts`.

## Calendar: the life of everything you've made

- **Covers on days:** posted days show the real covers or video frames; several posts on one day become a small collage with the count. Planned posts are dashed outlines (and draggable chips on larger screens), so past and future never look alike. Empty weeks stay slim.
- **Day View** (`?day=YYYY-MM-DD`, from the Calendar or Today): every post from that date, with its video, photos (browse them), platform, account and Space, caption and source. *Open in Haven* opens the creation; *View live post* appears only when a live link was saved. Move with the arrows, ←/→ keys, or the strip of nearby days with posts; Esc closes. Empty dates say so and offer the nearest days with posts.
- **Years of work:** a ribbon of months with activity (covers and counts) jumps straight to any month, a year ago included.
- **Today** shows the last four weeks and the week ahead as a ribbon of covers, opening the same Day View and the full Calendar.
- **Time zones:** a post's day is the day it went live in the workspace time zone (`America/Los_Angeles` in the preview), so an 11:40 pm post stays on its day although it is already tomorrow in UTC.
- **Access:** built from the viewer's own data, so collaborators see only permitted posts, and a direct Day View link reveals nothing else.
- **Honest sources:** each post says where it came from. In the preview every posted record is *Recorded in Haven* (Mark as posted). No social account is connected, and no history is imported or synced.
- Model: `src/lib/posts.ts`, `src/lib/time.ts` (unit tested); flows in `e2e/calendar.spec.ts`. Captures: [`docs/redesign/calendar/`](docs/redesign/calendar/).

## Today: a creator's dashboard

Today opens on the creator's own work, then what's next.

- **Memories:** posted creations they can open come back as a playable video or a photo post, with the post's caption and an *Open creation* link. One leads each day in rotation, and *Another memory* walks through the rest. A post from this day in an earlier year leads with *On this day*. Memories are never invented: with nothing posted, Today says so (`src/lib/memories.ts`, unit tested).
- **Look what you've made:** a ribbon of the last four weeks and the week ahead, with real covers per day; it opens the Day View and the full Calendar.
- **What's next:** the next task with *Continue*, quick actions (New idea, Creation Gallery, Calendar), *Needs attention* (tasks with Focus), *Coming up* (seven days) and *Pick up where you left off*.
- **Personal photo (optional):** each person can add one from the photo circle. Preview: it's kept in this browser only (localStorage) and never uploaded. Without one, initials keep the page complete.
- **Wordmark:** a temporary typographic placeholder at the top of Today. Replace it by putting your SVGs in `public/brand/` and setting the two paths at the top of `src/components/Wordmark.tsx`.
- **Access:** everything comes from the viewer's own data, so *Preview as* a collaborator shows only their memories and work, and never the owner's photo.
- Motion is subtle (rise-in, film-strip lift, memory crossfade) and switches off with *reduce motion*. Captures: [`docs/redesign/today/`](docs/redesign/today/).

## Team & access (preview)

The workspace menu opens **Team & access** (`/team`). It shows sample members (owner, admin, two collaborators, one pending invitation) and an access editor organised by **Space** and **social account**, with four capabilities: **View**, **Edit & upload**, **Review & approve** and **Publish** (manual until a supported platform connection exists).

- **Preview as** a collaborator: every page shows only what that person could open. Direct links to other work say it isn't shared, files follow the work, and status and posting controls follow their capabilities.
- **Honest scope:** this filters the current browser tab only. It is **not security**, and invitations send nothing. Real sign-in, invitations and server-enforced access are planned in [`docs/backend-plan.md`](docs/backend-plan.md).
- Haven never asks for social account passwords; a handle only identifies an account. There is no team chat: feedback lives on a video and its exact draft, in the Video Studio.
- Rules: `src/lib/access.ts` (unit tested in `access.test.ts`); flows in `e2e/team.spec.ts`. Captures in [`docs/redesign/team/`](docs/redesign/team/).

## Video Studio (preview)

`/studio` is a **review studio, not a video editor**: no cutting, trimming, effects, rendering or modified exports. The editor works in their own tools and uploads the next draft; Haven keeps every draft, its review booklet and the final video together.

**The default view is the video.** A large player, the draft switcher (Draft 1 · Draft 2 · Final, each with a quiet status) and one next action: *Upload final video*, *Finish the publishing checklist*, or *Ready to publish · not posted yet*.

- **Familiar controls:** play/pause, a smooth draggable progress bar (the time and section under the pointer are shown; you land on that second), current time/duration, volume, fullscreen. Controls fade while playing and return on any movement. Keys: Space/K, ←/→ 5 s, Shift+←/→ 1 s, J/L 10 s, N note, B booklet, F fullscreen, M mute.
- **Fine controls live in the settings menu:** ±1 second with the exact time, *Go to* a typed time (`00:14:32`, `14:32`, `872`), speed, brightness, note markers on the progress bar (off by default), *Export the full note list*, and the keyboard shortcuts.
- **Honest loading:** “Loading 0:45:00…” while a seek or buffer is pending; a clear error with *Try again*.
- **Viewer-only comfort:** volume and brightness. Brightness is a display filter on your own player, remembered per person in this browser; the file, other people's view and the posted video never change.
- **The Booklet** (labelled button, or B): open or close it while the video plays; the choice is remembered for this viewing session. Beside the video on wide screens; a slide-over you dismiss in one tap (×, the backdrop or Esc) on smaller ones.
  - Organised by the draft's sections (chapters, the plan's sections, or the sections notes name). The current section is subtly highlighted with its progress.
  - It never scrolls while you read or write; *Follow playback* rejoins the current moment.
  - Clicking a section or note seeks to its timestamp.
  - **Add note at 3:18:** pause and the action names the exact second. Write what should change; optionally add a time range (“Until”) or a section. Saved notes say where they went (“Saved to Draft 2 at 3:18”).
  - Each item is **Open or Done**. Done means the change was made in your editor; reopen it if it still needs work. Quiet progress: “7 of 10 review items done · 3 sections ready · 3 need attention”.
  - Open notes on earlier drafts are kept at their original times, in a folded section, with *See it in Draft 1*. Haven never moves them; you can choose to add one to this draft at a second you pick.
- **Fullscreen** holds the player and booklet: **Video only** or **Video + Booklet** (beside the video on desktop, a slide-over on small screens).
- **Drafts to final:** upload as many drafts as you need; each keeps its own booklet. *Upload final video* adds a **Final** without touching the drafts. The Final gets its own **publishing checklist**: this is the correct version (with *Use it for N creations* if they still point elsewhere), title and caption reviewed, thumbnail or cover reviewed, then **Mark ready to publish**. Ready is a decision in Haven, not a post: creations keep their status, and nothing claims a platform was published to. Unticking a check takes “ready” away.
- **Drafts & final tab:** history with sizes and storage, rename, archive, compare two drafts side by side, delete with confirmation (frees space only when nothing else uses the file), add storage (preview, no charge).
- **Access:** a video follows its idea's Space and the creations it's made for. Notes and checklist ticks need Edit or Review; *Mark ready to publish* needs Review; deleting a draft needs Edit on the whole Space.
- **Sample data (labelled “Sample data” / “Sample video”):** *A quiet morning — long cut* has original footage (placeholder), Draft 1 (1:00:00) and Draft 2 (59:00, a minute trimmed from the welcome), six chapters each, and a Draft 2 booklet with 7 of 10 items done. *Night market phrases* has Draft 1, Draft 2 and a Final part-way through its checklist. All media are painted and marked “Haven sample · not real footage”; rebuild with `node scripts/make-studio-media.mjs`.

**Works now (preview):** all of the above in this browser tab. Notes, ticks, drafts, the checklist and storage changes last until reload; booklet open/closed and note markers are remembered for the tab session; volume and brightness per person in this browser. Files you add play from your device and are never uploaded.

**Demo-only / needs the backend:** real uploads and storage for the team (resumable uploads, streaming renditions so long drafts seek instantly anywhere), notes and checklists saved on the server with access enforced there, storage quotas and paid storage, and any actual publishing (posting stays manual until an official platform connection exists). See [`docs/backend-plan.md`](docs/backend-plan.md#video-studio).

Tests: `src/lib/videoStudio.test.ts` (sections, progress, checklist rules, storage, access) and `e2e/studio.spec.ts` (default view, play and seek, typed times and notes near the beginning/middle/end of the one-hour sample, drag scrubbing, a throttled-network seek, fullscreen layouts, tick and reopen, add/edit/export, switching drafts, upload final and mark ready, viewer-only settings, restricted access), plus the phone slide-over in `e2e/mobile.spec.ts`.

## Colour: an editorial palette (in review)

Warm ivory and ink are the foundation in both themes (layered warm charcoal in dark). Each accent has one job, everywhere:

| Accent | Job | Where you see it |
| --- | --- | --- |
| **Cobalt** | Act and select | Primary actions, links, focus rings, the selected navigation item, active tabs, active filters |
| **Jade** | Done | Ready and Posted, finished tasks, audience growth |
| **Amber** | Needs your eyes | In review, out-of-date figures, review tasks, the sample-data marker |
| **Burnt coral** | Time | Today's date and row, overdue, unread notifications |

Platform marks (YT, IG, TT) are deep, flat versions of each platform's own colour. Collections get a tone only in larger moments: *Phrase guides* is cobalt, *Study routines* is jade, and ideas outside a collection use a quiet ink panel. Media stays the strongest colour in the Creation Gallery. Text accents meet WCAG AA contrast (4.5:1) on their backgrounds in both themes. Captures: [`docs/redesign/colour/`](docs/redesign/colour/) (before: [`colour-before/`](docs/redesign/colour-before/)).

## Design direction: private creative studio (in review)

Applied so far to **Ideas** and the **Creation Gallery** only; the rest of Haven follows once the direction is approved.

- **Palette**: see *Colour* above. Colourful media glows softly in dark mode.
- **Type**: Instrument Serif for major titles, Inter for the interface.
- **Ideas**: an editorial title with a small count and one *New idea* action; one **Up next** feature (media still, due date, stage, account versions, *Continue*); then **All ideas** as composed rows (thumbnail, title, quiet detail, stage with a six-step meter, due date, version count). Search is the page's one prominent search field; status, campaign, account and sort sit in **Filters**; *Archived* is a quiet toggle.
- **Creation Gallery**: *Coming up* and *Posted* in justified rows that keep each format's real proportions (9:16, 16:9, 4:5), concise titles and a small platform/format mark.
- Captures: [`docs/redesign/studio/`](docs/redesign/studio/). Regenerate with `COMPARE_OUT=studio COMPARE_SCREENS=ideas,gallery COMPARE_DEVICES=desktop npm run screenshots`.

## Earlier design pass: calm, media-first

- **Creation Gallery**: one title and one primary action (*New idea*); a quiet toolbar (account selector, status); at most three large, rounded covers per row on desktop (two on tablet, one on phone) with generous spacing. Tiles show only the title, platform/format (with a thin platform-colour mark) and status; captions, account details and actions live in the opened view.
- **Version screen**: the finished video (or carousel photos) is the focal point. The platform mock is a small, labelled *Approximate* preview beside it, collapsed on phones. The idea header is compact and the version list is a quiet list (a scrolling row on phones).
- **Quieter chrome**: status and account badges are text with a small dot instead of filled pills; lighter cards, outlines and shadows; no top-bar primary button.
- Before/after captures of the Gallery and version screen, desktop and phone, both themes, are in [`docs/redesign/`](docs/redesign/). Regenerate with `COMPARE_OUT=after npm run screenshots`.

## Routes

| Route | Screen |
| --- | --- |
| `/gallery` | **Creation Gallery**: one compact **account selector** (All accounts, or one account grouped by brand), a status filter, an **Audience Pulse** for the selected account, then posts by day. Tiles show a rounded cover or playable video, a platform-coloured border, a top label (“Instagram · Reel”, “YouTube · Short”, “YouTube · Long video”, “Instagram · Carousel”), the account, status and parent idea. `?account=<id>` selects an account. |
| `/gallery/:versionId` | **Opened creation**: plays the video or pages through the photos inside Haven; account, caption, date, status, related idea and its other versions. **Open posted video/post** appears only for Posted versions with a saved live URL. |
| `/library` | **Raw Library**: source files only (original photos, audio/music, unedited clips, brand assets). Finished posts are never listed here. |
| `/` | **Today**: memories of posted work, look what you've made, the next action, needs attention, coming up, pick up where you left off |
| `/ideas`, `/ideas/:id[/assets|/versions|/tasks]` | **Ideas** and the **Idea workspace**; the Versions tab holds the finished-video picker |
| `/studio`, `/studio/:id[/drafts|/plan|/compare]` | **Video Studio**: videos from plan to posted; watch a draft with its review booklet; drafts, final and publishing checklist (`?cut=`, `?t=` open a draft at a second) |
| `/calendar` | Visual publishing calendar: covers on days, Day View (`?day=`), months ribbon, filters, drag to reschedule; compact month and agenda on phones |
| `/links`, `/campaigns` | Saved links; campaigns (reachable from ideas) |
| `/team` | **Team & access** (preview): members, invitations, access by Space and account, preview as a collaborator |
| `/accounts`, `/accounts/:id` | Redirect to the Creation Gallery |

## The review path

1. **Creation Gallery** shows all accounts together. Tap the ⓘ buttons to read what each part does.
2. Pick **Pine & Paper · YouTube** in the account selector for its Audience Pulse and posts. **Little Atlas · Instagram** shows an out-of-date pulse.
3. Open a tile to play it inside Haven. **Four quiet places to work** is a posted sample with an *Open posted video* button (example.com).
4. From Today, **Continue “Five phrases for a night market”** → Versions: one finished file serves four versions across TikTok, both Instagram accounts and a YouTube Short.
5. **Raw Library** holds only source files.

## Audience Pulse

Each selected account shows its follower/subscriber count, the change over 7 and 30 days, a small 30-day trend, and when it was last updated. In the preview every figure is a **sample**, marked as such, and rendered statically.

The data is ready for real use later (`src/data/types.ts`, `src/lib/audience.ts`):

- `AudienceSeries` holds timestamped `snapshots` and a `source`: `platform-api` (periodic refresh from an authorized platform API) or `manual` (snapshots entered for accounts that can’t connect). Preview series are `sample`, noting which method they would use.
- `staleAfterHours` sets how old a count may be. Past that, the pulse shows **Out of date** with the last known figure and its age, **never as the current count**, and hides the changes.
- 7- and 30-day change compares the latest snapshot with the one at or before the start of the window; with too little history it says so rather than estimating.

## Screenshots

All 48 review screenshots (12 screens × light/dark × desktop/phone) are in [`docs/screenshots/`](docs/screenshots/). Regenerate with `npm run screenshots`.

| Light | Dark |
| --- | --- |
| ![Creation Gallery](docs/screenshots/light-desktop-gallery.jpg) | ![Creation Gallery](docs/screenshots/dark-desktop-gallery.jpg) |
| ![ⓘ explanation open](docs/screenshots/light-desktop-gallery-info.jpg) | ![ⓘ explanation open](docs/screenshots/dark-desktop-gallery-info.jpg) |
| ![One account with Audience Pulse](docs/screenshots/light-desktop-gallery-account.jpg) | ![One account with Audience Pulse](docs/screenshots/dark-desktop-gallery-account.jpg) |
| ![About this preview](docs/screenshots/light-desktop-about-preview.jpg) | ![Opened creation](docs/screenshots/dark-desktop-creation.jpg) |
| ![Raw Library](docs/screenshots/light-desktop-library.jpg) | ![Raw Library](docs/screenshots/dark-desktop-library.jpg) |

| Phone · Gallery | Phone · ⓘ | Phone · One account | Phone · About | Phone · Raw Library |
| --- | --- | --- | --- | --- |
| ![](docs/screenshots/light-phone-gallery.jpg) | ![](docs/screenshots/light-phone-gallery-info.jpg) | ![](docs/screenshots/dark-phone-gallery-account.jpg) | ![](docs/screenshots/dark-phone-about-preview.jpg) | ![](docs/screenshots/light-phone-library.jpg) |

## Honest states

- **Uploads** are simulated and session-only. A video chosen from the device plays from a browser-local URL and is labelled *From this device · session only. Not uploaded or stored online.*
- **Sample videos** are labelled *Demo sample bundled with the prototype, not real footage*.
- **Posting**: Haven doesn’t publish. Unposted creations say *Not published*. A version becomes *Posted* only when you paste its live URL; only then does *Open posted video/post* appear.
- **Audience Pulse** figures are marked *sample*, static, and shown as *Out of date* once too old.
- **Downloads, download packages and bundles** produce no files. Storage figures are labelled *Demo figures*; nothing is deleted automatically.
- **Deleting an idea** lists which files are kept (Raw Library originals and files shared with other ideas).
- The **post preview** is labelled approximate.

## Known limitations (by design for Milestone 1)

- No persistence beyond the theme: all edits reset on reload.
- No auth, database, object storage, real uploads/downloads, quota enforcement or platform connections (Milestone 2). Team & access is a preview: it filters one tab and is not security.
- No review links, version comparison, approvals, ready-to-post bundles, recurring templates or billing (Milestone 3).
- Media is generated artwork and synthetic sample video; the post preview is approximate.
- The bundled samples don’t report a duration, so their seek bar is limited.
- Calendar drag-and-drop needs a mouse; on touch devices, reschedule from the version’s date field.
- Fonts and colours are provisional pending design review.
