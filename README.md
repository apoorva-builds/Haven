# Haven

A calm, premium daily workspace for creators and their small teams. It takes one idea from capture, through footage, versions for each account, editing handoff and review, to posting prep and reuse.

> **Status: Milestone 1 — reviewable interactive prototype.** No accounts, no database, no uploads, no payments, no platform connections. Every change you make lives in your browser tab and resets on reload. The only thing remembered is your light/dark choice.

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
  data/demo.ts         Seeded demo workspace — fictional, replaceable, dates relative to today
  state/reducer.ts     All in-memory interactions (pure, unit tested)
  state/store.tsx      React context around the reducer
  state/theme.tsx      Remembered light/dark appearance
  components/          Shell, cover art, post preview, uploader, asset card, primitives
  lib/creations.ts     Creation Gallery labels ("Instagram · Reel"), day grouping (unit tested)
  pages/               Today, Ideas, Idea workspace (4 tabs), Creation Gallery, Calendar, Accounts, Raw Library, Campaigns, Links
e2e/                   Playwright flow checks + screenshot capture
docs/screenshots/      Review screenshots (light/dark × desktop/phone)
```

## Routes

| Route | Screen |
| --- | --- |
| `/` | **Today** — date, one next action, "Needs you / Assigned to others / Upcoming", next seven days, accounts used today, recently active ideas, focus by account or campaign |
| `/ideas` | **Ideas** — media-led grid; filter by status, campaign, account, text; sort; active/archived |
| `/ideas/:id` | **Idea · Overview** — concept, script, shot list, versions summary, people, references, live links & learning notes |
| `/ideas/:id/assets` | **Idea · Assets** — raw/cutaway/photo/audio/cover (plus any finished videos this idea uses, marked *Finished · Creation Gallery*), selects, moments, duplicates, music rights, promote to Raw Library, demo uploader |
| `/ideas/:id/versions?v=` | **Idea · Versions** — one row per account, grouped by platform; **finished-video picker** (an existing finished video, or one from this device, session only) with an in-page player; approximate post preview, cover pick, captions per language, on-screen text plan, checklist, schedule, honest posting |
| `/ideas/:id/tasks` | **Idea · Tasks** — owner, stage, due, per-version tasks, stage progress |
| `/gallery` | **Creation Gallery** — finished posts and planned versions by day across all platforms and accounts; rounded tiles with a platform-coloured border, a top label (“Instagram · Reel”, “YouTube · Long video”, “Instagram · Carousel”…), account, status and parent idea; *All accounts* + one filter per account (`?account=<id>`), status filter, order (*From today* / newest / oldest) |
| `/gallery/:versionId` | **Opened creation** — plays the finished video or pages through the photos inside Haven; account, caption (per language), date, status, related idea and its other versions; **Open posted video/post** only when the version is Posted with a saved live URL |
| `/accounts` | **Accounts** — notebook by platform, several accounts per platform, empty platforms, room for more channels, planned-next with account filter |
| `/accounts/:id` | **Account** — this account's latest creations (gallery tiles), profile + native analytics links, sibling accounts on the same platform, planned and published versions, links |
| `/calendar` | **Calendar** — content and marketing perspectives, filters (account, platform, campaign, status, person), legend, drag to reschedule; agenda on phones |
| `/library` | **Raw Library** — source material only: original photos, audio/music, unedited clips, brand assets. In-page players for clips, storage meter, duplicate warning, search + filters (type/brand kit, campaign, platform, person, date), selection → download package. Finished posts are never listed here. |
| `/campaigns` | **Campaigns** — launches, series, sponsorships and their ideas |
| `/links` | **Links** — account pages, native analytics, published posts, affiliate/campaign, brand resources |

## The review path

Follow **“Slow mornings in the studio”** from Today → *Continue* → Versions. It has four versions: **Instagram personal (@mira.lane.demo)**, **Instagram business (@lanestudio.demo)**, **TikTok** and **YouTube** — two platforms plus two accounts on one platform, each with its own cover, caption, checklist and status.

### Two spaces: Creation Gallery and Raw Library

- **Creation Gallery** (`/gallery`) is where finished and planned posts live, day by day, for every account. Each account's version is its own tile and names the idea it came from. Open a tile to watch the video or page through the photos inside Haven. A version marked *Posted* with a saved live URL gets an **Open posted video/post** button; nothing else suggests it has been published.
- **Raw Library** (`/library`) holds source material only: original photos, audio and music, unedited clips and brand assets.

### Finished-video flow

1. **Idea → Versions → Finished video.** Pick a finished video another version already uses, or choose one *From this device*. The device file plays from a browser-local URL and is labelled *From this device · session only. Not uploaded or stored online.*
2. **One file, many accounts.** The three vertical versions of “Slow mornings” (both Instagram accounts and TikTok) share **one** finished file. Picking the same video for another account adds a reference, never a copy, and the version lists the other accounts using it.
3. **Creation Gallery.** Every account's tile plays that same file. Filter to one account, or open a tile to play it with its caption, status and idea.

Two small sample videos (`public/demo-media/*.webm`, “HAVEN DEMO SAMPLE — not real footage” burned in) are bundled so the seeded creations have something to play. They are regenerated with `node scripts/make-demo-videos.mjs`.

## Screenshots

All 48 review screenshots (12 screens × light/dark × desktop/phone) are in [`docs/screenshots/`](docs/screenshots/). Regenerate with `npm run screenshots`.

| Light | Dark |
| --- | --- |
| ![Today, light](docs/screenshots/light-desktop-today.jpg) | ![Today, dark](docs/screenshots/dark-desktop-today.jpg) |
| ![Creation Gallery, light](docs/screenshots/light-desktop-gallery.jpg) | ![Creation Gallery filtered to one account, dark](docs/screenshots/dark-desktop-gallery-account.jpg) |
| ![Opened creation, light](docs/screenshots/light-desktop-creation.jpg) | ![Opened creation, dark](docs/screenshots/dark-desktop-creation.jpg) |
| ![Raw Library, light](docs/screenshots/light-desktop-library.jpg) | ![Versions, dark](docs/screenshots/dark-desktop-idea-versions.jpg) |

| Phone · Gallery | Phone · One account | Phone · Opened creation | Phone · Raw Library |
| --- | --- | --- | --- |
| ![](docs/screenshots/light-phone-gallery.jpg) | ![](docs/screenshots/dark-phone-gallery-account.jpg) | ![](docs/screenshots/light-phone-creation.jpg) | ![](docs/screenshots/dark-phone-library.jpg) |

## Honest states

The prototype never implies something happened that didn't:

- **Uploads** are simulated; nothing leaves the browser. Progress, pause/resume, an interruption and retry are shown, and results are tagged *Session only*. A **video chosen from the device** gets a browser-local URL so it can play in the page, and is labelled *From this device · session only. Not uploaded or stored online; gone when you reload.*
- **Bundled sample videos** are labelled *Demo sample bundled with the prototype, not real footage*. Seeded clips without a file say *Placeholder only*.
- **Selecting a finished video** doesn't post anything. Unposted creations say *Not published. Haven prepares posts but never publishes them.* The *Open posted video/post* button appears only for versions marked Posted with a live URL the creator saved.
- **Downloads and download packages** show what would be produced but produce no files.
- **Storage** numbers are labelled *Demo figures*. "Add storage" is disabled until billing exists. Nothing is ever deleted automatically.
- **Posting**: Haven doesn't publish. A version becomes *Posted* only when you paste the live URL after posting natively; the link is then recorded in Links.
- **Analytics** links open the platform. Haven doesn't import or display analytics.
- **Accounts** are links only — no sign-in, no connection.
- **Deleting an idea** lists which files are kept (Raw Library originals and files shared with other ideas) and which go with it.
- The **post preview** is labelled approximate.

## Known limitations (by design for Milestone 1)

- No persistence beyond the theme: all edits reset on reload.
- No auth, workspaces, roles, database, object storage, real uploads/downloads, or quota enforcement (Milestone 2).
- No review links, timestamped review comments, version comparison, approvals, ready-to-post bundles, recurring templates, or billing (Milestone 3). The History idea tab is folded into Overview's "Live links & learning".
- Media is generated artwork, not real footage; the post preview is a rough frame per platform, not the platform's renderer.
- Device videos last only for the open tab (browser object URLs). File sizes are demo figures, not the sample files' real size. The bundled samples are recorded in the browser and don't report a duration, so their seek bar is limited.
- Calendar drag-and-drop uses native HTML drag events (mouse); on touch devices, reschedule from the version's date field.
- Captions, tags and schedule are editable; concept, script, references and on-screen text are read-only in this prototype.
- Fonts and colours are provisional pending design review.
