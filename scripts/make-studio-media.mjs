/**
 * Generates the Video Studio samples (public/demo-media/studio):
 *
 * - morning-long.webm: a genuinely one-hour, seekable long-form sample at one
 *   frame per second, with six chapters and a burned-in timecode, so seeking,
 *   chapters and notes can be tested at long-video scale. Kept small: mostly
 *   still frames, a keyframe every 30 s.
 * - market-draft1.webm / market-draft2.webm: two cuts of a short vertical
 *   video. Draft 2 removes a pause, so its timing differs from Draft 1.
 *
 * Frames are painted on a canvas and encoded offline with WebCodecs in
 * headless Chromium (faster than real time), then muxed into WebM with cues
 * for seeking. Every frame carries a "Haven sample · not real footage" mark.
 *
 * Run: node scripts/make-studio-media.mjs [--only=name]
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { ArrayBufferTarget, Muxer } from 'webm-muxer';

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

export const LONG_CHAPTERS = [
  { start: 0, title: 'Welcome and the plan' },
  { start: 240, title: 'Setting up the desk' },
  { start: 840, title: 'Tea and the first quiet hour' },
  { start: 1680, title: 'Midpoint: what changed this week' },
  { start: 2040, title: 'Deep work, in real time' },
  { start: 3120, title: 'Wrap-up and next week' },
];

/** Draft 2 of the long video: the editor trimmed a minute from the welcome. */
export const LONG_CHAPTERS_2 = LONG_CHAPTERS.map((c, i) => ({ ...c, start: i === 0 ? 0 : c.start - 60 }));

const jobs = [
  { name: 'morning-long', kind: 'long', w: 640, h: 360, fps: 1, seconds: 3600, bitrate: 9_000, keyEvery: 30, chapters: LONG_CHAPTERS, tag: 'DRAFT 1' },
  { name: 'morning-long-2', kind: 'long', w: 640, h: 360, fps: 1, seconds: 3540, bitrate: 9_000, keyEvery: 30, chapters: LONG_CHAPTERS_2, tag: 'DRAFT 2' },
  { name: 'market-final', kind: 'short', w: 360, h: 640, fps: 24, seconds: 26, bitrate: 320_000, keyEvery: 48, draft: 'final' },
  { name: 'market-draft1', kind: 'short', w: 360, h: 640, fps: 24, seconds: 30, bitrate: 320_000, keyEvery: 48, draft: 1 },
  { name: 'market-draft2', kind: 'short', w: 360, h: 640, fps: 24, seconds: 26, bitrate: 320_000, keyEvery: 48, draft: 2 },
].filter((j) => !only || j.name === only);

await mkdir('public/demo-media/studio', { recursive: true });
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
// WebCodecs needs a secure context.
await page.route('https://haven.local/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>studio media</title>' }));
await page.goto('https://haven.local/');
await page.addScriptTag({ path: new URL('./demo-media/scenes.js', import.meta.url).pathname });

for (const job of jobs) {
  const encoded = await page.evaluate(
    async ({ job }) => {
      const chapters = job.chapters ?? [];
      const canvas = document.createElement('canvas');
      canvas.width = job.w;
      canvas.height = job.h;
      const ctx = canvas.getContext('2d');
      const chunks = [];
      let decoderConfig = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          if (meta?.decoderConfig && !decoderConfig) decoderConfig = { codec: meta.decoderConfig.codec };
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          let bin = '';
          for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
          chunks.push({ type: chunk.type, timestamp: chunk.timestamp, duration: chunk.duration, data: btoa(bin) });
        },
        error: (e) => {
          throw e;
        },
      });
      encoder.configure({ codec: 'vp8', width: job.w, height: job.h, bitrate: job.bitrate, framerate: job.fps, bitrateMode: 'variable' });

      const pad = (n) => String(n).padStart(2, '0');
      const tc = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
      const palette = ['#2a44b0', '#1f7a63', '#b3442a', '#3a2f6b', '#93600a', '#22388f'];

      const drawLong = (sec) => {
        const ci = chapters.reduce((acc, c, i) => (sec >= c.start ? i : acc), 0);
        const ch = chapters[ci];
        const next = chapters[ci + 1]?.start ?? job.seconds;
        const { w, h } = job;
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, palette[ci]);
        g.addColorStop(1, '#141311');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // A slow sun so playback visibly moves.
        const k = (sec - ch.start) / (next - ch.start);
        ctx.fillStyle = 'rgba(255, 220, 160, 0.85)';
        ctx.beginPath();
        ctx.arc(w * (0.12 + 0.76 * k), h * (0.36 - 0.12 * Math.sin(Math.PI * k)), 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = '600 13px Inter, Arial, sans-serif';
        ctx.fillText(`CHAPTER ${ci + 1} OF ${chapters.length}  ·  ${job.tag}`, 32, 48);
        ctx.fillStyle = '#fff';
        ctx.font = '400 34px Georgia, serif';
        ctx.fillText(ch.title, 32, 92);
        ctx.font = '700 64px Inter, Arial, sans-serif';
        ctx.fillText(tc(sec), 32, h - 92);
        ctx.font = '500 13px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`of ${tc(job.seconds)} · Haven long-form sample`, 34, h - 66);
        // Progress with chapter ticks.
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(32, h - 44, w - 64, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(32, h - 44, (w - 64) * (sec / job.seconds), 4);
        for (const c of chapters) ctx.fillRect(32 + (w - 64) * (c.start / job.seconds), h - 50, 2, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, h - 22, w, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 11px Inter, Arial, sans-serif';
        ctx.fillText('Haven sample · not real footage', 10, h - 7);
      };

      // Draft 1 has a 4-second pause after phrase 2; Draft 2 removes it.
      const cards = job.draft === 1
        ? [[0, 3, 'Five phrases for a night market'], [3, 7, '1 · “One of these, please.”'], [7, 9, '2 · “Not too spicy.”'], [9, 13, '…'], [13, 17, '3 · “How much is it?”'], [17, 21, '4 · “To go, please.”'], [21, 26, '5 · “That was delicious!”'], [26, 30, 'Save this for your next trip']]
        : [[0, 3, 'Five phrases for a night market'], [3, 6, '1 · “One of these, please.”'], [6, 9, '2 · “Not too spicy.”'], [9, 13, '3 · “How much is it?”'], [13, 17, '4 · “To go, please.”'], [17, 22, '5 · “That was delicious!”'], [22, 26, 'Save this for your next trip']];
      const drawShort = (sec, frame) => {
        window.paintFrame(canvas, 'market', (sec % 6) / 6, frame, 'Haven sample · not real footage');
        const card = cards.find(([a, b]) => sec >= a && sec < b);
        const { w, h } = job;
        if (card) {
          ctx.fillStyle = 'rgba(14,14,18,0.6)';
          ctx.beginPath();
          ctx.roundRect(18, h * 0.62, w - 36, 64, 12);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = '600 19px Inter, Arial, sans-serif';
          ctx.fillText(card[2], 30, h * 0.62 + 40, w - 60);
        }
        ctx.fillStyle = 'rgba(14,14,18,0.55)';
        ctx.beginPath();
        ctx.roundRect(w - 118, 14, 104, 26, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '600 12px Inter, Arial, sans-serif';
        ctx.fillText(`${job.draft === 'final' ? 'FINAL' : `DRAFT ${job.draft}`} · ${tc(sec).slice(3)}`, w - 108, 32);
      };

      // One closing frame at the very end, so the reported duration is the full length.
      const total = job.seconds * job.fps + 1;
      for (let f = 0; f < total; f++) {
        const sec = Math.min(f / job.fps, job.seconds - 1 / job.fps);
        if (job.kind === 'long') drawLong(sec);
        else drawShort(sec, f);
        const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / job.fps), duration: Math.round(1e6 / job.fps) });
        encoder.encode(frame, { keyFrame: f % job.keyEvery === 0 });
        frame.close();
        if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
      }
      await encoder.flush();
      return { chunks, decoderConfig };
    },
    { job },
  );

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'V_VP8', width: job.w, height: job.h, frameRate: job.fps },
    firstTimestampBehavior: 'strict',
  });
  for (const c of encoded.chunks) {
    muxer.addVideoChunkRaw(Buffer.from(c.data, 'base64'), c.type, c.timestamp, encoded.decoderConfig ? { decoderConfig: encoded.decoderConfig } : undefined);
  }
  muxer.finalize();
  const bytes = Buffer.from(muxer.target.buffer);
  await writeFile(`public/demo-media/studio/${job.name}.webm`, bytes);
  console.log(`wrote public/demo-media/studio/${job.name}.webm (${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${encoded.chunks.length} frames)`);
}

await browser.close();
