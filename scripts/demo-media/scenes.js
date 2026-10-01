/*
 * Browser-side painter for Haven's synthetic sample media.
 *
 * Every still and clip in public/demo-media is painted here on a canvas:
 * soft light, depth of field, film grain. They are meant to read as calm,
 * photographic studio media without being real photos or footage, and each
 * one carries a small burned-in "Haven sample" mark.
 *
 * Loaded into headless Chromium by scripts/make-demo-media.mjs.
 */
(() => {
  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  function layer(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  /** Gaussian blur without the transparent fringe at the edges. */
  function blurred(src, px) {
    const pad = Math.ceil(px * 3);
    const w = src.width;
    const h = src.height;
    const big = layer(w + pad * 2, h + pad * 2, (x) => {
      x.drawImage(src, 0, 0, w + pad * 2, h + pad * 2);
      x.drawImage(src, pad, pad);
    });
    return layer(w, h, (x) => {
      x.filter = `blur(${px}px)`;
      x.drawImage(big, -pad, -pad);
    });
  }

  const grainCache = new Map();
  function grain(ctx, w, h, amount, frame = 0) {
    const key = `${w}x${h}:${frame % 3}`;
    if (!grainCache.has(key)) {
      const r = rng(97 + (frame % 3));
      grainCache.set(
        key,
        layer(w, h, (x) => {
          const img = x.createImageData(w, h);
          for (let i = 0; i < img.data.length; i += 4) {
            const v = 128 + (r() + r() + r() - 1.5) * 120;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = 255;
          }
          x.putImageData(img, 0, 0);
        }),
      );
    }
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    ctx.drawImage(grainCache.get(key), 0, 0);
    ctx.restore();
  }

  function vignette(ctx, w, h, strength, cx = 0.5, cy = 0.5) {
    const g = ctx.createRadialGradient(w * cx, h * cy, Math.min(w, h) * 0.25, w * cx, h * cy, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function wash(ctx, w, h, color, alpha, mode) {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function glow(ctx, x, y, r, color, alpha, mode = 'screen') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', alpha));
    g.addColorStop(1, color.replace('A', 0));
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /** A soft cast shadow for any path. */
  function shadow(ctx, path, blur, alpha, dx = 0, dy = 0, color = '30,20,12') {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.translate(dx, dy);
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    return (c) => c.roundRect(x, y, w, h, r);
  }

  function woodGrain(ctx, x0, y0, w, h, seed, color, count, vertical = false) {
    const r = rng(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    for (let i = 0; i < count; i++) {
      const p = r();
      const amp = (vertical ? w : h) * (0.004 + r() * 0.01);
      const freq = 1 + r() * 3;
      ctx.strokeStyle = `rgba(${color},${0.04 + r() * 0.1})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      for (let s = 0; s <= 40; s++) {
        const u = s / 40;
        const off = Math.sin(u * TAU * freq + p * 20) * amp;
        if (vertical) ctx.lineTo(x0 + p * w + off, y0 + u * h);
        else ctx.lineTo(x0 + u * w, y0 + p * h + off);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function watermark(ctx, w, h, text) {
    const size = Math.max(9, Math.round(Math.min(w, h) * 0.017));
    ctx.save();
    ctx.font = `600 ${size}px Inter, "Helvetica Neue", Arial, sans-serif`;
    const tw = ctx.measureText(text).width;
    const pad = size * 0.55;
    const x = size * 1.1;
    const y = h - size * 1.1;
    ctx.fillStyle = 'rgba(12,12,14,0.32)';
    ctx.beginPath();
    ctx.roundRect(x - pad, y - size - pad * 0.55, tw + pad * 2, size + pad * 1.3, size * 0.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function steam(ctx, x, y, u, t, wisps = 3, alpha = 0.22) {
    ctx.save();
    ctx.filter = `blur(${u * 0.018}px)`;
    ctx.lineCap = 'round';
    for (let i = 0; i < wisps; i++) {
      const ph = t * TAU + i * 2.1;
      const sx = x + (i - (wisps - 1) / 2) * u * 0.035;
      ctx.strokeStyle = `rgba(255,250,244,${alpha * (0.7 + 0.3 * Math.sin(ph))})`;
      ctx.lineWidth = u * 0.022;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.bezierCurveTo(sx - u * 0.05 * Math.sin(ph), y - u * 0.09, sx + u * 0.06 * Math.cos(ph), y - u * 0.16, sx + u * 0.02 * Math.sin(ph * 1.3), y - u * 0.26);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ─────────────────────────── Night market ─────────────────────────── */

  const cache = new Map();
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }

  function market(ctx, w, h, t) {
    const u = Math.min(w, h);
    const wide = w > h;
    const bg = cached(`market-bg-${w}x${h}`, () => {
      const r = rng(11);
      const base = layer(w, h, (x) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0b1438');
        g.addColorStop(0.55, '#1f1a2a');
        g.addColorStop(1, '#100d0d');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        glow(x, w * 0.5, h * 0.56, Math.max(w, h) * 0.7, 'rgba(255,168,92,A)', 0.2);
        const stalls = wide ? 7 : 5;
        for (let i = 0; i < stalls; i++) {
          const sw = w / (stalls - 1.2);
          const sx = i * sw - sw * 0.35 + r() * sw * 0.2;
          const top = h * (0.4 + r() * 0.05);
          const bottom = h * 0.66;
          x.fillStyle = '#0d0d11';
          x.beginPath();
          x.moveTo(sx - sw * 0.06, top);
          x.lineTo(sx + sw * 1.06, top);
          x.lineTo(sx + sw * 0.96, top + h * 0.05);
          x.lineTo(sx + sw * 0.04, top + h * 0.05);
          x.fill();
          const lit = x.createLinearGradient(0, top + h * 0.05, 0, bottom);
          lit.addColorStop(0, `rgba(242,160,84,${0.45 + r() * 0.25})`);
          lit.addColorStop(1, 'rgba(110,56,30,0.35)');
          x.fillStyle = lit;
          x.fillRect(sx + sw * 0.06, top + h * 0.05, sw * 0.86, bottom - top - h * 0.05);
          for (let k = 0; k < 6; k++) {
            x.fillStyle = `rgba(${40 + r() * 60},${24 + r() * 30},${16 + r() * 20},0.7)`;
            x.fillRect(sx + sw * (0.1 + k * 0.13), bottom - h * (0.03 + r() * 0.05), sw * 0.1, h * 0.08);
          }
        }
        for (let i = 0; i < (wide ? 12 : 8); i++) {
          const px = r() * w;
          const ph = u * (0.2 + r() * 0.1);
          const py = h * 0.74 - ph;
          x.fillStyle = 'rgba(10,9,12,0.92)';
          x.beginPath();
          x.ellipse(px, py, ph * 0.12, ph * 0.14, 0, 0, TAU);
          x.fill();
          x.beginPath();
          x.roundRect(px - ph * 0.2, py + ph * 0.14, ph * 0.4, ph * 0.9, ph * 0.14);
          x.fill();
        }
      });
      return blurred(base, u * 0.02);
    });
    ctx.drawImage(bg, 0, 0);

    // Out-of-focus lanterns and lights.
    const r = rng(23);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < (wide ? 46 : 34); i++) {
      const x = r() * w + Math.sin(t * TAU + i) * u * 0.012;
      const y = h * (0.04 + r() * 0.56);
      const rad = u * (0.018 + r() * 0.06);
      const pick = r();
      const col = pick < 0.62 ? '255,178,98' : pick < 0.86 ? '255,226,184' : pick < 0.95 ? '222,92,60' : '120,190,186';
      const a = (0.16 + r() * 0.28) * (0.9 + 0.1 * Math.sin(t * TAU * 2 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${col},${a * 0.9})`);
      g.addColorStop(0.82, `rgba(${col},${a * 0.7})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // String lights in focus.
    [
      [0.08, 0.14, 0.09],
      [0.2, 0.12, 0.06],
    ].forEach(([y0, y1, sag], row) => {
      const at = (s) => [lerp(-0.05, 1.05, s) * w, (lerp(y0, y1, s) + Math.sin(s * Math.PI) * sag) * h];
      ctx.save();
      ctx.strokeStyle = 'rgba(20,18,18,0.9)';
      ctx.lineWidth = Math.max(1, u * 0.003);
      ctx.beginPath();
      for (let s = 0; s <= 30; s++) ctx.lineTo(...at(s / 30));
      ctx.stroke();
      const n = wide ? 14 : 9;
      for (let i = 0; i <= n; i++) {
        const [bx, by] = at((i + 0.3 * row) / n);
        const f = 0.8 + 0.2 * Math.sin(t * TAU * 3 + i * 1.7 + row);
        ctx.shadowColor = `rgba(255,186,110,${0.9 * f})`;
        ctx.shadowBlur = u * 0.035;
        ctx.fillStyle = `rgba(255,238,206,${f})`;
        ctx.beginPath();
        ctx.arc(bx, by + u * 0.01, u * 0.007, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });

    // The paper lantern in focus.
    const lx = w * (wide ? 0.7 : 0.68);
    const ly = h * (wide ? 0.4 : 0.36);
    const rx = u * 0.13;
    const ry = u * 0.16;
    glow(ctx, lx, ly, rx * 3.4, 'rgba(255,146,76,A)', 0.4);
    ctx.save();
    ctx.translate(lx, ly - ry * 1.9);
    ctx.rotate(Math.sin(t * TAU) * 0.03);
    ctx.translate(0, ry * 1.9);
    ctx.strokeStyle = 'rgba(24,18,16,0.95)';
    ctx.lineWidth = Math.max(1, u * 0.004);
    ctx.beginPath();
    ctx.moveTo(0, -ry * 1.1);
    ctx.lineTo(0, -h);
    ctx.stroke();
    const body = ctx.createRadialGradient(-rx * 0.25, -ry * 0.15, 0, 0, 0, ry * 1.05);
    body.addColorStop(0, '#ffe3ad');
    body.addColorStop(0.45, '#f0914c');
    body.addColorStop(1, '#a93c1f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,36,18,0.35)';
    ctx.lineWidth = u * 0.004;
    [0.25, 0.55, 0.82].forEach((k) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * k, ry, 0, 0, TAU);
      ctx.stroke();
    });
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.ellipse(0, (k / 3.4) * ry, rx * Math.sqrt(1 - (k / 3.4) ** 2), ry * 0.03, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#23160f';
    ctx.beginPath();
    ctx.roundRect(-rx * 0.42, -ry * 1.06, rx * 0.84, ry * 0.14, u * 0.006);
    ctx.roundRect(-rx * 0.42, ry * 0.93, rx * 0.84, ry * 0.14, u * 0.006);
    ctx.fill();
    ctx.strokeStyle = '#7e2a1b';
    ctx.lineWidth = u * 0.008;
    ctx.beginPath();
    ctx.moveTo(0, ry * 1.07);
    ctx.lineTo(Math.sin(t * TAU + 1) * u * 0.006, ry * 1.5);
    ctx.stroke();
    ctx.restore();

    // Counter and a steaming bowl.
    const cy = h * (wide ? 0.76 : 0.79);
    const cg = ctx.createLinearGradient(0, cy, 0, h);
    cg.addColorStop(0, '#34231a');
    cg.addColorStop(1, '#130d0a');
    ctx.fillStyle = cg;
    ctx.fillRect(0, cy, w, h - cy);
    woodGrain(ctx, 0, cy, w, h - cy, 5, '255,200,150', 26);
    ctx.fillStyle = 'rgba(255,196,128,0.32)';
    ctx.fillRect(0, cy, w, Math.max(1, u * 0.004));
    glow(ctx, w * 0.38, cy + u * 0.04, u * 0.5, 'rgba(255,170,96,A)', 0.22);

    const bx = w * (wide ? 0.34 : 0.34);
    const by = cy + u * 0.07;
    const br = u * 0.15;
    shadow(ctx, (c) => c.ellipse(bx + br * 0.1, by + br * 0.42, br * 1.05, br * 0.2, 0, 0, TAU), u * 0.02, 0.6);
    const bowl = ctx.createLinearGradient(bx - br, 0, bx + br, 0);
    bowl.addColorStop(0, '#9b9184');
    bowl.addColorStop(0.35, '#e3dccf');
    bowl.addColorStop(1, '#6d655b');
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * 0.26, 0, 0, Math.PI);
    ctx.bezierCurveTo(bx - br * 0.9, by + br * 0.55, bx + br * 0.9, by + br * 0.55, bx + br, by);
    ctx.fill();
    ctx.fillStyle = '#ece6da';
    ctx.beginPath();
    ctx.ellipse(bx, by, br, br * 0.26, 0, 0, TAU);
    ctx.fill();
    const broth = ctx.createRadialGradient(bx - br * 0.2, by - br * 0.05, 0, bx, by, br * 0.9);
    broth.addColorStop(0, '#d49a5a');
    broth.addColorStop(1, '#8a4f24');
    ctx.fillStyle = broth;
    ctx.beginPath();
    ctx.ellipse(bx, by + br * 0.01, br * 0.88, br * 0.2, 0, 0, TAU);
    ctx.fill();
    steam(ctx, bx, by - br * 0.1, u * 1.4, t, 3, 0.2);

    wash(ctx, w, h, '#1b2c6e', 0.2, 'soft-light');
    vignette(ctx, w, h, 0.55);
  }

  /* ─────────────────────── Morning desk by a window ────────────────────── */

  function morning(ctx, w, h, t) {
    const u = Math.min(w, h);
    const wide = w > h;
    const top = h * (wide ? 0.6 : 0.64);
    const front = h * (wide ? 0.86 : 0.86);
    const base = cached(`morning-bg-${w}x${h}`, () =>
      layer(w, h, (x) => {
        const wall = x.createLinearGradient(0, 0, w, 0);
        wall.addColorStop(0, '#efe7da');
        wall.addColorStop(1, '#d6ccbd');
        x.fillStyle = wall;
        x.fillRect(0, 0, w, top);
        const shade = x.createLinearGradient(0, 0, 0, top);
        shade.addColorStop(0, 'rgba(90,70,50,0.14)');
        shade.addColorStop(1, 'rgba(90,70,50,0)');
        x.fillStyle = shade;
        x.fillRect(0, 0, w, top);
        const desk = x.createLinearGradient(0, top, 0, front);
        desk.addColorStop(0, '#d7b98f');
        desk.addColorStop(1, '#bd956a');
        x.fillStyle = desk;
        x.fillRect(0, top, w, front - top);
        woodGrain(x, 0, top, w, front - top, 3, '120,78,40', 70);
        x.fillStyle = '#9f774e';
        x.fillRect(0, front, w, u * 0.03);
        x.fillStyle = 'rgba(255,240,220,0.45)';
        x.fillRect(0, front, w, Math.max(1, u * 0.003));
        const floor = x.createLinearGradient(0, front, 0, h);
        floor.addColorStop(0, '#3a3029');
        floor.addColorStop(1, '#2a231e');
        x.fillStyle = floor;
        x.fillRect(0, front + u * 0.03, w, h);
        x.save();
        x.filter = `blur(${u * 0.01}px)`;
        x.fillStyle = 'rgba(60,40,20,0.28)';
        x.fillRect(0, top - u * 0.004, w, u * 0.01);
        x.restore();
      }),
    );
    ctx.drawImage(base, 0, 0);

    // Window light on the wall, with its frame and a plant's shadow.
    const drift = t * 0.05;
    const quad = [
      [w * (0.06 + drift), h * 0.1],
      [w * (0.06 + drift) + w * (wide ? 0.34 : 0.48), h * 0.06],
      [w * (0.12 + drift) + w * (wide ? 0.34 : 0.48), top * 0.9],
      [w * (0.12 + drift), top * 0.96],
    ];
    const qp = (a, b) => {
      const tpx = lerp(quad[0][0], quad[1][0], a);
      const tpy = lerp(quad[0][1], quad[1][1], a);
      const bpx = lerp(quad[3][0], quad[2][0], a);
      const bpy = lerp(quad[3][1], quad[2][1], a);
      return [lerp(tpx, bpx, b), lerp(tpy, bpy, b)];
    };
    ctx.save();
    ctx.filter = `blur(${u * 0.012}px)`;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,228,184,0.62)';
    ctx.beginPath();
    quad.forEach((p) => ctx.lineTo(...p));
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${u * 0.006}px)`;
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = 'rgba(160,128,96,0.5)';
    ctx.lineWidth = u * 0.018;
    ctx.beginPath();
    ctx.moveTo(...qp(0.5, 0));
    ctx.lineTo(...qp(0.5, 1));
    ctx.moveTo(...qp(0, 0.5));
    ctx.lineTo(...qp(1, 0.5));
    ctx.stroke();
    ctx.filter = `blur(${u * 0.014}px)`;
    const lr = rng(8);
    ctx.fillStyle = 'rgba(120,104,80,0.3)';
    for (let i = 0; i < 9; i++) {
      const [px, py] = qp(0.1 + lr() * 0.35, 0.55 + lr() * 0.45);
      ctx.beginPath();
      ctx.ellipse(px + Math.sin(t * TAU + i) * u * 0.006, py, u * 0.07, u * 0.022, -0.6 + lr() * 1.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Light landing on the desk.
    ctx.save();
    ctx.filter = `blur(${u * 0.02}px)`;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,226,180,0.34)';
    ctx.beginPath();
    ctx.moveTo(w * (0.05 + drift), top);
    ctx.lineTo(w * (0.5 + drift), top);
    ctx.lineTo(w * (0.72 + drift), front);
    ctx.lineTo(w * (0.12 + drift), front);
    ctx.fill();
    ctx.restore();

    const deskY = (k) => lerp(top, front, k);

    // Plant, left.
    const px = w * (wide ? 0.2 : 0.18);
    const pb = deskY(0.42);
    const pw = u * 0.13;
    const ph = u * 0.14;
    shadow(ctx, (c) => c.ellipse(px + pw * 0.4, pb, pw * 0.9, pw * 0.16, 0, 0, TAU), u * 0.015, 0.35);
    const lv = rng(4);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * TAU + i) * 0.02;
      const len = u * (0.16 + lv() * 0.12);
      ctx.save();
      ctx.translate(px, pb - ph);
      ctx.rotate(a + Math.PI / 2);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, '#4f6a48');
      g.addColorStop(1, i % 3 ? '#7f9a72' : '#6b8862');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.22, -len * 0.55, 0, -len);
      ctx.quadraticCurveTo(-len * 0.22, -len * 0.55, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,240,210,0.25)';
      ctx.lineWidth = u * 0.002;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -len * 0.95);
      ctx.stroke();
      ctx.restore();
    }
    const pot = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
    pot.addColorStop(0, '#d49373');
    pot.addColorStop(0.5, '#b86f4f');
    pot.addColorStop(1, '#8a4f36');
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.moveTo(px - pw / 2, pb - ph);
    ctx.lineTo(px + pw / 2, pb - ph);
    ctx.lineTo(px + pw * 0.4, pb);
    ctx.lineTo(px - pw * 0.4, pb);
    ctx.fill();
    ctx.fillStyle = '#c98262';
    ctx.fillRect(px - pw * 0.53, pb - ph, pw * 1.06, ph * 0.16);

    // Notebook with a pencil.
    const nx = w * (wide ? 0.47 : 0.48);
    const ny = deskY(0.62);
    const nw = u * (wide ? 0.44 : 0.4);
    shadow(ctx, (c) => {
      c.moveTo(nx - nw * 0.46, ny - u * 0.05);
      c.lineTo(nx + nw * 0.44, ny - u * 0.05);
      c.lineTo(nx + nw * 0.54, ny + u * 0.05);
      c.lineTo(nx - nw * 0.5, ny + u * 0.05);
    }, u * 0.012, 0.35, u * 0.012, u * 0.008);
    ctx.fillStyle = '#e3d9c7';
    ctx.beginPath();
    ctx.moveTo(nx - nw * 0.5, ny + u * 0.045);
    ctx.lineTo(nx + nw * 0.54, ny + u * 0.045);
    ctx.lineTo(nx + nw * 0.54, ny + u * 0.056);
    ctx.lineTo(nx - nw * 0.5, ny + u * 0.056);
    ctx.fill();
    const page = ctx.createLinearGradient(nx - nw / 2, 0, nx + nw / 2, 0);
    page.addColorStop(0, '#fbf6ec');
    page.addColorStop(0.48, '#ebe2d1');
    page.addColorStop(0.52, '#ebe2d1');
    page.addColorStop(1, '#f6f0e4');
    ctx.fillStyle = page;
    ctx.beginPath();
    ctx.moveTo(nx - nw * 0.46, ny - u * 0.045);
    ctx.lineTo(nx + nw * 0.44, ny - u * 0.045);
    ctx.lineTo(nx + nw * 0.54, ny + u * 0.045);
    ctx.lineTo(nx - nw * 0.5, ny + u * 0.045);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,90,0.28)';
    ctx.lineWidth = Math.max(1, u * 0.0025);
    for (let i = 0; i < 5; i++) {
      const yy = ny - u * 0.03 + i * u * 0.016;
      const k = (yy - (ny - u * 0.045)) / (u * 0.09);
      ctx.beginPath();
      ctx.moveTo(lerp(nx - nw * 0.42, nx - nw * 0.46, k), yy);
      ctx.lineTo(lerp(nx - nw * 0.1, nx - nw * 0.08, k) - (i % 2) * nw * 0.1, yy);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(nx + nw * 0.18, ny + u * 0.004);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(-nw * 0.26, -u * 0.006, nw * 0.46, u * 0.012);
    ctx.fillStyle = '#e8d2b0';
    ctx.beginPath();
    ctx.moveTo(nw * 0.2, -u * 0.006);
    ctx.lineTo(nw * 0.26, 0);
    ctx.lineTo(nw * 0.2, u * 0.006);
    ctx.fill();
    ctx.restore();

    // Mug with tea, right.
    const mx = w * (wide ? 0.74 : 0.78);
    const mb = deskY(0.48);
    const mw = u * 0.15;
    const mh = u * 0.16;
    shadow(ctx, (c) => c.ellipse(mx + mw * 0.45, mb, mw * 0.85, mw * 0.14, 0, 0, TAU), u * 0.014, 0.4);
    ctx.strokeStyle = '#2a44b0';
    ctx.lineWidth = u * 0.022;
    ctx.beginPath();
    ctx.ellipse(mx + mw * 0.5, mb - mh * 0.5, mw * 0.2, mh * 0.24, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    const mug = ctx.createLinearGradient(mx - mw / 2, 0, mx + mw / 2, 0);
    mug.addColorStop(0, '#5b7cf0');
    mug.addColorStop(0.3, '#3453d1');
    mug.addColorStop(0.8, '#233a9e');
    mug.addColorStop(1, '#172a78');
    ctx.fillStyle = mug;
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2, mb - mh);
    ctx.lineTo(mx + mw / 2, mb - mh);
    ctx.lineTo(mx + mw / 2, mb - mh * 0.1);
    ctx.quadraticCurveTo(mx + mw / 2, mb, mx + mw * 0.35, mb);
    ctx.lineTo(mx - mw * 0.35, mb);
    ctx.quadraticCurveTo(mx - mw / 2, mb, mx - mw / 2, mb - mh * 0.1);
    ctx.fill();
    ctx.fillStyle = '#e9edf8';
    ctx.beginPath();
    ctx.ellipse(mx, mb - mh, mw / 2, mw * 0.12, 0, 0, TAU);
    ctx.fill();
    const tea = ctx.createLinearGradient(mx - mw / 2, 0, mx + mw / 2, 0);
    tea.addColorStop(0, '#8a5a35');
    tea.addColorStop(1, '#4e3019');
    ctx.fillStyle = tea;
    ctx.beginPath();
    ctx.ellipse(mx, mb - mh + mw * 0.01, mw * 0.44, mw * 0.095, 0, 0, TAU);
    ctx.fill();
    steam(ctx, mx, mb - mh - u * 0.01, u, t, 3, 0.3);

    wash(ctx, w, h, '#ffd59a', 0.14, 'soft-light');
    vignette(ctx, w, h, 0.28, 0.4, 0.4);
  }

  /* ───────────────────────────── Reading room ──────────────────────────── */

  function readingRoom(ctx, w, h, t) {
    const u = Math.min(w, h);
    const wide = w > h;
    const bg = cached(`reading-bg-${w}x${h}`, () => {
      const r = rng(31);
      const base = layer(w, h, (x) => {
        x.fillStyle = '#1e1713';
        x.fillRect(0, 0, w, h);
        const palette = ['#b8432f', '#2d47b0', '#d98a2b', '#c9667c', '#e8d6b4', '#6fa3c9', '#8a3b2d', '#23357f'];
        const bay = wide ? w / 4 : w / 2.2;
        const shelfGap = h * 0.13;
        for (let bx = -bay * 0.3; bx < w; bx += bay) {
          for (let sy = h * 0.02; sy < h * 0.8; sy += shelfGap) {
            let x0 = bx + u * 0.02;
            while (x0 < bx + bay - u * 0.03) {
              const bw = u * (0.014 + r() * 0.022);
              const bh = shelfGap * (0.62 + r() * 0.3);
              const col = palette[Math.floor(r() * palette.length)];
              x.fillStyle = col;
              x.fillRect(x0, sy + shelfGap - bh, bw, bh);
              x.fillStyle = 'rgba(255,230,190,0.12)';
              x.fillRect(x0, sy + shelfGap - bh * 0.86, bw, bh * 0.03);
              x.fillStyle = 'rgba(0,0,0,0.25)';
              x.fillRect(x0 + bw - Math.max(1, bw * 0.12), sy + shelfGap - bh, Math.max(1, bw * 0.12), bh);
              x0 += bw + (r() < 0.08 ? u * 0.03 : u * 0.002);
            }
            x.fillStyle = '#3b2a1f';
            x.fillRect(bx, sy + shelfGap, bay, h * 0.012);
          }
          x.fillStyle = '#2c2019';
          x.fillRect(bx, 0, u * 0.022, h);
        }
        const dark = x.createLinearGradient(0, 0, 0, h * 0.6);
        dark.addColorStop(0, 'rgba(0,0,0,0.55)');
        dark.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = dark;
        x.fillRect(0, 0, w, h);
      });
      return blurred(base, u * 0.012);
    });
    const s = 1 + t * 0.035;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.drawImage(bg, -w / 2, -h / 2);
    ctx.restore();

    const lx = w * (wide ? 0.72 : 0.7);
    const tableY = h * (wide ? 0.72 : 0.76);
    glow(ctx, lx, tableY - u * 0.2, u * 0.95, 'rgba(255,176,96,A)', 0.38);

    const tg = ctx.createLinearGradient(0, tableY, 0, h);
    tg.addColorStop(0, '#34241a');
    tg.addColorStop(1, '#150e0a');
    ctx.fillStyle = tg;
    ctx.fillRect(0, tableY, w, h - tableY);
    woodGrain(ctx, 0, tableY, w, h - tableY, 12, '255,200,150', 30);
    glow(ctx, lx - u * 0.08, tableY + u * 0.06, u * 0.45, 'rgba(255,190,120,A)', 0.3);
    ctx.fillStyle = 'rgba(255,200,140,0.3)';
    ctx.fillRect(0, tableY, w, Math.max(1, u * 0.003));

    // Light falling from the lamp, with dust.
    ctx.save();
    ctx.filter = `blur(${u * 0.03}px)`;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,214,160,0.16)';
    ctx.beginPath();
    ctx.moveTo(lx - u * 0.1, tableY - u * 0.36);
    ctx.lineTo(lx + u * 0.1, tableY - u * 0.36);
    ctx.lineTo(lx + u * 0.26, tableY + u * 0.02);
    ctx.lineTo(lx - u * 0.36, tableY + u * 0.02);
    ctx.fill();
    ctx.restore();
    const dr = rng(5);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 40; i++) {
      const k = (dr() + t * (0.05 + dr() * 0.05)) % 1;
      const dx = lx + (dr() - 0.5) * u * 0.5 + Math.sin(t * TAU + i) * u * 0.01;
      const dy = lerp(tableY - u * 0.33, tableY, k);
      ctx.fillStyle = `rgba(255,236,200,${0.15 + dr() * 0.3})`;
      ctx.beginPath();
      ctx.arc(dx, dy, u * (0.0015 + dr() * 0.002), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Brass lamp with a green glass shade.
    const lb = tableY + u * 0.05;
    shadow(ctx, (c) => c.ellipse(lx, lb + u * 0.004, u * 0.08, u * 0.016, 0, 0, TAU), u * 0.01, 0.6);
    const brass = ctx.createLinearGradient(lx - u * 0.07, 0, lx + u * 0.07, 0);
    brass.addColorStop(0, '#5e4524');
    brass.addColorStop(0.35, '#caa464');
    brass.addColorStop(1, '#4a3519');
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.ellipse(lx, lb, u * 0.075, u * 0.018, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(lx - u * 0.006, tableY - u * 0.3, u * 0.012, lb - tableY + u * 0.3);
    const sy = tableY - u * 0.34;
    const shade = ctx.createLinearGradient(0, sy - u * 0.05, 0, sy + u * 0.04);
    shade.addColorStop(0, '#2c4034');
    shade.addColorStop(0.7, '#3f5a48');
    shade.addColorStop(1, '#1f2d25');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(lx - u * 0.05, sy - u * 0.05);
    ctx.quadraticCurveTo(lx, sy - u * 0.08, lx + u * 0.05, sy - u * 0.05);
    ctx.lineTo(lx + u * 0.13, sy + u * 0.03);
    ctx.lineTo(lx - u * 0.13, sy + u * 0.03);
    ctx.fill();
    ctx.fillStyle = '#ffdca4';
    ctx.shadowColor = 'rgba(255,200,130,0.9)';
    ctx.shadowBlur = u * 0.05;
    ctx.beginPath();
    ctx.ellipse(lx, sy + u * 0.032, u * 0.125, u * 0.012, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Open book on the table.
    const bx = w * (wide ? 0.4 : 0.34);
    const by = tableY + u * 0.1;
    const bw = u * 0.44;
    shadow(ctx, (c) => c.ellipse(bx, by + u * 0.04, bw * 0.55, u * 0.05, 0, 0, TAU), u * 0.02, 0.55);
    const pg = ctx.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
    pg.addColorStop(0, '#b9a88a');
    pg.addColorStop(0.45, '#e9dcc2');
    pg.addColorStop(0.5, '#a8987c');
    pg.addColorStop(0.55, '#f1e5cc');
    pg.addColorStop(1, '#fff1d6');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by - u * 0.03);
    ctx.quadraticCurveTo(bx - bw / 4, by - u * 0.06, bx, by - u * 0.035);
    ctx.quadraticCurveTo(bx + bw / 4, by - u * 0.06, bx + bw / 2, by - u * 0.03);
    ctx.lineTo(bx + bw / 2 + u * 0.03, by + u * 0.04);
    ctx.quadraticCurveTo(bx + bw / 4, by + u * 0.015, bx, by + u * 0.045);
    ctx.quadraticCurveTo(bx - bw / 4, by + u * 0.015, bx - bw / 2 - u * 0.03, by + u * 0.04);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,56,40,0.3)';
    ctx.lineWidth = Math.max(1, u * 0.002);
    for (let i = 0; i < 4; i++) {
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        const yy = by - u * 0.03 + i * u * 0.015;
        ctx.moveTo(bx + side * bw * 0.06, yy + u * 0.004);
        ctx.quadraticCurveTo(bx + side * bw * 0.25, yy - u * 0.008, bx + side * bw * 0.44, yy + u * 0.002);
        ctx.stroke();
      });
    }

    wash(ctx, w, h, '#1c2a66', 0.18, 'soft-light');
    vignette(ctx, w, h, 0.62, 0.6, 0.55);
  }

  /* ─────────────────────────── Top-down stills ─────────────────────────── */

  function oakTop(ctx, w, h, seed) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#dcbc93');
    g.addColorStop(1, '#c29b70');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    woodGrain(ctx, 0, 0, w, h, seed, '128,84,44', 140, true);
  }

  function sunBand(ctx, w, h, u) {
    ctx.save();
    ctx.filter = `blur(${u * 0.03}px)`;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,236,204,0.34)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h * 0.05);
    ctx.lineTo(w * 0.55, -h * 0.1);
    ctx.lineTo(w * 1.1, h * 0.55);
    ctx.lineTo(w * 0.35, h * 0.8);
    ctx.fill();
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `blur(${u * 0.012}px)`;
    ctx.strokeStyle = 'rgba(150,118,86,0.32)';
    ctx.lineWidth = u * 0.03;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, -h * 0.02);
    ctx.lineTo(w * 0.75, h * 0.66);
    ctx.stroke();
    ctx.restore();
  }

  function mugTop(ctx, x, y, r, u, coffee = true) {
    shadow(ctx, (c) => {
      c.arc(x, y, r, 0, TAU);
      c.roundRect(x + r * 0.8, y - r * 0.18, r * 0.6, r * 0.36, r * 0.18);
    }, u * 0.02, 0.4, u * 0.02, u * 0.025);
    ctx.fillStyle = '#e9e2d7';
    ctx.beginPath();
    ctx.roundRect(x + r * 0.8, y - r * 0.17, r * 0.58, r * 0.34, r * 0.17);
    ctx.fill();
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    body.addColorStop(0, '#fdfaf5');
    body.addColorStop(1, '#ddd4c6');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    const liquid = ctx.createRadialGradient(x + r * 0.1, y + r * 0.1, 0, x, y, r * 0.84);
    liquid.addColorStop(0, coffee ? '#6a4128' : '#a77a45');
    liquid.addColorStop(1, coffee ? '#2e1a0f' : '#6e4a24');
    ctx.fillStyle = liquid;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.84, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.32, r * 0.22, r * 0.08, -0.7, 0, TAU);
    ctx.fill();
  }

  function scribble(ctx, x, y, width, lineH, lines, r, color = 'rgba(40,44,58,0.6)', lw = 1.6) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    for (let l = 0; l < lines; l++) {
      let cx = x;
      const end = x + width * (0.55 + r() * 0.45);
      const yy = y + l * lineH;
      while (cx < end) {
        const word = lineH * (0.8 + r() * 2.4);
        const ph = r() * TAU;
        const loops = Math.max(2, Math.round(word / (lineH * 0.3)));
        ctx.beginPath();
        for (let s = 0; s <= loops * 8; s++) {
          const k = s / (loops * 8);
          const a = k * loops * TAU + ph;
          ctx.lineTo(cx + word * k + Math.cos(a) * lineH * 0.06, yy - Math.abs(Math.sin(a / 2)) * lineH * 0.2 * (0.6 + 0.4 * Math.sin(a * 0.37)));
        }
        ctx.stroke();
        cx += word + lineH * 0.5;
      }
    }
    ctx.restore();
  }

  function pen(ctx, x, y, len, angle, u, color = '#1d1d1f') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    shadow(ctx, (c) => c.roundRect(-len / 2, -u * 0.011, len, u * 0.022, u * 0.011), u * 0.008, 0.45, u * 0.012, u * 0.016);
    const g = ctx.createLinearGradient(0, -u * 0.011, 0, u * 0.011);
    g.addColorStop(0, '#4a4a4f');
    g.addColorStop(0.35, color);
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -u * 0.011, len, u * 0.022, u * 0.011);
    ctx.fill();
    ctx.fillStyle = '#b7b3ab';
    ctx.fillRect(-len / 2 + len * 0.08, -u * 0.014, len * 0.28, u * 0.006);
    ctx.restore();
  }

  function leaf(ctx, x, y, len, angle, u, color = '#4f6b4a') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    shadow(ctx, (c) => {
      c.moveTo(0, 0);
      c.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0);
      c.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
    }, u * 0.012, 0.35, u * 0.02, u * 0.02);
    const g = ctx.createLinearGradient(0, -len * 0.2, 0, len * 0.2);
    g.addColorStop(0, '#6f8c66');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.3, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,235,200,0.3)';
    ctx.lineWidth = u * 0.003;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.95, 0);
    ctx.stroke();
    ctx.restore();
  }

  function deskNotebook(ctx, w, h) {
    const u = Math.min(w, h);
    const r = rng(41);
    oakTop(ctx, w, h, 7);
    sunBand(ctx, w, h, u);

    ctx.save();
    ctx.translate(w * 0.45, h * 0.52);
    ctx.rotate(-0.1);
    const nw = w * 0.72;
    const nh = w * 0.5;
    shadow(ctx, (c) => c.rect(-nw / 2, -nh / 2, nw, nh), u * 0.03, 0.45, u * 0.02, u * 0.03);
    ctx.fillStyle = '#d9624c';
    ctx.beginPath();
    ctx.roundRect(-nw / 2 - u * 0.012, -nh / 2 - u * 0.012, nw + u * 0.024, nh + u * 0.024, u * 0.01);
    ctx.fill();
    [-1, 1].forEach((side) => {
      const g = ctx.createLinearGradient(0, 0, (side * nw) / 2, 0);
      g.addColorStop(0, '#ddd3c1');
      g.addColorStop(0.12, '#f4eee2');
      g.addColorStop(1, '#fbf8f1');
      ctx.fillStyle = g;
      ctx.fillRect(side < 0 ? -nw / 2 : 0, -nh / 2, nw / 2, nh);
    });
    ctx.strokeStyle = 'rgba(110,140,175,0.2)';
    ctx.lineWidth = Math.max(1, u * 0.0016);
    for (let i = 1; i < 16; i++) {
      const yy = -nh / 2 + (i * nh) / 16;
      ctx.beginPath();
      ctx.moveTo(-nw / 2 + u * 0.02, yy);
      ctx.lineTo(nw / 2 - u * 0.02, yy);
      ctx.stroke();
    }
    scribble(ctx, -nw / 2 + u * 0.05, -nh / 2 + (2 * nh) / 16 - u * 0.004, nw * 0.36, nh / 16, 9, r, 'rgba(34,40,58,0.62)', u * 0.0028);
    scribble(ctx, u * 0.04, -nh / 2 + (2 * nh) / 16 - u * 0.004, nw * 0.3, nh / 16, 4, r, 'rgba(34,40,58,0.55)', u * 0.0028);
    ctx.restore();

    pen(ctx, w * 0.62, h * 0.8, w * 0.44, -0.42, u);
    mugTop(ctx, w * 0.8, h * 0.17, w * 0.11, u);
    leaf(ctx, w * 1.05, h * 0.98, w * 0.34, Math.PI + 0.5, u);
    leaf(ctx, w * 1.04, h * 1.02, w * 0.3, Math.PI + 0.9, u, '#445e40');
    leaf(ctx, w * 1.02, h * 0.94, w * 0.26, Math.PI + 0.15, u);

    wash(ctx, w, h, '#f2d4a8', 0.12, 'soft-light');
    vignette(ctx, w, h, 0.22);
  }

  function deskLamp(ctx, w, h) {
    const u = Math.min(w, h);
    const top = h * 0.66;
    const wall = ctx.createLinearGradient(0, 0, 0, top);
    wall.addColorStop(0, '#16235a');
    wall.addColorStop(1, '#27398a');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, top);
    const lx = w * 0.3;
    glow(ctx, lx + u * 0.05, top - u * 0.2, u * 0.75, 'rgba(255,196,128,A)', 0.36);
    const dg = ctx.createLinearGradient(0, top, 0, h);
    dg.addColorStop(0, '#4a3527');
    dg.addColorStop(1, '#241913');
    ctx.fillStyle = dg;
    ctx.fillRect(0, top, w, h - top);
    woodGrain(ctx, 0, top, w, h - top, 19, '255,210,160', 60);
    glow(ctx, lx + u * 0.12, top + u * 0.12, u * 0.5, 'rgba(255,200,140,A)', 0.34);
    ctx.fillStyle = 'rgba(255,210,160,0.3)';
    ctx.fillRect(0, top, w, Math.max(1, u * 0.003));

    // Lamp: base, two arms, head.
    const base = [lx - u * 0.08, top + u * 0.1];
    const elbow = [lx - u * 0.02, top - u * 0.34];
    const head = [lx + u * 0.18, top - u * 0.42];
    shadow(ctx, (c) => c.ellipse(base[0] + u * 0.02, base[1] + u * 0.01, u * 0.1, u * 0.022, 0, 0, TAU), u * 0.012, 0.6);
    ctx.fillStyle = '#1c1b1a';
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], u * 0.09, u * 0.022, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#232220';
    ctx.lineWidth = u * 0.012;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(...base);
    ctx.lineTo(...elbow);
    ctx.lineTo(...head);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,0.25)';
    ctx.lineWidth = u * 0.003;
    ctx.stroke();
    ctx.save();
    ctx.translate(...head);
    ctx.rotate(0.55);
    ctx.fillStyle = '#20201f';
    ctx.beginPath();
    ctx.moveTo(-u * 0.03, -u * 0.02);
    ctx.lineTo(u * 0.03, -u * 0.02);
    ctx.lineTo(u * 0.08, u * 0.08);
    ctx.lineTo(-u * 0.08, u * 0.08);
    ctx.fill();
    ctx.fillStyle = '#ffe2b0';
    ctx.shadowColor = 'rgba(255,200,130,1)';
    ctx.shadowBlur = u * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, u * 0.08, u * 0.078, u * 0.014, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${u * 0.03}px)`;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,214,160,0.2)';
    ctx.beginPath();
    ctx.moveTo(head[0] - u * 0.06, head[1] + u * 0.06);
    ctx.lineTo(head[0] + u * 0.08, head[1] + u * 0.1);
    ctx.lineTo(head[0] + u * 0.08, top + u * 0.14);
    ctx.lineTo(head[0] - u * 0.34, top + u * 0.12);
    ctx.fill();
    ctx.restore();

    // A stack of books with a mug on top.
    const sx = w * 0.7;
    let sy = top + u * 0.12;
    const books = [
      ['#d65c48', w * 0.44, u * 0.05, -0.01],
      ['#e0a13a', w * 0.4, u * 0.045, 0.02],
      ['#d98aa0', w * 0.36, u * 0.04, -0.015],
    ];
    shadow(ctx, (c) => c.ellipse(sx + u * 0.03, sy + u * 0.01, w * 0.24, u * 0.02, 0, 0, TAU), u * 0.012, 0.6);
    books.forEach(([col, bw, bh, rot]) => {
      ctx.save();
      ctx.translate(sx, sy - bh / 2);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      g.addColorStop(0, col);
      g.addColorStop(0.3, col);
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = col;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8dcc3';
      ctx.fillRect(-bw / 2 + u * 0.006, -bh / 2 + bh * 0.16, u * 0.01, bh * 0.68);
      ctx.fillStyle = 'rgba(255,220,170,0.28)';
      ctx.fillRect(-bw / 2, -bh / 2, bw, Math.max(1, bh * 0.08));
      ctx.restore();
      sy -= bh;
    });
    const mx = sx - u * 0.02;
    const mw = u * 0.12;
    const mh = u * 0.13;
    ctx.strokeStyle = '#8f8a82';
    ctx.lineWidth = u * 0.016;
    ctx.beginPath();
    ctx.ellipse(mx - mw * 0.52, sy - mh * 0.5, mw * 0.18, mh * 0.22, 0, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.stroke();
    const mug = ctx.createLinearGradient(mx - mw / 2, 0, mx + mw / 2, 0);
    mug.addColorStop(0, '#e7dccb');
    mug.addColorStop(0.35, '#c9bca8');
    mug.addColorStop(1, '#5f574d');
    ctx.fillStyle = mug;
    ctx.beginPath();
    ctx.roundRect(mx - mw / 2, sy - mh, mw, mh, [0, 0, u * 0.014, u * 0.014]);
    ctx.fill();
    ctx.fillStyle = '#d6cab7';
    ctx.beginPath();
    ctx.ellipse(mx, sy - mh, mw / 2, mw * 0.1, 0, 0, TAU);
    ctx.fill();
    steam(ctx, mx, sy - mh - u * 0.01, u * 0.8, 0.3, 2, 0.16);

    wash(ctx, w, h, '#1d2a60', 0.12, 'soft-light');
    vignette(ctx, w, h, 0.5, 0.35, 0.55);
  }

  function deskPlant(ctx, w, h) {
    const u = Math.min(w, h);
    const r = rng(77);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#efebe4');
    g.addColorStop(1, '#ddd7cd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#6e6456';
    for (let i = 0; i < w; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i + r() * 2, 0);
      ctx.lineTo(i + r() * 2, h);
      ctx.stroke();
    }
    ctx.restore();
    sunBand(ctx, w, h, u);

    // Laptop corner.
    ctx.save();
    ctx.translate(-w * 0.06, h * 0.02);
    ctx.rotate(0.08);
    shadow(ctx, (c) => c.roundRect(0, 0, w * 0.62, h * 0.36, u * 0.03), u * 0.03, 0.35, u * 0.02, u * 0.03);
    const al = ctx.createLinearGradient(0, 0, w * 0.6, h * 0.36);
    al.addColorStop(0, '#d9dadc');
    al.addColorStop(1, '#b9babd');
    ctx.fillStyle = al;
    ctx.beginPath();
    ctx.roundRect(0, 0, w * 0.62, h * 0.36, u * 0.03);
    ctx.fill();
    ctx.fillStyle = '#a9aaad';
    ctx.beginPath();
    ctx.roundRect(w * 0.04, h * 0.03, w * 0.54, h * 0.19, u * 0.01);
    ctx.fill();
    ctx.fillStyle = '#2b2c2f';
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 13; col++) {
        ctx.beginPath();
        ctx.roundRect(w * 0.05 + col * w * 0.04, h * 0.037 + row * h * 0.036, w * 0.034, h * 0.03, u * 0.004);
        ctx.fill();
      }
    ctx.fillStyle = '#c5c6c9';
    ctx.beginPath();
    ctx.roundRect(w * 0.19, h * 0.24, w * 0.24, h * 0.1, u * 0.01);
    ctx.fill();
    ctx.restore();

    // Sticky notes.
    [
      [w * 0.2, h * 0.66, '#f4c35e', -0.12],
      [w * 0.34, h * 0.74, '#9fcdf0', 0.08],
    ].forEach(([x, y, col, rot]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const s = w * 0.2;
      shadow(ctx, (c) => c.rect(-s / 2, -s / 2, s, s), u * 0.012, 0.25, u * 0.008, u * 0.012);
      ctx.fillStyle = col;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      scribble(ctx, -s / 2 + s * 0.12, -s / 2 + s * 0.26, s * 0.7, s * 0.17, 3, r, 'rgba(40,44,58,0.6)', u * 0.003);
      ctx.restore();
    });

    // Succulent from above.
    const px = w * 0.72;
    const py = h * 0.66;
    const pr = w * 0.17;
    shadow(ctx, (c) => c.arc(px, py, pr, 0, TAU), u * 0.03, 0.4, u * 0.03, u * 0.04);
    const pot = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
    pot.addColorStop(0, '#d7917a');
    pot.addColorStop(1, '#9e5b40');
    ctx.fillStyle = pot;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4a3a2e';
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.84, 0, TAU);
    ctx.fill();
    [
      [0.8, 11, '#6f8a6c'],
      [0.6, 9, '#86a07f'],
      [0.4, 7, '#9fb795'],
      [0.2, 5, '#b8ccad'],
    ].forEach(([k, n, col], ring) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 0.4;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        const lg = ctx.createLinearGradient(0, 0, pr * k, 0);
        lg.addColorStop(0, '#5a7456');
        lg.addColorStop(1, col);
        ctx.fillStyle = lg;
        ctx.shadowColor = 'rgba(20,30,20,0.35)';
        ctx.shadowBlur = u * 0.01;
        ctx.beginPath();
        ctx.ellipse(pr * k * 0.55, 0, pr * k * 0.5, pr * 0.14 * (0.6 + k * 0.5), 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    });

    pen(ctx, w * 0.5, h * 0.9, w * 0.4, 0.12, u, '#6b5b3a');
    wash(ctx, w, h, '#efd7b4', 0.1, 'soft-light');
    vignette(ctx, w, h, 0.2);
  }

  function marble(ctx, w, h, seed) {
    const r = rng(seed);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#f6dcd8');
    g.addColorStop(1, '#e7b9b4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const veins = (blur, alpha, count, lw) => {
      ctx.save();
      ctx.filter = `blur(${blur}px)`;
      for (let i = 0; i < count; i++) {
        ctx.strokeStyle = `rgba(176,110,112,${alpha * (0.4 + r())})`;
        ctx.lineWidth = lw * (0.4 + r());
        ctx.beginPath();
        let x = r() * w * 1.4 - w * 0.2;
        let y = -h * 0.1;
        ctx.moveTo(x, y);
        while (y < h * 1.1) {
          const nx = x + (r() - 0.35) * w * 0.25;
          const ny = y + h * (0.08 + r() * 0.12);
          ctx.quadraticCurveTo(x + (r() - 0.5) * w * 0.2, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    veins(w * 0.012, 0.16, 7, w * 0.02);
    veins(w * 0.002, 0.2, 9, w * 0.003);
  }

  function cafeCup(ctx, w, h) {
    const u = Math.min(w, h);
    marble(ctx, w, h, 51);
    sunBand(ctx, w, h, u);
    const x = w * 0.5;
    const y = h * 0.5;
    const sr = w * 0.33;
    shadow(ctx, (c) => c.arc(x, y, sr, 0, TAU), u * 0.035, 0.32, u * 0.035, u * 0.045);
    const saucer = ctx.createRadialGradient(x - sr * 0.3, y - sr * 0.35, 0, x, y, sr);
    saucer.addColorStop(0, '#fffefb');
    saucer.addColorStop(0.8, '#eeeae3');
    saucer.addColorStop(1, '#d9d3c9');
    ctx.fillStyle = saucer;
    ctx.beginPath();
    ctx.arc(x, y, sr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,150,135,0.25)';
    ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.arc(x, y, sr * 0.7, 0, TAU);
    ctx.stroke();

    // Spoon on the saucer.
    ctx.save();
    ctx.translate(x + sr * 0.2, y + sr * 0.62);
    ctx.rotate(-0.25);
    shadow(ctx, (c) => {
      c.ellipse(0, 0, sr * 0.1, sr * 0.07, 0, 0, TAU);
      c.roundRect(sr * 0.08, -sr * 0.018, sr * 0.62, sr * 0.036, sr * 0.018);
    }, u * 0.006, 0.4, u * 0.008, u * 0.01);
    const steel = ctx.createLinearGradient(0, -sr * 0.07, 0, sr * 0.07);
    steel.addColorStop(0, '#f2f2f0');
    steel.addColorStop(0.5, '#a6a6a8');
    steel.addColorStop(1, '#707074');
    ctx.fillStyle = steel;
    ctx.beginPath();
    ctx.ellipse(0, 0, sr * 0.1, sr * 0.07, 0, 0, TAU);
    ctx.roundRect(sr * 0.08, -sr * 0.018, sr * 0.62, sr * 0.036, sr * 0.018);
    ctx.fill();
    ctx.restore();

    const cr = sr * 0.6;
    shadow(ctx, (c) => {
      c.arc(x, y, cr, 0, TAU);
      c.roundRect(x + cr * 0.82, y - cr * 0.2, cr * 0.62, cr * 0.4, cr * 0.2);
    }, u * 0.015, 0.35, u * 0.015, u * 0.02);
    ctx.fillStyle = '#f3efe8';
    ctx.beginPath();
    ctx.roundRect(x + cr * 0.82, y - cr * 0.19, cr * 0.6, cr * 0.38, cr * 0.19);
    ctx.fill();
    const cup = ctx.createRadialGradient(x - cr * 0.3, y - cr * 0.3, 0, x, y, cr);
    cup.addColorStop(0, '#ffffff');
    cup.addColorStop(1, '#e3ddd3');
    ctx.fillStyle = cup;
    ctx.beginPath();
    ctx.arc(x, y, cr, 0, TAU);
    ctx.fill();
    const coffee = ctx.createRadialGradient(x, y, 0, x, y, cr * 0.86);
    coffee.addColorStop(0, '#c8955f');
    coffee.addColorStop(0.55, '#9a6335');
    coffee.addColorStop(0.92, '#5a3219');
    coffee.addColorStop(1, '#3b200f');
    ctx.fillStyle = coffee;
    ctx.beginPath();
    ctx.arc(x, y, cr * 0.86, 0, TAU);
    ctx.fill();
    // Latte art: a soft heart.
    ctx.save();
    ctx.filter = `blur(${u * 0.004}px)`;
    ctx.fillStyle = 'rgba(246,234,214,0.94)';
    const hs = cr * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, y + hs * 0.95);
    ctx.bezierCurveTo(x - hs * 1.3, y + hs * 0.1, x - hs * 0.9, y - hs * 0.95, x, y - hs * 0.35);
    ctx.bezierCurveTo(x + hs * 0.9, y - hs * 0.95, x + hs * 1.3, y + hs * 0.1, x, y + hs * 0.95);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,106,60,0.5)';
    ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.moveTo(x, y - hs * 0.8);
    ctx.lineTo(x, y + hs * 1.1);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - cr * 0.52, y - cr * 0.52, cr * 0.14, cr * 0.05, -0.8, 0, TAU);
    ctx.fill();

    // Sugar packet.
    ctx.save();
    ctx.translate(w * 0.2, h * 0.84);
    ctx.rotate(0.35);
    shadow(ctx, (c) => c.rect(-w * 0.1, -w * 0.035, w * 0.2, w * 0.07), u * 0.008, 0.25, u * 0.006, u * 0.01);
    ctx.fillStyle = '#2f4fc8';
    ctx.fillRect(-w * 0.1, -w * 0.035, w * 0.2, w * 0.07);
    ctx.strokeStyle = 'rgba(120,96,64,0.35)';
    ctx.lineWidth = u * 0.003;
    ctx.beginPath();
    ctx.moveTo(-w * 0.085, -w * 0.035);
    ctx.lineTo(-w * 0.085, w * 0.035);
    ctx.moveTo(w * 0.085, -w * 0.035);
    ctx.lineTo(w * 0.085, w * 0.035);
    ctx.stroke();
    ctx.restore();

    wash(ctx, w, h, '#ffd9c0', 0.08, 'soft-light');
    vignette(ctx, w, h, 0.2);
  }

  function cafeTable(ctx, w, h) {
    const u = Math.min(w, h);
    const r = rng(63);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#6f4e36');
    g.addColorStop(1, '#4f3526');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    woodGrain(ctx, 0, 0, w, h, 17, '30,16,8', 120, true);
    ctx.fillStyle = 'rgba(20,12,8,0.6)';
    [0.31, 0.64].forEach((k) => ctx.fillRect(w * k, 0, Math.max(2, u * 0.004), h));
    sunBand(ctx, w, h, u);

    // Plate with a croissant.
    const x = w * 0.4;
    const y = h * 0.55;
    const pr = w * 0.3;
    shadow(ctx, (c) => c.arc(x, y, pr, 0, TAU), u * 0.035, 0.5, u * 0.03, u * 0.04);
    const plate = ctx.createRadialGradient(x - pr * 0.3, y - pr * 0.3, 0, x, y, pr);
    plate.addColorStop(0, '#fbfaf6');
    plate.addColorStop(0.85, '#e9e4db');
    plate.addColorStop(1, '#cfc7ba');
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.arc(x, y, pr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,125,0.25)';
    ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.arc(x, y, pr * 0.74, 0, TAU);
    ctx.stroke();
    const segs = 7;
    const arcR = pr * 0.38;
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const a = Math.PI * 1.15 + (i / (segs - 1)) * Math.PI * 0.7 + Math.PI * 0.0;
      const mid = 1 - Math.abs(i - (segs - 1) / 2) / ((segs - 1) / 2);
      pts.push([x + Math.cos(a) * arcR, y + pr * 0.25 + Math.sin(a) * arcR * 0.8, pr * (0.1 + mid * 0.13), a]);
    }
    shadow(ctx, (c) => pts.forEach(([px, py, s]) => c.ellipse(px, py, s * 1.1, s * 0.9, 0, 0, TAU)), u * 0.02, 0.45, u * 0.015, u * 0.02);
    [...pts.slice(0, 1), ...pts.slice(-1), ...pts.slice(1, 3), ...pts.slice(-3, -1), pts[3]].forEach(([px, py, s, a]) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2);
      const cg = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s * 1.1);
      cg.addColorStop(0, '#f0c07a');
      cg.addColorStop(0.55, '#d18a3f');
      cg.addColorStop(1, '#8a4a1c');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.75, s * 1.05, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,55,20,0.45)';
      ctx.lineWidth = u * 0.004;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.75, s * 1.05, 0, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.25, -s * 0.35, s * 0.18, s * 0.08, -0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    // Espresso cup, top right.
    const ex = w * 0.8;
    const ey = h * 0.2;
    const er = w * 0.14;
    shadow(ctx, (c) => c.arc(ex, ey, er, 0, TAU), u * 0.025, 0.5, u * 0.02, u * 0.03);
    const es = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
    es.addColorStop(0, '#5b7cf0');
    es.addColorStop(1, '#1f3490');
    ctx.fillStyle = es;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, TAU);
    ctx.fill();
    mugTop(ctx, ex, ey, er * 0.58, u);

    // A small card, the "café words" note.
    ctx.save();
    ctx.translate(w * 0.76, h * 0.84);
    ctx.rotate(-0.14);
    const cw = w * 0.34;
    const ch = w * 0.22;
    shadow(ctx, (c) => c.rect(-cw / 2, -ch / 2, cw, ch), u * 0.012, 0.45, u * 0.01, u * 0.014);
    ctx.fillStyle = '#f2b441';
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.fillStyle = 'rgba(40,36,32,0.75)';
    ctx.fillRect(-cw / 2 + cw * 0.1, -ch / 2 + ch * 0.16, cw * 0.4, ch * 0.08);
    scribble(ctx, -cw / 2 + cw * 0.1, -ch / 2 + ch * 0.46, cw * 0.72, ch * 0.16, 3, r, 'rgba(60,54,48,0.55)', u * 0.003);
    ctx.restore();

    wash(ctx, w, h, '#3a2a20', 0.08, 'soft-light');
    vignette(ctx, w, h, 0.36);
  }

  function packing(ctx, w, h) {
    const u = Math.min(w, h);
    const r = rng(91);
    // Sky-blue linen bedspread from above.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#d9e6ef');
    g.addColorStop(1, '#bccfdd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#2b4a63';
    for (let i = 0; i < h; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i + r() * 2);
      ctx.lineTo(w, i + r() * 2);
      ctx.stroke();
    }
    ctx.restore();
    sunBand(ctx, w, h, u);

    // Packing list on a notepad.
    ctx.save();
    ctx.translate(w * 0.36, h * 0.38);
    ctx.rotate(-0.08);
    const nw = w * 0.46;
    const nh = w * 0.58;
    shadow(ctx, (c) => c.rect(-nw / 2, -nh / 2, nw, nh), u * 0.02, 0.35, u * 0.015, u * 0.02);
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
    ctx.fillStyle = '#d65c48';
    ctx.fillRect(-nw / 2, -nh / 2, nw, nh * 0.06);
    ctx.strokeStyle = 'rgba(40,44,58,0.55)';
    ctx.lineWidth = u * 0.003;
    for (let i = 0; i < 7; i++) {
      const y = -nh / 2 + nh * (0.18 + i * 0.11);
      ctx.strokeRect(-nw / 2 + nw * 0.1, y - nh * 0.025, nh * 0.045, nh * 0.045);
      if (i < 4) {
        ctx.beginPath();
        ctx.moveTo(-nw / 2 + nw * 0.11, y);
        ctx.lineTo(-nw / 2 + nw * 0.14, y + nh * 0.02);
        ctx.lineTo(-nw / 2 + nw * 0.19, y - nh * 0.03);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(-nw / 2 + nw * 0.24, -nh / 2, nw * 0.68, nh);
    ctx.clip();
    scribble(ctx, -nw / 2 + nw * 0.26, -nh / 2 + nh * 0.18, nw * 0.5, nh * 0.11, 7, r, 'rgba(34,40,58,0.6)', u * 0.003);
    ctx.restore();
    ctx.restore();

    // Passport.
    ctx.save();
    ctx.translate(w * 0.74, h * 0.3);
    ctx.rotate(0.2);
    const pw = w * 0.24;
    const ph = w * 0.33;
    shadow(ctx, (c) => c.roundRect(-pw / 2, -ph / 2, pw, ph, u * 0.012), u * 0.02, 0.4, u * 0.015, u * 0.02);
    const pg = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
    pg.addColorStop(0, '#2c46b8');
    pg.addColorStop(1, '#1f3388');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph / 2, pw, ph, u * 0.012);
    ctx.fill();
    ctx.strokeStyle = '#e3b85c';
    ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.arc(0, -ph * 0.05, pw * 0.2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#e3b85c';
    ctx.fillRect(-pw * 0.28, ph * 0.25, pw * 0.56, ph * 0.025);
    ctx.restore();

    // Amber luggage tag with its string.
    ctx.save();
    ctx.translate(w * 0.72, h * 0.66);
    ctx.rotate(-0.35);
    const tw = w * 0.17;
    const th = w * 0.27;
    shadow(ctx, (c) => c.roundRect(-tw / 2, -th / 2, tw, th, u * 0.02), u * 0.015, 0.35, u * 0.012, u * 0.016);
    ctx.fillStyle = '#e0a33a';
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -th / 2, tw, th, u * 0.02);
    ctx.fill();
    ctx.fillStyle = '#d9e6ef';
    ctx.beginPath();
    ctx.arc(0, -th * 0.38, tw * 0.09, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(-tw * 0.36, -th * 0.15, tw * 0.72, th * 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-tw * 0.34, -th * 0.15, tw * 0.68, th * 0.5);
    ctx.clip();
    scribble(ctx, -tw * 0.3, -th * 0.03, tw * 0.45, th * 0.1, 3, r, 'rgba(34,40,58,0.55)', u * 0.0025);
    ctx.restore();
    ctx.strokeStyle = '#7a4a1c';
    ctx.lineWidth = u * 0.004;
    ctx.beginPath();
    ctx.moveTo(0, -th * 0.38);
    ctx.bezierCurveTo(-tw * 0.4, -th * 0.9, tw * 0.6, -th * 1.1, tw * 0.2, -th * 1.6);
    ctx.stroke();
    ctx.restore();

    // Sunglasses.
    ctx.save();
    ctx.translate(w * 0.3, h * 0.82);
    ctx.rotate(0.1);
    const lr = w * 0.075;
    shadow(ctx, (c) => {
      c.ellipse(-lr * 1.15, 0, lr, lr * 0.8, 0, 0, TAU);
      c.ellipse(lr * 1.15, 0, lr, lr * 0.8, 0, 0, TAU);
    }, u * 0.015, 0.4, u * 0.015, u * 0.02);
    [-1, 1].forEach((side) => {
      const lg = ctx.createRadialGradient(side * lr * 1.15 - lr * 0.3, -lr * 0.3, 0, side * lr * 1.15, 0, lr);
      lg.addColorStop(0, '#5a4a40');
      lg.addColorStop(1, '#1c1714');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(side * lr * 1.15, 0, lr, lr * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(side * lr * 1.15 - lr * 0.35, -lr * 0.3, lr * 0.25, lr * 0.1, -0.5, 0, TAU);
      ctx.fill();
    });
    ctx.strokeStyle = '#1c1714';
    ctx.lineWidth = u * 0.008;
    ctx.beginPath();
    ctx.moveTo(-lr * 0.2, -lr * 0.2);
    ctx.quadraticCurveTo(0, -lr * 0.45, lr * 0.2, -lr * 0.2);
    ctx.stroke();
    ctx.restore();

    wash(ctx, w, h, '#f4dcc0', 0.08, 'soft-light');
    vignette(ctx, w, h, 0.2);
  }

  const SCENES = { market, morning, readingRoom, deskNotebook, deskLamp, deskPlant, cafeCup, cafeTable, packing };

  function paint(ctx, scene, w, h, t, frame, mark) {
    SCENES[scene](ctx, w, h, t);
    grain(ctx, w, h, 0.07, frame);
    watermark(ctx, w, h, mark);
  }

  window.renderStill = (scene, w, h, t = 0.3, mark = 'Haven sample · not a real photo') => {
    const c = layer(w, h, () => {});
    paint(c.getContext('2d'), scene, w, h, t, 0, mark);
    return c.toDataURL('image/jpeg', 0.86);
  };

  window.recordClip = async (scene, w, h, seconds, mark = 'Haven sample · not real footage') => {
    const canvas = layer(w, h, () => {});
    const ctx = canvas.getContext('2d');
    const fps = 30;
    const frames = seconds * fps;
    paint(ctx, scene, w, h, 0, 0, mark);
    const stream = canvas.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1_400_000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    const started = performance.now();
    for (let f = 0; f < frames; f++) {
      paint(ctx, scene, w, h, f / frames, f, mark);
      const due = started + ((f + 1) * 1000) / fps;
      await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
    }
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
})();
