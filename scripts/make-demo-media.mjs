/**
 * Generates the synthetic sample media bundled with the Haven preview
 * (public/demo-media). Every still and clip is painted on a canvas by
 * scripts/demo-media/scenes.js and carries a small "Haven sample" mark:
 * no real photos, footage or creator media.
 *
 * Uses headless Chromium's canvas + MediaRecorder, so no ffmpeg is needed.
 * Run: node scripts/make-demo-media.mjs [--stills] [--only=file]
 * (Set PLAYWRIGHT_CHROMIUM_EXECUTABLE if Playwright's browser isn't installed.)
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const stillsOnly = process.argv.includes('--stills');
/** --only=file.jpg renders just that file. */
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

/** Photos and video posters (JPEG). Posters use the clip's opening look. */
const stills = [
  { file: 'desk-notebook.jpg', scene: 'deskNotebook', w: 1080, h: 1350 },
  { file: 'desk-lamp.jpg', scene: 'deskLamp', w: 1080, h: 1350 },
  { file: 'desk-plant.jpg', scene: 'deskPlant', w: 1080, h: 1350 },
  { file: 'cafe-cup.jpg', scene: 'cafeCup', w: 1080, h: 1350 },
  { file: 'cafe-table.jpg', scene: 'cafeTable', w: 1080, h: 1350 },
  { file: 'packing.jpg', scene: 'packing', w: 1080, h: 1350 },
  { file: 'market-vertical.jpg', scene: 'market', w: 720, h: 1280, poster: true },
  { file: 'market-wide.jpg', scene: 'market', w: 1280, h: 720, poster: true },
  { file: 'morning-vertical.jpg', scene: 'morning', w: 720, h: 1280, poster: true },
  { file: 'morning-wide.jpg', scene: 'morning', w: 1280, h: 720, poster: true },
  { file: 'quiet-places-vertical.jpg', scene: 'readingRoom', w: 720, h: 1280, poster: true },
];

const clips = [
  { file: 'market-vertical.webm', scene: 'market', w: 540, h: 960 },
  { file: 'morning-vertical.webm', scene: 'morning', w: 540, h: 960 },
  { file: 'morning-wide.webm', scene: 'morning', w: 960, h: 540 },
  { file: 'quiet-places-vertical.webm', scene: 'readingRoom', w: 540, h: 960 },
];

await mkdir('public/demo-media', { recursive: true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.addScriptTag({ path: new URL('./demo-media/scenes.js', import.meta.url).pathname });

for (const s of stills.filter((x) => !only || x.file === only)) {
  const mark = s.poster ? 'Haven sample · not real footage' : 'Haven sample · not a real photo';
  const url = await page.evaluate(({ scene, w, h, mark }) => window.renderStill(scene, w, h, 0, mark), { ...s, mark });
  await writeFile(`public/demo-media/${s.file}`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote public/demo-media/${s.file}`);
}

if (!stillsOnly) {
  for (const c of clips.filter((x) => !only || x.file === only)) {
    const base64 = await page.evaluate(({ scene, w, h }) => window.recordClip(scene, w, h, 6), c);
    await writeFile(`public/demo-media/${c.file}`, Buffer.from(base64, 'base64'));
    console.log(`wrote public/demo-media/${c.file}`);
  }
}

await browser.close();
