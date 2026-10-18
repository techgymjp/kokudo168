'use strict';
// すべての絵（スプライト・背景）をキャンバスで手続き生成する。画像ファイル不要。
const Sprites = (() => {
  const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
  const TITLE_FONT = '"Dela Gothic One",' + FONT;
  const lib = {};
  const cars = {};

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function make(w, h, worldW, fn) {
    const c = canvas(w, h);
    fn(c.getContext('2d'), w, h);
    return { img: c, w, h, worldW };
  }
  function add(key, w, h, worldW, fn) { lib[key] = make(w, h, worldW, fn); return lib[key]; }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function poly(g, color, pts) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  }
  function text(g, str, x, y, size, color, opts = {}) {
    g.font = `${opts.weight || 900} ${size}px ${opts.font || FONT}`;
    g.fillStyle = color;
    g.textAlign = opts.align || 'center';
    g.textBaseline = opts.base || 'middle';
    if (opts.maxW) {
      const m = g.measureText(str).width;
      if (m > opts.maxW) { g.save(); g.translate(x, y); g.scale(opts.maxW / m, 1); g.fillText(str, 0, 0); g.restore(); return; }
    }
    g.fillText(str, x, y);
  }
  function post(g, x, top, bottom, wd, color) {
    g.fillStyle = color || '#9aa0a6';
    g.fillRect(x - wd / 2, top, wd, bottom - top);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(x, top, wd / 2, bottom - top);
  }
  function shadow(g, cx, cy, rx, ry, a) {
    g.fillStyle = `rgba(0,0,0,${a || 0.3})`;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }

  // ---------- 樹木 ----------
  function sugi(key, seed, worldW, dark) {
    add(key, 140, 380, worldW, (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = '#4b3322';
      g.fillRect(w * 0.45, h * 0.72, w * 0.1, h * 0.28);
      const layers = 8;
      const c1 = dark ? '#173d24' : '#1f4d2b', c2 = dark ? '#1d4a2c' : '#2a5e36';
      for (let k = 0; k < layers; k++) {
        const t = k / (layers - 1);
        const y = h * 0.02 + t * h * 0.66;
        const lw = w * (0.12 + 0.36 * t) * (0.9 + r() * 0.2);
        const lh = h * 0.16;
        const cx = w / 2 + (r() - 0.5) * 6;
        poly(g, k % 2 ? c1 : c2, [cx, y, cx + lw, y + lh, cx - lw, y + lh]);
        poly(g, 'rgba(120,170,110,0.18)', [cx, y, cx - lw, y + lh, cx - lw * 0.4, y + lh]);
      }
    });
  }
  function blobTree(key, seed, worldW, colors, opts = {}) {
    add(key, 220, 250, worldW, (g, w, h) => {
      const r = rng(seed);
      shadow(g, w / 2, h - 6, w * 0.3, 6, 0.25);
      g.fillStyle = '#4b3322';
      g.fillRect(w * 0.46, h * 0.55, w * 0.08, h * 0.45);
      g.strokeStyle = '#4b3322'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(w * 0.5, h * 0.7); g.lineTo(w * 0.33, h * 0.48); g.moveTo(w * 0.5, h * 0.65); g.lineTo(w * 0.68, h * 0.45); g.stroke();
      const n = opts.n || 46;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        const x = w / 2 + Math.cos(a) * d * w * 0.36;
        const y = h * 0.4 + Math.sin(a) * d * h * 0.3;
        const rad = 14 + r() * 22;
        g.fillStyle = colors[Math.floor(r() * colors.length)];
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
      if (opts.fruit) {
        for (let i = 0; i < 26; i++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r());
          g.fillStyle = opts.fruit;
          g.beginPath(); g.arc(w / 2 + Math.cos(a) * d * w * 0.34, h * 0.42 + Math.sin(a) * d * h * 0.27, 5, 0, Math.PI * 2); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-atop';
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }
  function bamboo(key, seed) {
    add(key, 200, 380, 1300, (g, w, h) => {
      const r = rng(seed);
      for (let i = 0; i < 9; i++) {
        const x = 20 + r() * (w - 40), top = r() * h * 0.2;
        g.strokeStyle = i % 2 ? '#7aa04a' : '#5f8a3a'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 6, h / 2, x + (r() - 0.5) * 30, top); g.stroke();
        g.fillStyle = '#4a6e2c';
        for (let y = h - 30; y > top + 10; y -= 34) g.fillRect(x - 4, y, 8, 2);
      }
      for (let i = 0; i < 70; i++) {
        g.fillStyle = ['#6f9b40', '#5a8a35', '#88b050'][i % 3];
        g.beginPath(); g.ellipse(r() * w, r() * h * 0.6, 16, 5, r() * 3, 0, Math.PI * 2); g.fill();
      }
    });
  }

  // ---------- 建物 ----------
  function building(key, seed) {
    const r = rng(seed);
    const hh = 260 + Math.floor(r() * 300);
    add(key, 200, hh, 1700, (g, w, h) => {
      const cols = ['#c9c4b8', '#a9b4bf', '#d8d2c4', '#8f9aa5', '#b9a993', '#e2ddd2'];
      const base = cols[Math.floor(r() * cols.length)];
      g.fillStyle = base; g.fillRect(4, 10, w - 8, h - 10);
      g.fillStyle = shade(base, 0.8); g.fillRect(w - 30, 10, 26, h - 10);
      g.fillStyle = shade(base, 0.7); g.fillRect(0, 4, w, 10);
      const winC = r() < 0.5 ? '#5d7590' : '#3e5068';
      for (let y = 30; y < h - 40; y += 30) {
        for (let x = 16; x < w - 40; x += 26) {
          g.fillStyle = r() < 0.12 ? '#ffe9a8' : winC;
          g.fillRect(x, y, 16, 18);
        }
      }
      g.fillStyle = '#555'; g.fillRect(4, h - 34, w - 8, 34);
      g.fillStyle = '#9fc3dd'; g.fillRect(20, h - 28, w - 70, 22);
      if (r() < 0.4) { g.fillStyle = ['#c33', '#2a6fb5', '#e0a020'][Math.floor(r() * 3)]; g.fillRect(w * 0.62, 24, 22, 80); g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 4; k++) g.fillRect(w * 0.62 + 6, 32 + k * 18, 10, 10); }
    });
  }
  function house(key, seed) {
    const r = rng(seed);
    add(key, 280, 200, 1500, (g, w, h) => {
      shadow(g, w / 2, h - 4, w * 0.48, 6);
      const wall = ['#efe8d8', '#e6dccb', '#d8cdb8', '#f4f0e6'][Math.floor(r() * 4)];
      const roof = ['#4a5866', '#3d4652', '#6b4a3a', '#55606b'][Math.floor(r() * 4)];
      g.fillStyle = wall; g.fillRect(24, 90, w - 48, h - 94);
      g.fillStyle = '#6b4b32'; g.fillRect(24, h - 50, w - 48, 46);
      g.fillStyle = '#a7c4d6'; g.fillRect(50, 110, 50, 34); g.fillRect(w - 100, 110, 50, 34);
      g.strokeStyle = '#5a4030'; g.lineWidth = 2; g.strokeRect(50, 110, 50, 34); g.strokeRect(w - 100, 110, 50, 34);
      g.fillStyle = '#3c2a1e'; g.fillRect(w / 2 - 18, h - 46, 36, 42);
      // 瓦屋根
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(2, 96); g.quadraticCurveTo(w / 2, 70, w - 2, 96); g.lineTo(w - 50, 22); g.lineTo(50, 22); g.closePath(); g.fill();
      g.fillStyle = shade(roof, 0.7); g.fillRect(44, 16, w - 88, 9);
      g.strokeStyle = shade(roof, 1.3); g.lineWidth = 1;
      for (let x = 40; x < w - 30; x += 10) { g.beginPath(); g.moveTo(x, 90); g.lineTo(x + (w / 2 - x) * 0.1, 26); g.stroke(); }
    });
  }
  function shop(key) {
    add(key, 340, 170, 2300, (g, w, h) => {
      shadow(g, w / 2, h - 4, w * 0.48, 6);
      g.fillStyle = '#f4f4f0'; g.fillRect(6, 30, w - 12, h - 34);
      g.fillStyle = '#2e8b57'; g.fillRect(6, 30, w - 12, 12);
      g.fillStyle = '#f39c12'; g.fillRect(6, 42, w - 12, 8);
      g.fillStyle = '#1f6fb2'; g.fillRect(6, 50, w - 12, 6);
      g.fillStyle = '#9fd0ea'; g.fillRect(20, 70, w - 40, h - 78);
      g.strokeStyle = '#ddd'; g.lineWidth = 3;
      for (let x = 20; x < w - 20; x += 50) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, h - 8); g.stroke(); }
      g.fillStyle = '#fff'; rrect(g, w / 2 - 80, 2, 160, 34, 6); g.fill();
      g.strokeStyle = '#2e8b57'; g.lineWidth = 3; g.stroke();
      text(g, '168マート', w / 2, 20, 22, '#2e8b57');
    });
  }
  function pole(key) {
    add(key, 60, 420, 220, (g, w, h) => {
      post(g, w / 2, 10, h, 12, '#8d8a82');
      g.fillStyle = '#6d6a62'; g.fillRect(4, 40, w - 8, 6); g.fillRect(10, 80, w - 20, 5);
      g.fillStyle = '#ccc'; g.fillRect(6, 34, 6, 8); g.fillRect(w - 12, 34, 6, 8);
      g.fillStyle = '#444'; g.fillRect(w / 2 - 10, 110, 20, 26);
    });
  }

  // ---------- 神社・名所 ----------
  function torii(key, color, worldW, opts = {}) {
    add(key, 300, 260, worldW, (g, w, h) => {
      const c = color, dk = shade(color, 0.6);
      const pw = opts.thick ? 28 : 18;
      if (opts.ground) { g.fillStyle = opts.ground; g.fillRect(0, h - 16, w, 16); }
      shadow(g, w / 2, h - 6, w * 0.45, 8, 0.25);
      // 柱
      g.fillStyle = c;
      g.beginPath(); g.moveTo(70, 60); g.lineTo(70 + pw, 60); g.lineTo(76 + pw, h - 6); g.lineTo(64, h - 6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(w - 70 - pw, 60); g.lineTo(w - 70, 60); g.lineTo(w - 64, h - 6); g.lineTo(w - 76 - pw, h - 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(70 + pw * 0.6, 60, pw * 0.4, h - 66); g.fillRect(w - 70 - pw * 0.4, 60, pw * 0.4, h - 66);
      // 貫
      g.fillStyle = c; g.fillRect(40, 88, w - 80, 16);
      // 島木・笠木（反り）
      g.fillStyle = c;
      g.beginPath(); g.moveTo(22, 46); g.quadraticCurveTo(w / 2, 58, w - 22, 46); g.lineTo(w - 28, 64); g.quadraticCurveTo(w / 2, 72, 28, 64); g.closePath(); g.fill();
      g.fillStyle = opts.kasagi || '#222';
      g.beginPath(); g.moveTo(4, 22); g.quadraticCurveTo(w / 2, 44, w - 4, 22); g.lineTo(w - 12, 46); g.quadraticCurveTo(w / 2, 60, 12, 46); g.closePath(); g.fill();
      // 額束
      g.fillStyle = dk; g.fillRect(w / 2 - 14, 58, 28, 32);
      if (opts.plaque) { g.fillStyle = opts.plaqueColor || '#d4af37'; g.fillRect(w / 2 - 11, 61, 22, 26); }
      if (opts.base) { g.fillStyle = '#777'; g.fillRect(58, h - 14, 40, 10); g.fillRect(w - 98, h - 14, 40, 10); }
    });
  }
  function shrine(key, worldW, body, roof) {
    add(key, 340, 250, worldW, (g, w, h) => {
      shadow(g, w / 2, h - 6, w * 0.48, 8);
      g.fillStyle = '#9d9a90'; g.fillRect(20, h - 30, w - 40, 26);
      g.fillStyle = '#7d7a70';
      for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 40 - i * 6, h - 30 + i * 7, 80 + i * 12, 4);
      g.fillStyle = body; g.fillRect(60, 120, w - 120, h - 150);
      g.fillStyle = shade(body, 0.7);
      for (let x = 60; x <= w - 70; x += 44) g.fillRect(x, 120, 10, h - 150);
      g.fillStyle = '#e8e2d0'; g.fillRect(80, 140, w - 160, 40);
      g.fillStyle = '#3a2a1e'; g.fillRect(w / 2 - 30, 150, 60, h - 180);
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(0, 124); g.quadraticCurveTo(w / 2, 96, w, 124); g.lineTo(w - 40, 54); g.lineTo(40, 54); g.closePath(); g.fill();
      g.fillStyle = shade(roof, 0.7); g.fillRect(36, 46, w - 72, 12);
      // 千木・鰹木
      g.strokeStyle = shade(roof, 0.6); g.lineWidth = 6;
      g.beginPath(); g.moveTo(30, 18); g.lineTo(60, 56); g.moveTo(w - 30, 18); g.lineTo(w - 60, 56); g.stroke();
      g.fillStyle = '#d4af37';
      for (let x = 90; x < w - 80; x += 40) g.fillRect(x, 36, 18, 10);
      // しめ縄
      g.strokeStyle = '#c9b46a'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(80, 132); g.quadraticCurveTo(w / 2, 150, w - 80, 132); g.stroke();
    });
  }
  function nobori(key) {
    add(key, 60, 300, 380, (g, w, h) => {
      post(g, 10, 6, h, 6, '#6b5a40');
      g.fillStyle = '#f7f3ea'; g.fillRect(14, 20, 40, h - 70);
      g.fillStyle = '#222'; g.fillRect(14, 20, 40, 12);
      g.font = `900 26px ${FONT}`; g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'top';
      '熊野大権現'.split('').forEach((ch, i) => g.fillText(ch, 34, 40 + i * 34));
    });
  }
  function ootorii() {
    add('ootorii', 560, 520, 10500, (g, w, h) => {
      // 周辺の田んぼと木立
      g.fillStyle = '#6d8f3a'; g.fillRect(0, h - 26, w, 26);
      for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#2f5530' : '#3b6a3a'; g.beginPath(); g.arc(20 + i * 30, h - 26, 22, Math.PI, 0); g.fill(); }
      const c = '#2c2c2e', hl = '#47474b';
      const pw = 42;
      // 柱
      g.fillStyle = c;
      g.beginPath(); g.moveTo(118, 96); g.lineTo(118 + pw, 96); g.lineTo(126 + pw, h - 20); g.lineTo(110, h - 20); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(w - 118 - pw, 96); g.lineTo(w - 118, 96); g.lineTo(w - 110, h - 20); g.lineTo(w - 126 - pw, h - 20); g.closePath(); g.fill();
      g.fillStyle = hl; g.fillRect(122, 96, 10, h - 120); g.fillRect(w - 156, 96, 10, h - 120);
      // 根巻
      g.fillStyle = '#1b1b1d'; g.fillRect(100, h - 60, pw + 36, 40); g.fillRect(w - 136 - pw, h - 60, pw + 36, 40);
      // 貫
      g.fillStyle = c; g.fillRect(70, 150, w - 140, 24);
      // 島木・笠木
      g.beginPath(); g.moveTo(36, 72); g.quadraticCurveTo(w / 2, 92, w - 36, 72); g.lineTo(w - 44, 100); g.quadraticCurveTo(w / 2, 112, 44, 100); g.closePath(); g.fill();
      g.fillStyle = '#161618';
      g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(w / 2, 70, w, 30); g.lineTo(w - 14, 74); g.quadraticCurveTo(w / 2, 96, 14, 74); g.closePath(); g.fill();
      // 額
      g.fillStyle = c; g.fillRect(w / 2 - 34, 98, 68, 54);
      g.fillStyle = '#e9e4d6'; g.fillRect(w / 2 - 26, 104, 52, 42);
      g.font = `900 13px ${FONT}`; g.fillStyle = '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('熊野', w / 2, 116); g.fillText('大権現', w / 2, 134);
    });
  }
  function hongu() {
    add('hongu', 600, 360, 5600, (g, w, h) => {
      const r = rng(77);
      // 杉木立
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = 30 + r() * 120, s = 40 + r() * 40;
        poly(g, i % 2 ? '#1d4529' : '#24532f', [x, y, x + s * 0.6, y + s * 2.4, x - s * 0.6, y + s * 2.4]);
      }
      g.fillStyle = '#2a5a33'; g.fillRect(0, 190, w, 110);
      // 社殿（檜皮葺）
      g.fillStyle = '#6a4a32';
      g.beginPath(); g.moveTo(130, 150); g.quadraticCurveTo(w / 2, 120, w - 130, 150); g.lineTo(w - 180, 90); g.lineTo(180, 90); g.closePath(); g.fill();
      g.fillStyle = '#4e3524'; g.fillRect(176, 82, w - 352, 12);
      g.strokeStyle = '#4e3524'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(170, 50); g.lineTo(200, 92); g.moveTo(w - 170, 50); g.lineTo(w - 200, 92); g.stroke();
      g.fillStyle = '#efe6d0'; g.fillRect(170, 150, w - 340, 50);
      g.fillStyle = '#8a6a48'; for (let x = 170; x < w - 170; x += 40) g.fillRect(x, 150, 8, 50);
      // 石段
      g.fillStyle = '#a5a29a';
      for (let i = 0; i < 9; i++) g.fillRect(w / 2 - 50 - i * 9, 200 + i * 16, 100 + i * 18, 12);
      g.fillStyle = '#8b887f';
      for (let i = 0; i < 9; i++) g.fillRect(w / 2 - 50 - i * 9, 212 + i * 16, 100 + i * 18, 4);
      // 幟
      for (let i = 0; i < 6; i++) {
        const lx = w / 2 - 110 - i * 30, rx = w / 2 + 110 + i * 30, top = 180 + i * 14;
        [lx, rx].forEach(x => { g.fillStyle = '#f6f2e8'; g.fillRect(x, top, 12, 80); g.fillStyle = '#222'; g.fillRect(x, top, 12, 6); g.fillStyle = '#6b5a40'; g.fillRect(x - 3, top - 6, 3, 100); });
      }
      // 社号標
      g.fillStyle = '#b8b4a8'; g.fillRect(40, 180, 50, 170);
      g.font = `900 22px ${FONT}`; g.fillStyle = '#333'; g.textAlign = 'center'; g.textBaseline = 'top';
      '熊野本宮大社'.split('').forEach((ch, i) => g.fillText(ch, 65, 188 + i * 26));
    });
  }
  function hayatama() {
    add('hayatama', 520, 280, 4600, (g, w, h) => {
      g.fillStyle = '#2f5b35';
      g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(w / 2, 10, w, 110); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#c8c4b8'; g.fillRect(0, h - 30, w, 30);
      const red = '#d2402e';
      g.fillStyle = red; g.fillRect(100, 140, w - 200, 110);
      g.fillStyle = '#f2ecdc'; for (let x = 120; x < w - 120; x += 50) g.fillRect(x, 160, 30, 60);
      g.fillStyle = '#3e6a5a';
      g.beginPath(); g.moveTo(70, 146); g.quadraticCurveTo(w / 2, 116, w - 70, 146); g.lineTo(w - 120, 90); g.lineTo(120, 90); g.closePath(); g.fill();
      g.fillStyle = '#d4af37'; g.fillRect(118, 84, w - 236, 8);
      // 鳥居
      g.fillStyle = red; g.fillRect(30, 150, 14, 110); g.fillRect(120, 150, 14, 110); g.fillRect(16, 172, 132, 10);
      g.fillStyle = '#222'; g.fillRect(8, 138, 148, 14);
    });
  }
  function gotobiki() {
    add('gotobiki', 520, 440, 9500, (g, w, h) => {
      g.fillStyle = '#355e36';
      g.beginPath(); g.moveTo(0, h); g.quadraticCurveTo(w * 0.3, 120, w * 0.55, 110); g.quadraticCurveTo(w * 0.8, 130, w, h); g.fill();
      const r = rng(12);
      for (let i = 0; i < 60; i++) { g.fillStyle = ['#2c5230', '#3f6d3c', '#2a4a2c'][i % 3]; g.beginPath(); g.arc(r() * w, 180 + r() * (h - 180), 12 + r() * 16, 0, 7); g.fill(); }
      // ゴトビキ岩
      g.fillStyle = '#8c8578';
      g.beginPath(); g.moveTo(w * 0.42, 140); g.quadraticCurveTo(w * 0.43, 40, w * 0.52, 34); g.quadraticCurveTo(w * 0.62, 40, w * 0.62, 140); g.closePath(); g.fill();
      g.fillStyle = '#6d675c';
      g.beginPath(); g.moveTo(w * 0.55, 40); g.quadraticCurveTo(w * 0.62, 50, w * 0.62, 140); g.lineTo(w * 0.56, 140); g.closePath(); g.fill();
      g.strokeStyle = '#e8dcb0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w * 0.42, 110); g.quadraticCurveTo(w * 0.52, 120, w * 0.62, 110); g.stroke();
      g.fillStyle = '#d2402e'; g.fillRect(w * 0.47, 132, 26, 16);
    });
  }
  function iwafune() {
    add('iwafune', 440, 300, 4200, (g, w, h) => {
      shadow(g, w / 2, h - 8, w * 0.48, 10);
      g.fillStyle = '#3d6b3a'; g.fillRect(0, h - 20, w, 20);
      g.fillStyle = '#857d70';
      g.beginPath(); g.moveTo(20, h - 20); g.quadraticCurveTo(10, 90, 120, 60); g.quadraticCurveTo(260, 20, 400, 80); g.quadraticCurveTo(440, 160, 420, h - 20); g.closePath(); g.fill();
      g.fillStyle = '#6a6358';
      g.beginPath(); g.moveTo(250, 40); g.quadraticCurveTo(400, 70, 420, h - 20); g.lineTo(300, h - 20); g.closePath(); g.fill();
      g.strokeStyle = '#5a5348'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(80, 120); g.lineTo(200, 100); g.moveTo(140, 170); g.lineTo(300, 150); g.stroke();
      // しめ縄・紙垂
      g.strokeStyle = '#d8c27a'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(40, 140); g.quadraticCurveTo(220, 170, 410, 130); g.stroke();
      g.fillStyle = '#fff';
      for (let x = 80; x < 400; x += 60) g.fillRect(x, 152 + Math.sin(x) * 4, 8, 22);
      // 小鳥居
      g.fillStyle = '#c8322a'; g.fillRect(170, 210, 10, 70); g.fillRect(240, 210, 10, 70); g.fillRect(160, 220, 100, 7);
      g.fillStyle = '#222'; g.fillRect(154, 204, 112, 9);
    });
  }
  function suspension(key, worldW, tower, deck, opts = {}) {
    add(key, 1200, 360, worldW, (g, w, h) => {
      const deckY = opts.deckY || h * 0.62;
      const t1 = w * 0.08, t2 = w * 0.92, top = h * 0.12;
      if (opts.trees) {
        const r = rng(5);
        for (let i = 0; i < 90; i++) { g.fillStyle = ['#2a5230', '#36643a', '#a0502a', '#c8862a'][Math.floor(r() * (opts.autumn ? 4 : 2))]; g.beginPath(); g.arc(r() * w, deckY + 20 + r() * (h - deckY), 18 + r() * 20, 0, 7); g.fill(); }
      }
      // 主塔
      [t1, t2].forEach(x => { g.fillStyle = tower; g.fillRect(x - 8, top, 16, h - top); g.fillRect(x - 26, top, 52, 8); g.fillRect(x - 26, deckY - 30, 52, 6); });
      // メインケーブル
      g.strokeStyle = shade(tower, 0.8); g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, h * 0.45); g.lineTo(t1, top + 4); g.quadraticCurveTo(w / 2, deckY + 40, t2, top + 4); g.lineTo(w, h * 0.45); g.stroke();
      // ハンガー
      g.lineWidth = 1;
      for (let x = t1 + 12; x < t2; x += 14) {
        const t = (x - t1) / (t2 - t1);
        const cy = (1 - t) * (1 - t) * (top + 4) + 2 * t * (1 - t) * (deckY + 40) + t * t * (top + 4);
        g.beginPath(); g.moveTo(x, cy); g.lineTo(x, deckY); g.stroke();
      }
      // 床版
      g.fillStyle = deck; g.fillRect(0, deckY, w, 7);
      g.fillStyle = shade(deck, 0.7); g.fillRect(0, deckY + 7, w, 3);
      if (opts.people) { g.fillStyle = '#d33'; g.fillRect(w * 0.4, deckY - 10, 4, 10); g.fillStyle = '#36c'; g.fillRect(w * 0.45, deckY - 10, 4, 10); g.fillStyle = '#fc0'; g.fillRect(w * 0.6, deckY - 10, 4, 10); }
    });
  }
  function dam(key, worldW) {
    add(key, 1000, 320, worldW, (g, w, h) => {
      g.fillStyle = '#2f5634';
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, 40); g.quadraticCurveTo(120, 10, 200, 60); g.lineTo(200, h); g.fill();
      g.beginPath(); g.moveTo(w, h); g.lineTo(w, 30); g.quadraticCurveTo(w - 120, 10, w - 200, 60); g.lineTo(w - 200, h); g.fill();
      g.fillStyle = '#b4b2aa';
      g.beginPath(); g.moveTo(180, 60); g.lineTo(w - 180, 60); g.lineTo(w - 150, h); g.lineTo(150, h); g.closePath(); g.fill();
      g.fillStyle = '#9a988f';
      for (let y = 90; y < h; y += 40) g.fillRect(170, y, w - 340, 3);
      g.fillStyle = '#8a8880'; g.fillRect(170, 50, w - 340, 16);
      for (let x = 260; x < w - 260; x += 80) { g.fillStyle = '#6d6b64'; g.fillRect(x, 66, 40, 50); g.fillStyle = 'rgba(220,240,255,0.7)'; g.fillRect(x + 6, 116, 28, h - 116); }
    });
  }
  function onsen(key, name) {
    add(key, 380, 300, 2900, (g, w, h) => {
      shadow(g, w / 2, h - 4, w * 0.48, 6);
      // 湯気
      for (let i = 0; i < 4; i++) {
        g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 8;
        g.beginPath(); const x = 230 + i * 30; g.moveTo(x, 110); g.bezierCurveTo(x - 20, 80, x + 20, 60, x, 20); g.stroke();
      }
      g.fillStyle = '#7a5a3a'; g.fillRect(30, 150, w - 60, h - 154);
      g.fillStyle = '#e9dfc6'; for (let x = 50; x < w - 60; x += 60) g.fillRect(x, 170, 40, 50);
      g.fillStyle = '#3a2a1e'; g.fillRect(w / 2 - 25, h - 70, 50, 66);
      g.fillStyle = '#5a6a74';
      g.beginPath(); g.moveTo(10, 156); g.quadraticCurveTo(w / 2, 130, w - 10, 156); g.lineTo(w - 50, 104); g.lineTo(50, 104); g.closePath(); g.fill();
      // のれん
      g.fillStyle = '#1f3d7a'; g.fillRect(w / 2 - 34, h - 72, 68, 24);
      text(g, 'ゆ', w / 2, h - 60, 18, '#fff');
      // 看板
      g.fillStyle = '#fff8e6'; rrect(g, 20, 40, 150, 64, 8); g.fill();
      g.strokeStyle = '#b22'; g.lineWidth = 4; g.stroke();
      text(g, '♨', 52, 72, 40, '#d0302a');
      text(g, name, 120, 64, 20, '#222', { maxW: 86 });
      text(g, '温泉', 120, 88, 18, '#b22');
    });
  }
  function hoshinokuni() {
    add('hoshinokuni', 380, 300, 3200, (g, w, h) => {
      shadow(g, w / 2, h - 4, w * 0.48, 6);
      g.fillStyle = '#efefef'; g.fillRect(40, 140, w - 80, h - 144);
      g.fillStyle = '#c0c6cc'; g.fillRect(40, 140, w - 80, 10);
      g.fillStyle = '#7fa7c9'; for (let x = 60; x < w - 60; x += 50) g.fillRect(x, 170, 34, 40);
      g.fillStyle = '#dfe3e8'; g.fillRect(w / 2 - 50, 90, 100, 52);
      const gr = g.createLinearGradient(0, 30, 0, 100); gr.addColorStop(0, '#f8f9fb'); gr.addColorStop(1, '#a9b2bc');
      g.fillStyle = gr; g.beginPath(); g.arc(w / 2, 96, 58, Math.PI, 0); g.fill();
      g.fillStyle = '#4a5560'; g.fillRect(w / 2 - 6, 40, 12, 56);
      for (let i = 0; i < 5; i++) text(g, '★', 40 + i * 70, 30 + (i % 2) * 20, 22, '#f5c518');
      text(g, '星のくに', w / 2, h - 30, 26, '#2a3a6a');
    });
  }
  function michi(key, name) {
    add(key, 440, 250, 3400, (g, w, h) => {
      shadow(g, w / 2, h - 4, w * 0.48, 6);
      g.fillStyle = '#c9a77a'; g.fillRect(20, 120, w - 40, h - 124);
      g.fillStyle = '#a7d0e8'; g.fillRect(40, 150, w - 80, 60);
      g.fillStyle = '#5a4030';
      g.beginPath(); g.moveTo(0, 126); g.lineTo(w, 126); g.lineTo(w - 40, 80); g.lineTo(40, 80); g.closePath(); g.fill();
      // 看板
      post(g, 60, 40, h, 8); post(g, w - 60, 40, h, 8);
      g.fillStyle = '#1a4fa0'; rrect(g, 30, 6, w - 60, 66, 8); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; rrect(g, 36, 12, w - 72, 54, 6); g.stroke();
      text(g, '道の駅', 100, 39, 22, '#fff');
      text(g, name, w / 2 + 50, 39, 26, '#fff', { maxW: w - 220 });
    });
  }
  function hatenashiVillage() {
    add('hatenashi', 760, 420, 9000, (g, w, h) => {
      const r = rng(31);
      g.fillStyle = '#3f6a3a';
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, 120); g.quadraticCurveTo(w * 0.5, 0, w, 90); g.lineTo(w, h); g.fill();
      // 段々畑
      for (let i = 0; i < 7; i++) {
        const y = 150 + i * 36;
        g.fillStyle = i % 2 ? '#88a64a' : '#a2b85a';
        g.fillRect(60 + i * 10, y, w - 140 - i * 20, 22);
        g.fillStyle = '#7a7364'; g.fillRect(60 + i * 10, y + 22, w - 140 - i * 20, 5);
      }
      // 民家
      for (let i = 0; i < 6; i++) {
        const x = 90 + r() * (w - 220), y = 140 + Math.floor(r() * 6) * 36;
        g.fillStyle = '#e8e0cc'; g.fillRect(x, y - 24, 60, 24);
        g.fillStyle = '#4a5560'; g.beginPath(); g.moveTo(x - 8, y - 22); g.lineTo(x + 30, y - 46); g.lineTo(x + 68, y - 22); g.fill();
      }
      for (let i = 0; i < 40; i++) { g.fillStyle = ['#244a2a', '#2f5a33'][i % 2]; const x = r() * w, y = 60 + r() * 80; poly(g, g.fillStyle, [x, y, x + 14, y + 50, x - 14, y + 50]); }
      // 石畳の古道
      g.strokeStyle = '#9c968a'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(w * 0.15, h); g.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.6, w * 0.7, 40); g.stroke();
    });
  }
  function boat() {
    add('boat', 320, 120, 1700, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(w / 2, h - 10, w * 0.5, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#7a5434';
      g.beginPath(); g.moveTo(0, 70); g.lineTo(w, 60); g.lineTo(w - 30, h - 12); g.lineTo(30, h - 12); g.closePath(); g.fill();
      g.fillStyle = '#5a3c24'; g.fillRect(40, 64, w - 70, 6);
      g.fillStyle = '#c9b48a'; g.fillRect(80, 20, 160, 8);
      g.fillStyle = '#6b4a30'; g.fillRect(84, 26, 4, 40); g.fillRect(232, 26, 4, 40);
      [110, 140, 170, 200].forEach((x, i) => { g.fillStyle = ['#c33', '#36c', '#fc3', '#3a3'][i]; g.fillRect(x, 44, 14, 20); g.fillStyle = '#f2d1b0'; g.beginPath(); g.arc(x + 7, 40, 6, 0, 7); g.fill(); });
    });
  }

  // ---------- 標識 ----------
  function sign168() {
    add('sign168', 130, 260, 560, (g, w, h) => {
      post(g, w / 2, 100, h, 8);
      const p = () => { g.beginPath(); g.moveTo(10, 12); g.lineTo(w - 10, 12); g.quadraticCurveTo(w - 4, 70, w / 2, 118); g.quadraticCurveTo(4, 70, 10, 12); g.closePath(); };
      g.fillStyle = '#fff'; p(); g.fill();
      g.save(); g.translate(w / 2, 62); g.scale(0.86, 0.86); g.translate(-w / 2, -62); g.fillStyle = '#1f4fa8'; p(); g.fill(); g.restore();
      text(g, '168', w / 2, 52, 40, '#fff', { font: TITLE_FONT, weight: 400 });
      text(g, 'ROUTE', w / 2, 82, 13, '#fff', { weight: 700 });
    });
  }
  function warning(key, draw, plate) {
    add(key, 160, 300, 640, (g, w, h) => {
      post(g, w / 2, 120, h, 8);
      g.save(); g.translate(w / 2, 74); g.rotate(Math.PI / 4);
      g.fillStyle = '#222'; rrect(g, -50, -50, 100, 100, 8); g.fill();
      g.fillStyle = '#f6c500'; rrect(g, -45, -45, 90, 90, 6); g.fill();
      g.restore();
      g.save(); g.translate(w / 2, 74); draw(g); g.restore();
      if (plate) {
        g.fillStyle = '#fff'; g.fillRect(14, 150, w - 28, 40); g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(14, 150, w - 28, 40);
        text(g, plate, w / 2, 170, 22, '#222', { maxW: w - 36 });
      }
    });
  }
  function blueSign(lines, worldW, opts = {}) {
    const lw = opts.w || 420, lh = opts.h || 170;
    return make(lw, lh + 140, worldW, (g, w, h) => {
      post(g, 60, lh - 10, h, 10); post(g, w - 60, lh - 10, h, 10);
      g.fillStyle = opts.bg || '#1a4fa0'; rrect(g, 4, 4, w - 8, lh, 10); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; rrect(g, 12, 12, w - 24, lh - 16, 7); g.stroke();
      const n = lines.length;
      lines.forEach((ln, i) => {
        const big = i === 0;
        const y = n === 1 ? lh / 2 + 4 : (big ? lh * 0.42 : lh * 0.42 + 40 + (i - 1) * 26);
        text(g, ln, w / 2, y, big ? (n === 1 ? 56 : 52) : 22, '#fff', { maxW: w - 50, weight: big ? 900 : 700 });
      });
    });
  }
  function brownSign(lines, worldW) {
    return make(360, 280, worldW, (g, w, h) => {
      post(g, w / 2, 100, h, 12, '#6b4a2a');
      g.fillStyle = '#5a3a22'; rrect(g, 6, 6, w - 12, 130, 8); g.fill();
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 3; rrect(g, 14, 14, w - 28, 114, 6); g.stroke();
      text(g, lines[0], w / 2, 54, 40, '#fff6e0', { maxW: w - 40 });
      if (lines[1]) text(g, lines[1], w / 2, 104, 22, '#fff6e0', { maxW: w - 40, weight: 700 });
    });
  }
  function gate(title, sub, color) {
    return make(800, 300, 4000, (g, w, h) => {
      const c = color || '#d6312b';
      post(g, 30, 20, h, 22, '#e6e6e6'); post(g, w - 30, 20, h, 22, '#e6e6e6');
      g.fillStyle = c; rrect(g, 0, 20, w, 110, 12); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 22, w, 30);
      g.strokeStyle = '#fff'; g.lineWidth = 5; rrect(g, 10, 30, w - 20, 90, 8); g.stroke();
      text(g, title, w / 2, 66, 48, '#fff', { font: TITLE_FONT, weight: 400, maxW: w - 60 });
      if (sub) text(g, sub, w / 2, 104, 24, '#fff', { weight: 900, maxW: w - 60 });
      // チェッカー
      for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(i * 40, 0, 40, 10); g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(i * 40, 10, 40, 10); }
    });
  }
  function plate(name) {
    return make(360, 70, 2400, (g, w, h) => {
      g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#555'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      text(g, name, w / 2, h / 2 + 2, 34, '#222', { maxW: w - 30 });
    });
  }
  function delineator() {
    add('delineator', 24, 120, 44, (g, w, h) => {
      g.fillStyle = '#d6d6d6'; g.fillRect(w / 2 - 3, 20, 6, h - 20);
      g.fillStyle = '#ff8c1a'; g.beginPath(); g.arc(w / 2, 16, 11, 0, 7); g.fill();
      g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(w / 2 - 3, 13, 4, 0, 7); g.fill();
    });
  }
  function rock(key, seed) {
    add(key, 160, 130, 420, (g, w, h) => {
      const r = rng(seed);
      shadow(g, w / 2, h - 8, w * 0.46, 9, 0.4);
      const pts = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        const rad = 0.75 + r() * 0.25;
        pts.push(w / 2 + Math.cos(a) * w * 0.46 * rad, h - 10 + Math.sin(a) * (h - 20) * rad);
      }
      poly(g, '#7d776c', pts);
      g.fillStyle = '#958e81';
      g.beginPath(); g.ellipse(w * 0.4, h * 0.42, w * 0.2, h * 0.16, -0.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath(); g.moveTo(w * 0.55, h * 0.2); g.lineTo(w * 0.95, h - 12); g.lineTo(w * 0.5, h - 12); g.fill();
      g.strokeStyle = '#5c574e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(w * 0.3, h * 0.6); g.lineTo(w * 0.5, h * 0.5); g.lineTo(w * 0.6, h * 0.7); g.stroke();
    });
  }

  // ---------- 車 ----------
  function carSprite(type, view, color, idx) {
    const key = `car_${type}_${view}_${idx}`;
    const dims = { sedan: [200, 150, 640], kei: [170, 170, 540], keitruck: [180, 150, 540], truck: [230, 280, 840], bus: [240, 290, 880] }[type];
    const spr = add(key, dims[0], dims[1], dims[2], (g, w, h) => {
      shadow(g, w / 2, h - 8, w * 0.5, 10, 0.45);
      const dk = shade(color, 0.7), lt = shade(color, 1.25);
      const tire = (x) => { g.fillStyle = '#151515'; rrect(g, x, h - 34, w * 0.14, 28, 4); g.fill(); };
      tire(w * 0.08); tire(w * 0.78);
      if (type === 'sedan' || type === 'kei') {
        const bodyTop = type === 'kei' ? h * 0.48 : h * 0.42;
        const cabTop = type === 'kei' ? h * 0.06 : h * 0.12;
        const inset = type === 'kei' ? 0.1 : 0.17;
        // キャビン
        g.fillStyle = dk;
        g.beginPath(); g.moveTo(w * 0.1, bodyTop); g.lineTo(w * inset + 4, cabTop); g.lineTo(w * (1 - inset) - 4, cabTop); g.lineTo(w * 0.9, bodyTop); g.closePath(); g.fill();
        const gl = g.createLinearGradient(0, cabTop, 0, bodyTop);
        gl.addColorStop(0, view === 'front' ? '#9fb7c9' : '#2c3a48'); gl.addColorStop(1, view === 'front' ? '#4d6475' : '#121a22');
        g.fillStyle = gl;
        g.beginPath(); g.moveTo(w * 0.15, bodyTop - 4); g.lineTo(w * inset + 10, cabTop + 8); g.lineTo(w * (1 - inset) - 10, cabTop + 8); g.lineTo(w * 0.85, bodyTop - 4); g.closePath(); g.fill();
        // ボディ
        g.fillStyle = color; rrect(g, w * 0.04, bodyTop, w * 0.92, h * 0.86 - bodyTop, 12); g.fill();
        g.fillStyle = lt; g.fillRect(w * 0.06, bodyTop + 4, w * 0.88, 5);
        g.fillStyle = '#2a2a2a'; rrect(g, w * 0.05, h * 0.74, w * 0.9, h * 0.1, 5); g.fill();
        if (view === 'rear') {
          g.fillStyle = '#e0261b'; rrect(g, w * 0.07, bodyTop + 14, w * 0.2, h * 0.1, 4); g.fill(); rrect(g, w * 0.73, bodyTop + 14, w * 0.2, h * 0.1, 4); g.fill();
          g.fillStyle = '#ff9a8a'; g.fillRect(w * 0.1, bodyTop + 17, w * 0.06, 4); g.fillRect(w * 0.76, bodyTop + 17, w * 0.06, 4);
        } else {
          g.fillStyle = '#fff6d6'; rrect(g, w * 0.07, bodyTop + 12, w * 0.2, h * 0.09, 6); g.fill(); rrect(g, w * 0.73, bodyTop + 12, w * 0.2, h * 0.09, 6); g.fill();
          g.fillStyle = '#333'; rrect(g, w * 0.33, bodyTop + 14, w * 0.34, h * 0.1, 4); g.fill();
        }
        g.fillStyle = type === 'kei' ? '#f2d400' : '#f4f4f4'; g.fillRect(w * 0.39, h * 0.62, w * 0.22, h * 0.1);
        text(g, '168', w / 2, h * 0.67, 12, '#185', { weight: 700 });
      } else if (type === 'keitruck') {
        if (view === 'rear') {
          g.fillStyle = '#e8e8e8'; rrect(g, w * 0.2, h * 0.08, w * 0.6, h * 0.4, 8); g.fill();
          g.fillStyle = '#26323d'; g.fillRect(w * 0.27, h * 0.14, w * 0.46, h * 0.18);
          g.fillStyle = '#9aa0a6'; g.fillRect(w * 0.08, h * 0.36, w * 0.84, h * 0.06);
          g.fillStyle = '#f0f0f0'; g.fillRect(w * 0.06, h * 0.42, w * 0.88, h * 0.3);
          g.strokeStyle = '#c9c9c9'; g.lineWidth = 2; for (let x = w * 0.12; x < w * 0.9; x += w * 0.1) { g.beginPath(); g.moveTo(x, h * 0.44); g.lineTo(x, h * 0.7); g.stroke(); }
          g.fillStyle = '#e0261b'; g.fillRect(w * 0.06, h * 0.72, w * 0.14, h * 0.08); g.fillRect(w * 0.8, h * 0.72, w * 0.14, h * 0.08);
          g.fillStyle = '#f2d400'; g.fillRect(w * 0.4, h * 0.73, w * 0.2, h * 0.09);
        } else {
          g.fillStyle = '#ececec'; rrect(g, w * 0.08, h * 0.08, w * 0.84, h * 0.76, 14); g.fill();
          g.fillStyle = '#6e8ca3'; rrect(g, w * 0.14, h * 0.14, w * 0.72, h * 0.3, 6); g.fill();
          g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(w * 0.22, h * 0.6, 13, 0, 7); g.arc(w * 0.78, h * 0.6, 13, 0, 7); g.fill();
          g.fillStyle = '#555'; g.fillRect(w * 0.36, h * 0.56, w * 0.28, h * 0.08);
          g.fillStyle = '#f2d400'; g.fillRect(w * 0.4, h * 0.7, w * 0.2, h * 0.09);
        }
      } else if (type === 'truck') {
        if (view === 'rear') {
          g.fillStyle = color; g.fillRect(w * 0.03, h * 0.04, w * 0.94, h * 0.72);
          g.fillStyle = dk; g.fillRect(w * 0.495, h * 0.06, 3, h * 0.7);
          g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; for (let y = h * 0.1; y < h * 0.7; y += 18) { g.beginPath(); g.moveTo(w * 0.05, y); g.lineTo(w * 0.95, y); g.stroke(); }
          g.fillStyle = '#333'; g.fillRect(w * 0.03, h * 0.76, w * 0.94, h * 0.08);
          g.fillStyle = '#e0261b'; g.fillRect(w * 0.06, h * 0.78, w * 0.12, h * 0.05); g.fillRect(w * 0.82, h * 0.78, w * 0.12, h * 0.05);
          g.fillStyle = '#f4f4f4'; g.fillRect(w * 0.4, h * 0.66, w * 0.2, h * 0.08);
        } else {
          g.fillStyle = color; rrect(g, w * 0.05, h * 0.18, w * 0.9, h * 0.62, 10); g.fill();
          g.fillStyle = '#ddd'; g.fillRect(w * 0.08, h * 0.03, w * 0.84, h * 0.16);
          g.fillStyle = '#6e8ca3'; g.fillRect(w * 0.1, h * 0.24, w * 0.8, h * 0.24);
          g.fillStyle = '#333'; g.fillRect(w * 0.2, h * 0.56, w * 0.6, h * 0.12);
          g.strokeStyle = '#777'; g.lineWidth = 2; for (let y = h * 0.58; y < h * 0.67; y += 6) { g.beginPath(); g.moveTo(w * 0.22, y); g.lineTo(w * 0.78, y); g.stroke(); }
          g.fillStyle = '#fff6d6'; g.fillRect(w * 0.06, h * 0.6, w * 0.12, h * 0.07); g.fillRect(w * 0.82, h * 0.6, w * 0.12, h * 0.07);
        }
      } else if (type === 'bus') {
        g.fillStyle = '#f2f2ee'; rrect(g, w * 0.03, h * 0.03, w * 0.94, h * 0.8, 14); g.fill();
        g.fillStyle = '#c23b2e'; g.fillRect(w * 0.03, h * 0.58, w * 0.94, h * 0.05);
        g.fillStyle = '#2b5ba8'; g.fillRect(w * 0.03, h * 0.64, w * 0.94, h * 0.03);
        if (view === 'rear') {
          g.fillStyle = '#25313c'; g.fillRect(w * 0.12, h * 0.1, w * 0.76, h * 0.22);
          g.fillStyle = '#e0261b'; g.fillRect(w * 0.06, h * 0.7, w * 0.1, h * 0.08); g.fillRect(w * 0.84, h * 0.7, w * 0.1, h * 0.08);
          g.fillStyle = '#ddd'; g.fillRect(w * 0.3, h * 0.36, w * 0.4, h * 0.16);
          text(g, '特急 新宮行', w / 2, h * 0.44, 16, '#c23b2e', { maxW: w * 0.38 });
        } else {
          g.fillStyle = '#111'; g.fillRect(w * 0.1, h * 0.06, w * 0.8, h * 0.1);
          text(g, '新宮', w / 2, h * 0.11, 22, '#ffa21a');
          g.fillStyle = '#7f9db3'; g.fillRect(w * 0.08, h * 0.18, w * 0.84, h * 0.34);
          g.fillStyle = '#fff6d6'; g.fillRect(w * 0.08, h * 0.7, w * 0.14, h * 0.07); g.fillRect(w * 0.78, h * 0.7, w * 0.14, h * 0.07);
        }
        g.fillStyle = '#333'; g.fillRect(w * 0.03, h * 0.8, w * 0.94, h * 0.06);
      }
    });
    return spr;
  }
  function buildCars() {
    const types = {
      sedan: ['#e4e4e2', '#2b2b2d', '#b3262b', '#2a4f8f', '#a2a8ae', '#3d6b4f'],
      kei: ['#f1e6c8', '#9fc6d9', '#f4b6b6', '#efefef', '#a7c78a'],
      keitruck: ['#efefef'],
      truck: ['#e9e9e9', '#3b6ea8', '#4f8a5a'],
      bus: ['#f2f2ee'],
    };
    Object.keys(types).forEach(t => {
      cars[t] = { rear: [], front: [] };
      types[t].forEach((c, i) => { cars[t].rear.push(carSprite(t, 'rear', c, i)); cars[t].front.push(carSprite(t, 'front', c, i)); });
    });
  }

  // ---------- プレイヤー ----------
  function bike() {
    add('bike', 160, 220, 300, (g, w, h) => {
      shadow(g, w / 2, h - 6, w * 0.28, 8, 0.5);
      // 後輪
      g.fillStyle = '#111'; rrect(g, w / 2 - 16, h - 70, 32, 66, 12); g.fill();
      g.fillStyle = '#333'; g.fillRect(w / 2 - 4, h - 66, 8, 58);
      // マフラー
      g.fillStyle = '#b8bcc2'; rrect(g, w / 2 + 18, h - 74, 18, 40, 6); g.fill();
      g.fillStyle = '#7d8187'; g.beginPath(); g.arc(w / 2 + 27, h - 38, 7, 0, 7); g.fill();
      // リアカウル
      g.fillStyle = '#c8102e';
      g.beginPath(); g.moveTo(w / 2 - 30, h - 96); g.lineTo(w / 2 + 30, h - 96); g.lineTo(w / 2 + 20, h - 68); g.lineTo(w / 2 - 20, h - 68); g.closePath(); g.fill();
      g.fillStyle = '#ff2a2a'; rrect(g, w / 2 - 18, h - 88, 36, 10, 4); g.fill();
      g.fillStyle = '#ffd400'; g.fillRect(w / 2 - 30, h - 92, 8, 6); g.fillRect(w / 2 + 22, h - 92, 8, 6);
      g.fillStyle = '#eee'; g.fillRect(w / 2 - 14, h - 76, 28, 10);
      text(g, '168', w / 2, h - 71, 9, '#185', { weight: 900 });
      // ハンドル・ミラー
      g.strokeStyle = '#222'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(14, h - 150); g.lineTo(w - 14, h - 150); g.stroke();
      g.fillStyle = '#222'; g.fillRect(4, h - 176, 18, 12); g.fillRect(w - 22, h - 176, 18, 12);
      g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, h - 164); g.lineTo(22, h - 150); g.moveTo(w - 14, h - 164); g.lineTo(w - 22, h - 150); g.stroke();
      // ライダー：脚
      g.fillStyle = '#1d2a44';
      rrect(g, w / 2 - 40, h - 128, 22, 52, 8); g.fill(); rrect(g, w / 2 + 18, h - 128, 22, 52, 8); g.fill();
      g.fillStyle = '#111'; g.fillRect(w / 2 - 42, h - 84, 24, 14); g.fillRect(w / 2 + 18, h - 84, 24, 14);
      // 胴体（ジャケット）
      g.fillStyle = '#d7d9dc';
      g.beginPath(); g.moveTo(w / 2 - 36, h - 120); g.quadraticCurveTo(w / 2 - 44, h - 170, w / 2 - 26, h - 182); g.lineTo(w / 2 + 26, h - 182); g.quadraticCurveTo(w / 2 + 44, h - 170, w / 2 + 36, h - 120); g.closePath(); g.fill();
      g.fillStyle = '#c8102e'; g.fillRect(w / 2 - 36, h - 160, 72, 14);
      text(g, '★', w / 2, h - 133, 22, '#f5c518');
      // 腕
      g.strokeStyle = '#d7d9dc'; g.lineWidth = 13; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w / 2 - 28, h - 172); g.lineTo(20, h - 150); g.moveTo(w / 2 + 28, h - 172); g.lineTo(w - 20, h - 150); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.arc(19, h - 150, 7, 0, 7); g.arc(w - 19, h - 150, 7, 0, 7); g.fill();
      // ヘルメット
      const hg = g.createRadialGradient(w / 2 - 8, h - 205, 4, w / 2, h - 196, 26);
      hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#c9ccd2');
      g.fillStyle = hg; g.beginPath(); g.ellipse(w / 2, h - 196, 22, 22, 0, 0, 7); g.fill();
      g.fillStyle = '#1f4fa8'; g.fillRect(w / 2 - 22, h - 198, 44, 6);
      text(g, '★', w / 2, h - 208, 14, '#f5c518');
    });
  }

  // ---------- 背景レイヤー ----------
  const BG_W = 2048, BG_H = 512;
  function ridge(g, base, comps, color, r, opts = {}) {
    const cs = comps.map(([k, a]) => ({ k, a, ph: r() * Math.PI * 2 }));
    const f = (x) => {
      let y = base;
      for (const c of cs) {
        const s = Math.sin(c.k * Math.PI * 2 * x / BG_W + c.ph);
        y -= opts.sharp ? c.a * (1 - Math.abs(s)) * 1.4 - c.a * 0.5 : c.a * s;
      }
      return y;
    };
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, BG_H);
    for (let x = 0; x <= BG_W; x += 4) g.lineTo(x, f(x));
    g.lineTo(BG_W, BG_H); g.closePath(); g.fill();
    return f;
  }
  function speckle(g, f, colors, n, r, depth) {
    for (let i = 0; i < n; i++) {
      const x = r() * BG_W; const y0 = f(x);
      const y = y0 + 4 + r() * (depth || 120);
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      g.beginPath(); g.arc(x, y, 3 + r() * 7, 0, 7); g.fill();
    }
  }
  function layer(seed, fn) { const c = canvas(BG_W, BG_H); fn(c.getContext('2d'), rng(seed)); return c; }
  function mist(g, y, hgt, a) {
    const gr = g.createLinearGradient(0, y - hgt, 0, y + hgt);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(240,245,250,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, y - hgt, BG_W, hgt * 2);
  }
  function label(g, f, x, str) {
    const y = f(x) - 22;
    g.font = `700 22px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.textAlign = 'center';
    g.fillText(str, x, y);
  }
  const themes = {};
  function buildThemes() {
    // 各レイヤー: {img, h: 画面高さに対する比, p: パララックス係数}
    themes.city = [
      { img: layer(1, (g, r) => { const f = ridge(g, 380, [[2, 30], [3, 18], [7, 10], [17, 4]], '#9db2c6', r); label(g, f, 700, '生駒山地'); }), h: 0.5, p: 0.15 },
      { img: layer(2, (g, r) => {
        for (let x = 0; x < BG_W;) {
          const bw = 30 + r() * 70, bh = 40 + r() * 160;
          g.fillStyle = ['#7f8c9a', '#8d99a6', '#6f7d8c'][Math.floor(r() * 3)];
          g.fillRect(x, BG_H - 40 - bh, bw, bh + 40);
          g.fillStyle = 'rgba(255,240,200,0.35)';
          for (let y = BG_H - 30 - bh; y < BG_H - 50; y += 14) for (let wx = x + 5; wx < x + bw - 8; wx += 12) if (r() < 0.3) g.fillRect(wx, y, 5, 6);
          x += bw + r() * 10;
        }
        g.fillStyle = '#6d7a72'; g.fillRect(0, BG_H - 40, BG_W, 40);
      }), h: 0.42, p: 0.3 },
    ];
    themes.suburb = [
      { img: layer(3, (g, r) => {
        const f = ridge(g, 300, [[1, 50], [2, 40], [5, 14], [11, 6]], '#8aa3ba', r);
        // 生駒山上のテレビ塔
        let best = 0, bx = 0; for (let x = 0; x < BG_W; x += 8) { const y = BG_H - f(x); if (y > best) { best = y; bx = x; } }
        for (let i = 0; i < 4; i++) { const x = bx - 60 + i * 34, y = f(x); g.fillStyle = i % 2 ? '#d33' : '#eee'; g.fillRect(x - 2, y - 70 + i * 6, 4, 70 - i * 6); for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#d33' : '#fff'; g.fillRect(x - 3, y - 70 + i * 6 + k * 14, 6, 7); } }
        label(g, f, bx, '生駒山');
      }), h: 0.55, p: 0.15 },
      { img: layer(4, (g, r) => { const f = ridge(g, 400, [[3, 22], [5, 14], [13, 6], [29, 3]], '#5f8466', r); speckle(g, f, ['#4f7656', '#6b9370', '#b08a3a'], 400, r, 80); }), h: 0.38, p: 0.3 },
    ];
    themes.yamato = [
      { img: layer(5, (g, r) => { const f = ridge(g, 320, [[1, 40], [2, 30], [4, 16], [9, 6]], '#8ea4bc', r); label(g, f, 1400, '金剛山・葛城山'); }), h: 0.52, p: 0.12 },
      { img: layer(6, (g, r) => {
        // 二上山（ふたこぶ）
        g.fillStyle = '#6f8f7e';
        g.beginPath(); g.moveTo(300, BG_H); g.quadraticCurveTo(420, 300, 480, 270); g.quadraticCurveTo(540, 330, 570, 320); g.quadraticCurveTo(600, 300, 640, 310); g.quadraticCurveTo(760, 380, 860, BG_H); g.fill();
        g.font = `700 20px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.textAlign = 'center'; g.fillText('二上山', 560, 250);
        const f = ridge(g, 450, [[3, 10], [7, 6], [19, 3]], '#668a5a', r);
        speckle(g, f, ['#5a7d4e', '#7a9a5a'], 300, r, 40);
      }), h: 0.36, p: 0.28 },
    ];
    themes.mountain = [
      { img: layer(7, (g, r) => { ridge(g, 260, [[2, 60], [3, 40], [7, 18], [15, 8]], '#91a7c2', r, { sharp: true }); }), h: 0.6, p: 0.1 },
      { img: layer(8, (g, r) => { const f = ridge(g, 320, [[3, 50], [5, 30], [11, 12], [23, 5]], '#5d7f88', r, { sharp: true }); speckle(g, f, ['#567780', '#668a8c'], 200, r, 100); }), h: 0.55, p: 0.2 },
      { img: layer(9, (g, r) => { const f = ridge(g, 380, [[4, 40], [7, 24], [13, 10], [31, 4]], '#4c6b3c', r); speckle(g, f, ['#c0632a', '#d9932e', '#a83a24', '#5b7a3e', '#e2b13c'], 900, r, 140); }), h: 0.45, p: 0.35 },
    ];
    themes.deep = [
      { img: layer(10, (g, r) => { ridge(g, 200, [[2, 70], [3, 50], [6, 24], [14, 10]], '#8ba1bd', r, { sharp: true }); }), h: 0.7, p: 0.1 },
      { img: layer(11, (g, r) => { const f = ridge(g, 240, [[3, 80], [5, 40], [9, 20], [21, 8]], '#4f6e62', r, { sharp: true }); speckle(g, f, ['#466457', '#5a7b6b'], 300, r, 160); mist(g, 400, 40, 0.35); }), h: 0.68, p: 0.22 },
      { img: layer(12, (g, r) => { const f = ridge(g, 300, [[4, 70], [6, 40], [13, 16], [27, 6]], '#2f5139', r, { sharp: true }); speckle(g, f, ['#28472f', '#3a6040', '#a8562a', '#c88a2e'], 900, r, 200); }), h: 0.62, p: 0.4 },
    ];
    themes.hatenashi = [
      { img: layer(13, (g, r) => { ridge(g, 280, [[2, 40], [5, 20], [11, 8]], '#93a9c4', r, { sharp: true }); }), h: 0.6, p: 0.08 },
      { img: layer(14, (g, r) => {
        // 果無山脈：長く連なる稜線
        const f = ridge(g, 250, [[1, 12], [3, 10], [8, 8], [19, 5], [41, 2]], '#4a6878', r);
        label(g, f, 520, '果無山脈'); label(g, f, 1560, '果無山脈');
        mist(g, 420, 50, 0.4);
      }), h: 0.58, p: 0.16 },
      { img: layer(15, (g, r) => { const f = ridge(g, 370, [[4, 50], [9, 20], [17, 8]], '#365a3e', r, { sharp: true }); speckle(g, f, ['#2c4f33', '#41684a', '#b06a2a'], 700, r, 150); }), h: 0.5, p: 0.36 },
    ];
    themes.kumano = [
      { img: layer(16, (g, r) => { ridge(g, 300, [[2, 40], [3, 30], [7, 12]], '#a2b3c8', r); mist(g, 360, 40, 0.5); }), h: 0.55, p: 0.1 },
      { img: layer(17, (g, r) => { const f = ridge(g, 340, [[3, 40], [5, 26], [11, 10]], '#6a8a84', r); mist(g, 420, 50, 0.55); speckle(g, f, ['#5f7f78', '#75958c'], 200, r, 80); }), h: 0.5, p: 0.2 },
      { img: layer(18, (g, r) => { const f = ridge(g, 400, [[4, 30], [7, 20], [15, 8]], '#3d5e46', r); speckle(g, f, ['#33533c', '#4a7050', '#a35e2c'], 600, r, 100); }), h: 0.42, p: 0.34 },
    ];
    themes.coast = [
      { img: layer(19, (g, r) => { ridge(g, 380, [[2, 24], [5, 12], [11, 5]], '#9db1c6', r); g.fillStyle = '#6f9fc4'; g.fillRect(0, 440, BG_W, 72); g.font = `700 20px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.8)'; g.textAlign = 'center'; g.fillText('熊野灘', 1700, 432); }), h: 0.45, p: 0.1 },
      { img: layer(20, (g, r) => { const f = ridge(g, 400, [[3, 30], [6, 16], [13, 6]], '#557a5a', r); speckle(g, f, ['#4b6e50', '#678c68'], 300, r, 80); }), h: 0.38, p: 0.28 },
    ];
  }

  function buildAll() {
    for (let i = 0; i < 4; i++) sugi('sugi' + i, 100 + i, 900 + i * 120, i % 2 === 1);
    blobTree('tree0', 1, 1300, ['#3f7a3a', '#4f8a42', '#2f6a32']);
    blobTree('tree1', 2, 1200, ['#4a7f3a', '#5f9440', '#386b30']);
    blobTree('maple0', 3, 1200, ['#c0392b', '#d35400', '#a93226', '#e67e22']);
    blobTree('maple1', 4, 1150, ['#e67e22', '#f1c40f', '#d68910', '#ca6f1e']);
    blobTree('kaki', 5, 1000, ['#6b8f3a', '#7fa040', '#5a7a30', '#b8862a'], { fruit: '#ff7a1a', n: 34 });
    bamboo('bamboo', 6);
    for (let i = 0; i < 6; i++) building('bldg' + i, 20 + i);
    for (let i = 0; i < 4; i++) house('house' + i, 40 + i);
    shop('shop');
    pole('pole');
    torii('torii', '#c8322a', 1500, { base: true });
    torii('torii_big', '#c8322a', 2600, { base: true, plaque: true, thick: true });
    shrine('shrine', 2600, '#b8402e', '#5a4636');
    nobori('nobori');
    ootorii();
    hongu();
    hayatama();
    gotobiki();
    iwafune();
    suspension('tanize', 17000, '#7d8a90', '#9a7a52', { people: true });
    suspension('buranko', 11000, '#e8e8e8', '#b08a5a', { trees: true, autumn: true, deckY: 150 });
    dam('dam', 15000);
    onsen('onsen_tosenji', '湯泉地');
    onsen('onsen_totsukawa', '十津川');
    onsen('onsen_kamiyu', '上湯');
    hoshinokuni();
    michi('michi_oto', '吉野路大塔');
    michi('michi_totsu', '十津川郷');
    michi('michi_kumano', '瀞峡街道熊野川');
    hatenashiVillage();
    boat();
    sign168();
    warning('sign_rock', (g) => {
      g.fillStyle = '#222';
      g.beginPath(); g.moveTo(-30, -26); g.lineTo(-30, 30); g.lineTo(10, 30); g.closePath(); g.fill();
      [[6, -18, 7], [16, -2, 6], [22, 16, 5]].forEach(([x, y, rr]) => { g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); });
    }, '落石注意');
    warning('sign_narrow', (g) => {
      g.fillStyle = '#222';
      g.beginPath(); g.moveTo(-22, 32); g.lineTo(-8, -30); g.lineTo(-2, -30); g.lineTo(-12, 32); g.fill();
      g.beginPath(); g.moveTo(22, 32); g.lineTo(8, -30); g.lineTo(2, -30); g.lineTo(12, 32); g.fill();
    }, '対向車注意');
    warning('sign_slope', (g) => {
      g.fillStyle = '#222';
      g.beginPath(); g.moveTo(-32, 24); g.lineTo(32, 24); g.lineTo(32, -10); g.closePath(); g.fill();
      text(g, '10%', -6, -10, 20, '#222');
    }, '急勾配');
    warning('sign_curveL', (g) => {
      g.strokeStyle = '#222'; g.lineWidth = 9; g.beginPath(); g.moveTo(6, 32); g.lineTo(6, 0); g.quadraticCurveTo(6, -18, -14, -18); g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.moveTo(-28, -18); g.lineTo(-10, -32); g.lineTo(-10, -4); g.fill();
    }, '急カーブ');
    warning('sign_curveR', (g) => {
      g.strokeStyle = '#222'; g.lineWidth = 9; g.beginPath(); g.moveTo(-6, 32); g.lineTo(-6, 0); g.quadraticCurveTo(-6, -18, 14, -18); g.stroke();
      g.fillStyle = '#222'; g.beginPath(); g.moveTo(28, -18); g.lineTo(10, -32); g.lineTo(10, -4); g.fill();
    }, '急カーブ');
    lib.sign_kokudo = make(380, 300, 1500, (g, w, h) => {
      post(g, 80, 120, h, 10); post(g, w - 80, 120, h, 10);
      g.fillStyle = '#f6c500'; rrect(g, 4, 4, w - 8, 150, 10); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 6; rrect(g, 12, 12, w - 24, 134, 8); g.stroke();
      text(g, 'この先 酷道', w / 2, 56, 44, '#222', { maxW: w - 40 });
      text(g, '幅員狭小・離合困難', w / 2, 112, 28, '#c00', { maxW: w - 40 });
    });
    lib.sign_kodo = brownSign(['熊野古道', '小辺路 → 果無峠'], 1600);
    lib.sign_isan = brownSign(['世界遺産', '紀伊山地の霊場と参詣道'], 1700);
    lib.sign_yunomine = blueSign(['湯の峰温泉 ←', '川湯温泉・渡瀬温泉'], 2200);
    lib.sign_shingu = blueSign(['新宮 ↑', 'Shingu  40km'], 2000);
    lib.sign_hongu = blueSign(['本宮 ↑', 'Hongu  35km'], 2000);
    lib.sign_totsu = blueSign(['十津川 ↑', 'Totsukawa  30km'], 2000);
    delineator();
    for (let i = 0; i < 3; i++) rock('rock' + i, 60 + i);
    buildCars();
    bike();
    buildThemes();
  }

  return {
    lib, cars, themes, rng, shade, FONT, TITLE_FONT, BG_W, BG_H,
    buildAll, blueSign, brownSign, gate, plate,
  };
})();
