/**
 * Generates the small sample videos bundled with the Milestone 1 demo
 * (public/demo-media/*.webm). They are original synthetic animations with
 * "HAVEN DEMO SAMPLE" burned in — no real creator footage.
 *
 * Uses headless Chromium's canvas + MediaRecorder, so no ffmpeg is needed.
 * Run: node scripts/make-demo-videos.mjs
 * (Set PLAYWRIGHT_CHROMIUM_EXECUTABLE if Playwright's browser isn't installed.)
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const outputs = [
  { file: 'public/demo-media/market-vertical.webm', w: 360, h: 640, title: 'Night market phrases', sub: 'Sample video · 9:16', hue: 18, hue2: 185 },
  { file: 'public/demo-media/morning-vertical.webm', w: 360, h: 640, title: 'A quiet morning', sub: 'Sample video · 9:16', hue: 28, hue2: 250 },
  { file: 'public/demo-media/morning-wide.webm', w: 640, h: 360, title: 'A quiet morning', sub: 'Sample long cut · 16:9', hue: 30, hue2: 235 },
  { file: 'public/demo-media/quiet-places-vertical.webm', w: 360, h: 640, title: 'Quiet places to work', sub: 'Sample video · 9:16', hue: 245, hue2: 200 },
];

await mkdir('public/demo-media', { recursive: true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();

for (const o of outputs) {
  const base64 = await page.evaluate(async ({ w, h, title, sub, hue, hue2 }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 450_000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const seconds = 6;
    const frames = seconds * 30;
    rec.start();
    for (let f = 0; f < frames; f++) {
      const t = f / frames;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, `hsl(${hue + t * 10} 72% ${58 + t * 8}%)`);
      sky.addColorStop(1, `hsl(${hue2} 45% ${20 + t * 6}%)`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // rising sun
      ctx.fillStyle = 'hsl(48 90% 82%)';
      ctx.beginPath();
      ctx.arc(w * 0.66, h * (0.62 - t * 0.28), Math.min(w, h) * 0.17, 0, Math.PI * 2);
      ctx.fill();
      // window frame
      ctx.strokeStyle = 'rgba(255,240,220,0.45)';
      ctx.lineWidth = 5;
      ctx.strokeRect(w * 0.1, h * 0.12, w * 0.34, h * 0.42);
      ctx.beginPath();
      ctx.moveTo(w * 0.27, h * 0.12);
      ctx.lineTo(w * 0.27, h * 0.54);
      ctx.stroke();
      // table + steaming mug
      ctx.fillStyle = 'hsl(250 40% 14%)';
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
      ctx.fillStyle = 'hsl(205 55% 55%)';
      ctx.fillRect(w * 0.44, h * 0.66, w * 0.12, h * 0.09);
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 20)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.64);
      ctx.bezierCurveTo(w * 0.47, h * 0.6, w * 0.53, h * 0.57, w * 0.5, h * 0.53);
      ctx.stroke();
      // labels
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `600 ${Math.round(Math.min(w, h) * 0.075)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, h * 0.8);
      ctx.font = `500 ${Math.round(Math.min(w, h) * 0.04)}px sans-serif`;
      ctx.fillText(sub, w / 2, h * 0.86);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, h - 26, w, 26);
      ctx.fillStyle = '#fff';
      ctx.font = '600 12px sans-serif';
      ctx.fillText('HAVEN DEMO SAMPLE — not real footage', w / 2, h - 9);
      await new Promise((r) => setTimeout(r, 1000 / 30));
    }
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer();
    let bin = '';
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }, o);
  await writeFile(o.file, Buffer.from(base64, 'base64'));
  console.log(`wrote ${o.file}`);
}

await browser.close();
