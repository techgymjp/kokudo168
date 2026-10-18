'use strict';
// 酷道168号の星 — 疑似3Dレースエンジン & ゲームロジック
(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  const SEG = Route.SEG;
  const DRAW = 210;
  const CAM_H = 820;
  const DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180);
  const MAXSPEED = SEG * 62;
  const ACCEL = MAXSPEED / 4.2;
  const BRAKE = -MAXSPEED * 1.1;
  const DECEL = -MAXSPEED / 6;
  const OFF_DECEL = -MAXSPEED / 1.6;
  const OFF_LIMIT = MAXSPEED / 3.2;
  const BIKE_W = 220;
  const TUNNEL_H = 1750;
  const KMH_MAX = 248;
  const BIG = 1e5;

  let W = 0, H = 0, S = 1, HORIZON = 0, PLAYER_Z = 1000, PLAYER_SY = 0;
  let track, segments, trackLen;
  let vignette = null;

  const input = { left: false, right: false, accel: false, brake: false };

  const THEME = {
    city: { ground: ['#9b9a92', '#93928a'], fog: 2.6 },
    suburb: { ground: ['#6aa84f', '#62a049'], fog: 2.8 },
    yamato: { ground: ['#c6b35a', '#bba852'], fog: 2.6 },
    mountain: { ground: ['#3f6b35', '#396231'], fog: 3.2 },
    deep: { ground: ['#335a32', '#2e532d'], fog: 3.6 },
    hatenashi: { ground: ['#3b6338', '#365c33'], fog: 3.4 },
    kumano: { ground: ['#4c7a3e', '#467238'], fog: 4.0 },
    coast: { ground: ['#8f9a88', '#879280'], fog: 2.6 },
  };
  const GROUND = {
    city: ['#a3a29a', '#9b9a92'],
    grass: ['#6aa84f', '#62a049'],
    field: ['#c9b458', '#bfa94e'],
    forest: ['#3f6b35', '#386030'],
  };
  const CAR_MIX = {
    city: { sedan: 0.55, kei: 0.25, truck: 0.1, bus: 0.1 },
    suburb: { sedan: 0.45, kei: 0.3, keitruck: 0.1, truck: 0.1, bus: 0.05 },
    yamato: { sedan: 0.35, kei: 0.2, keitruck: 0.15, truck: 0.25, bus: 0.05 },
    mountain: { sedan: 0.3, kei: 0.25, keitruck: 0.3, truck: 0.1, bus: 0.05 },
    deep: { sedan: 0.3, kei: 0.25, keitruck: 0.3, truck: 0.08, bus: 0.07 },
    hatenashi: { sedan: 0.3, kei: 0.3, keitruck: 0.3, bus: 0.1 },
    kumano: { sedan: 0.4, kei: 0.25, keitruck: 0.15, truck: 0.1, bus: 0.1 },
    coast: { sedan: 0.5, kei: 0.25, keitruck: 0.1, truck: 0.1, bus: 0.05 },
  };
  // 空の色（進行度で朝→昼→夕方）
  const SKY = [
    [0.0, '#6fa8dc', '#d9ecfa', '#fff6d8'],
    [0.35, '#3d86cf', '#cfe7fb', '#ffffff'],
    [0.7, '#4a78c0', '#f2e2c4', '#fff0c0'],
    [0.9, '#3a4f92', '#ffc58a', '#ffd27a'],
    [1.0, '#2d3a78', '#ff9a5c', '#ffb050'],
  ];

  const G = {
    mode: 'loading', t: 0,
    position: 0, speed: 0, x: -450, lean: 0, time: 0, elapsed: 0, stage: 0,
    cars: [], rocks: [], particles: [],
    crash: 0, crashRot: 0, invul: 0, shake: 0,
    overtakes: 0, nearMiss: 0, crashes: 0, rockFalls: 0, topSpeed: 0,
    lastSeg: 0, skyOffset: 0, theme: 'city', themePrev: null, themeFade: 1,
    countdown: 0, goalTimer: 0, scrapeT: 0, rockTimer: 0, result: null,
  };
  window.KOKUDO = G;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };

  function findSeg(z) { return segments[clamp(Math.floor(z / SEG), 0, segments.length - 1)]; }

  // ---------------------------------------------------------------- 画面
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = window.innerWidth, ch = window.innerHeight;
    let sc = dpr;
    if (cw * sc > 1700) sc = 1700 / cw;
    if (ch * sc > 1100) sc = Math.min(sc, 1100 / ch);
    canvas.width = Math.round(cw * sc);
    canvas.height = Math.round(ch * sc);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    W = canvas.width; H = canvas.height;
    const portrait = H > W;
    S = portrait ? Math.max(W * 0.62, H * 0.42) : Math.max(W / 2, H * 0.55);
    HORIZON = H * (portrait ? 0.46 : 0.5);
    PLAYER_SY = H * (portrait ? 0.84 : 0.93);
    PLAYER_Z = DEPTH * CAM_H * S / (PLAYER_SY - HORIZON);
    vignette = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    document.body.classList.toggle('portrait', portrait);
  }

  // ---------------------------------------------------------------- 投影・描画ユーティリティ
  function project(p, camX, camY, camZ) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const sc = DEPTH / p.camera.z;
    p.screen.scale = sc;
    p.screen.x = W / 2 + sc * p.camera.x * S;
    p.screen.y = HORIZON - sc * p.camera.y * S;
    p.screen.w = sc * p.world.w * S;
  }
  const PX = (p, wx) => p.screen.x + wx * p.screen.scale * S;
  const PY = (p, wy) => p.screen.y - wy * p.screen.scale * S;
  function quad(color, x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }
  // 世界座標で側方オフセット a..b, 高さ ha..hb の矩形面（p1→p2方向）
  function wallQuad(color, seg, xa1, xa2, ha1, ha2, hb1, hb2, fog) {
    const p1 = seg.p1, p2 = seg.p2;
    const x1 = PX(p1, xa1), x2 = PX(p2, xa2);
    const x3 = PX(p1, xa1), x4 = PX(p2, xa2);
    quad(color, x1, PY(p1, ha1), x2, PY(p2, ha2), x4, PY(p2, hb2), x3, PY(p1, hb1));
    if (fog > 0.02) { ctx.globalAlpha = fog; quad(G.fogColor, x1, PY(p1, ha1), x2, PY(p2, ha2), x4, PY(p2, hb2), x3, PY(p1, hb1)); ctx.globalAlpha = 1; }
  }
  // 地面の帯（側方 xa→xb, 高さ y）
  function strip(color, seg, xa1, xb1, xa2, xb2, y1, y2) {
    const p1 = seg.p1, p2 = seg.p2;
    quad(color, PX(p1, xa1), PY(p1, y1), PX(p1, xb1), PY(p1, y1), PX(p2, xb2), PY(p2, y2), PX(p2, xa2), PY(p2, y2));
  }

  // ---------------------------------------------------------------- 背景
  function skyColors(prog) {
    for (let i = 1; i < SKY.length; i++) {
      if (prog <= SKY[i][0]) {
        const a = SKY[i - 1], b = SKY[i];
        const t = (prog - a[0]) / (b[0] - a[0]);
        return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t), mixHex(a[3], b[3], t)];
      }
    }
    const l = SKY[SKY.length - 1];
    return [l[1], l[2], l[3]];
  }
  function drawLayers(theme, alpha) {
    const layers = Sprites.themes[theme];
    if (!layers) return;
    ctx.globalAlpha = alpha;
    layers.forEach(L => {
      const dh = H * L.h;
      const dw = dh * Sprites.BG_W / Sprites.BG_H;
      const y = HORIZON - dh + H * 0.03;
      let off = (G.skyOffset * L.p * dw) % dw;
      if (off > 0) off -= dw;
      for (let x = off; x < W; x += dw) ctx.drawImage(L.img, x, y, dw + 1, dh);
    });
    ctx.globalAlpha = 1;
  }
  function drawBackground(prog) {
    const [top, bottom, sun] = skyColors(prog);
    G.fogColor = bottom;
    const gr = ctx.createLinearGradient(0, 0, 0, HORIZON + H * 0.05);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    // 太陽
    const sx = W * (0.25 + prog * 0.55) - (G.skyOffset * 0.05 % 1) * 0;
    const sy = HORIZON - H * (0.42 - prog * 0.32);
    const sr = Math.min(W, H) * (0.04 + prog * 0.02);
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 4);
    sg.addColorStop(0, sun); sg.addColorStop(0.25, 'rgba(255,240,200,0.5)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    // 雲
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 7; i++) {
      const cw = W * (0.12 + (i % 3) * 0.05);
      let cx = ((i * 0.37 + G.skyOffset * 0.02 + G.t * 0.004) % 1.4) * W * 1.1 - W * 0.2;
      const cy = H * (0.08 + (i % 4) * 0.06);
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw * 0.5, cw * 0.12, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + cw * 0.15, cy - cw * 0.06, cw * 0.25, cw * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (G.themePrev && G.themeFade < 1) { drawLayers(G.themePrev, 1); drawLayers(G.theme, G.themeFade); }
    else drawLayers(G.theme, 1);
    // 地平線より下の下地
    const th = THEME[G.theme];
    ctx.fillStyle = th.ground[1];
    ctx.fillRect(0, HORIZON + H * 0.03 - 1, W, H);
  }

  // ---------------------------------------------------------------- 道路・側面
  function sideGround(seg) {
    if (seg.tunnel) return ['#2a2826', '#2a2826'];
    return GROUND[seg.ground] || GROUND.grass;
  }
  function drawSide(seg, sgn, alt) {
    const type = sgn < 0 ? seg.L : seg.R;
    const w1 = seg.p1.world.w, w2 = seg.p2.world.w;
    const sh = 160;
    const g = sideGround(seg);
    const e1 = sgn * (w1 + sh), e2 = sgn * (w2 + sh);
    const water = alt ? seg.water : shadeWater(seg.water);
    switch (type) {
      case 'open': case 'tunnel':
        strip(g[alt ? 0 : 1], seg, e1, sgn * BIG, e2, sgn * BIG, 0, 0);
        break;
      case 'cliff':
        strip('#8b8a82', seg, e1, sgn * (w1 + 300), e2, sgn * (w2 + 300), 0, 0);
        strip(g[1], seg, sgn * (w1 + 300), sgn * BIG, sgn * (w2 + 300), sgn * BIG, 0, 0);
        break;
      case 'valley': case 'river': {
        const deep = type === 'valley';
        const drop = deep ? 2600 : 1000, slope = deep ? 1700 : 900, bank = deep ? 3800 : 6400;
        // 対岸（森の斜面）
        const top = 0;
        strip(alt ? '#2f5530' : '#2b4f2c', seg, sgn * (w1 + bank), sgn * BIG, sgn * (w2 + bank), sgn * BIG, top, top);
        wallQuad(alt ? '#3b5e36' : '#355631', seg, sgn * (w1 + bank), sgn * (w2 + bank), -drop, -drop, top, top, 0);
        // 水面
        strip(water, seg, sgn * (w1 + slope + (deep ? 0 : 900)), sgn * (w1 + bank), sgn * (w2 + slope + (deep ? 0 : 900)), sgn * (w2 + bank), -drop, -drop);
        if (!deep) strip(alt ? '#bdb6a6' : '#b4ad9c', seg, sgn * (w1 + slope), sgn * (w1 + slope + 900), sgn * (w2 + slope), sgn * (w2 + slope + 900), -drop, -drop);
        // 法面
        const p1 = seg.p1, p2 = seg.p2;
        quad(alt ? '#4f6a3a' : '#486234', PX(p1, e1), PY(p1, 0), PX(p2, e2), PY(p2, 0), PX(p2, sgn * (w2 + slope)), PY(p2, -drop), PX(p1, sgn * (w1 + slope)), PY(p1, -drop));
        break;
      }
      case 'bridge':
        strip(water, seg, e1, sgn * BIG, e2, sgn * BIG, -2400, -2400);
        wallQuad(seg.railColor ? '#6f6f6a' : '#666', seg, e1, e2, -320, -320, 0, 0, 0);
        break;
      default: break;
    }
  }
  const waterCache = {};
  function shadeWater(c) { return waterCache[c] || (waterCache[c] = Sprites.shade(c, 0.88)); }

  function drawRoad(seg) {
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const s1 = p1.scale * S, s2 = p2.scale * S;
    const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, w1 = p1.w, w2 = p2.w;
    const alt = Math.floor(seg.index / 3) % 2 === 0;
    drawSide(seg, -1, alt);
    drawSide(seg, 1, alt);
    // 路肩
    const sh1 = w1 + 160 * s1, sh2 = w2 + 160 * s2;
    quad(seg.tunnel ? '#4a4642' : (alt ? '#8e8c86' : '#86847e'), x1 - sh1, y1, x1 + sh1, y1, x2 + sh2, y2, x2 - sh2, y2);
    // 舗装
    const rc = seg.tunnel ? (alt ? '#4b4744' : '#47433f') : (alt ? '#5b5b5e' : '#57575a');
    quad(rc, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2);
    // 外側線
    const lw1 = 45 * s1, lw2 = 45 * s2, in1 = 70 * s1, in2 = 70 * s2;
    quad('#e8e8e2', x1 - w1 + in1, y1, x1 - w1 + in1 + lw1, y1, x2 - w2 + in2 + lw2, y2, x2 - w2 + in2, y2);
    quad('#e8e8e2', x1 + w1 - in1 - lw1, y1, x1 + w1 - in1, y1, x2 + w2 - in2, y2, x2 + w2 - in2 - lw2, y2);
    // 中央線・車線
    const dash = Math.floor(seg.index / 2) % 3 !== 0;
    if (seg.lanes >= 4) {
      const c1 = 30 * s1, c2 = 30 * s2;
      quad('#f2b705', x1 - c1 * 2.4, y1, x1 - c1 * 0.8, y1, x2 - c2 * 0.8, y2, x2 - c2 * 2.4, y2);
      quad('#f2b705', x1 + c1 * 0.8, y1, x1 + c1 * 2.4, y1, x2 + c2 * 2.4, y2, x2 + c2 * 0.8, y2);
      if (dash) {
        [-0.5, 0.5].forEach(f => {
          const a1 = x1 + w1 * f, a2 = x2 + w2 * f;
          quad('#e8e8e2', a1 - c1, y1, a1 + c1, y1, a2 + c2, y2, a2 - c2, y2);
        });
      }
    } else if (seg.lanes === 2) {
      const c1 = 32 * s1, c2 = 32 * s2;
      if (seg.line === 'yellow') quad('#f2b705', x1 - c1, y1, x1 + c1, y1, x2 + c2, y2, x2 - c2, y2);
      else if (dash) quad('#e8e8e2', x1 - c1, y1, x1 + c1, y1, x2 + c2, y2, x2 - c2, y2);
    }
    if (seg.fog > 0.02) {
      ctx.globalAlpha = seg.fog;
      ctx.fillStyle = G.fogColor;
      ctx.fillRect(0, y2, W, y1 - y2 + 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawStructures(seg) {
    const w1 = seg.p1.world.w, w2 = seg.p2.world.w;
    const f = seg.fog;
    if (seg.tunnel) {
      const o1 = w1 + 180, o2 = w2 + 180;
      const alt = seg.index % 2 === 0;
      [-1, 1].forEach(sg => {
        wallQuad(alt ? '#8a857b' : '#837e74', seg, sg * o1, sg * o2, 0, 0, 650, 650, f);
        wallQuad(alt ? '#4c4945' : '#47443f', seg, sg * o1, sg * o2, 650, 650, TUNNEL_H, TUNNEL_H, f);
      });
      // 天井
      const p1 = seg.p1, p2 = seg.p2;
      quad(alt ? '#2f2d2b' : '#2a2826', PX(p1, -o1), PY(p1, TUNNEL_H), PX(p1, o1), PY(p1, TUNNEL_H), PX(p2, o2), PY(p2, TUNNEL_H), PX(p2, -o2), PY(p2, TUNNEL_H));
      // 照明
      if (seg.index % 3 === 0) {
        [-1, 1].forEach(sg => {
          const xa = sg * (o1 - 20), xb = sg * (o2 - 20);
          const pa = seg.p1, pb = seg.p2;
          const xm = lerp(PX(pa, xa), PX(pb, xb), 0.45), ym1 = lerp(PY(pa, TUNNEL_H - 150), PY(pb, TUNNEL_H - 150), 0.45), ym2 = lerp(PY(pa, TUNNEL_H - 60), PY(pb, TUNNEL_H - 60), 0.45);
          quad('#ffcc66', PX(pa, xa), PY(pa, TUNNEL_H - 150), xm, ym1, xm, ym2, PX(pa, xa), PY(pa, TUNNEL_H - 60));
        });
      }
      if (seg.tunnelStart) drawPortal(seg);
      return;
    }
    [-1, 1].forEach(sg => {
      const type = sg < 0 ? seg.L : seg.R;
      if (type === 'cliff') {
        const a1 = sg * (w1 + 300), a2 = sg * (w2 + 300);
        const h1 = seg.prevCliffH, h2 = seg.cliffH;
        const p1 = seg.p1, p2 = seg.p2;
        const lean = 700;
        const hash = (seg.index * 2654435761 >>> 0) % 3;
        const col = seg.cliffStyle === 1 ? (seg.index % 2 ? '#a19f94' : '#9a988d') : ['#7c7264', '#71685b', '#857a6b'][hash];
        const pts = [PX(p1, a1), PY(p1, 0), PX(p2, a2), PY(p2, 0), PX(p2, a2 + sg * lean), PY(p2, h2), PX(p1, a1 + sg * lean), PY(p1, h1)];
        quad(col, ...pts);
        if (seg.cliffStyle === 1) {
          // 法枠
          ctx.strokeStyle = '#7d7b72'; ctx.lineWidth = Math.max(1, 40 * p1.screen.scale * S);
          ctx.beginPath();
          [0.33, 0.66].forEach(t => { ctx.moveTo(PX(p1, a1 + sg * lean * t), PY(p1, h1 * t)); ctx.lineTo(PX(p2, a2 + sg * lean * t), PY(p2, h2 * t)); });
          if (seg.index % 2 === 0) { ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[6], pts[7]); }
          ctx.stroke();
        } else if (hash === 0) {
          ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = Math.max(1, 30 * p1.screen.scale * S);
          ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(PX(p1, a1 + sg * lean * 0.6), PY(p1, h1 * 0.6)); ctx.stroke();
        }
        // 上部の植生
        quad(seg.index % 2 ? '#3d6534' : '#365c2e', pts[6], pts[7], pts[4], pts[5], PX(p2, a2 + sg * (lean + 500)), PY(p2, h2 + 700), PX(p1, a1 + sg * (lean + 500)), PY(p1, h1 + 700));
        if (f > 0.02) { ctx.globalAlpha = f; quad(G.fogColor, ...pts); ctx.globalAlpha = 1; }
      } else if (type === 'valley' || type === 'river') {
        // ガードレール
        const r1 = sg * (w1 + 110), r2 = sg * (w2 + 110);
        wallQuad('#e9e9e2', seg, r1, r2, 150, 150, 250, 250, f);
        wallQuad('#b9b9b0', seg, r1, r2, 150, 150, 175, 175, f);
        if (seg.index % 2 === 0) {
          const p1 = seg.p1;
          ctx.strokeStyle = '#c9c9c0'; ctx.lineWidth = Math.max(1, 26 * p1.screen.scale * S);
          ctx.beginPath(); ctx.moveTo(PX(p1, r1), PY(p1, 0)); ctx.lineTo(PX(p1, r1), PY(p1, 250)); ctx.stroke();
        }
      } else if (type === 'bridge') {
        const r1 = sg * (w1 + 150), r2 = sg * (w2 + 150);
        const c = seg.railColor || '#c0392b';
        wallQuad('#a7a59d', seg, r1, r2, 0, 0, 90, 90, f);
        wallQuad(c, seg, r1, r2, 320, 320, 380, 380, f);
        wallQuad(c, seg, r1, r2, 180, 180, 210, 210, f);
        const p1 = seg.p1;
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, 30 * p1.screen.scale * S);
        ctx.beginPath(); ctx.moveTo(PX(p1, r1), PY(p1, 90)); ctx.lineTo(PX(p1, r1), PY(p1, 380)); ctx.stroke();
      }
    });
  }
  function drawPortal(seg) {
    const p = seg.p1;
    const ow = p.world.w + 180, oh = TUNNEL_H;
    const hole = () => {
      const cx = PX(p, 0), cy = PY(p, oh * 0.55);
      const rx = PX(p, ow) - cx, ry = cy - PY(p, oh);
      ctx.moveTo(PX(p, -ow), PY(p, 0));
      ctx.lineTo(PX(p, -ow), cy);
      ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, Math.PI, Math.PI * 2);
      ctx.lineTo(PX(p, ow), PY(p, 0));
      ctx.closePath();
    };
    // 山の斜面
    ctx.fillStyle = '#355a32';
    ctx.beginPath();
    ctx.moveTo(PX(p, -(ow + 12000)), PY(p, 0));
    ctx.lineTo(PX(p, -(ow + 4000)), PY(p, 6500));
    ctx.lineTo(PX(p, ow + 4000), PY(p, 7000));
    ctx.lineTo(PX(p, ow + 12000), PY(p, 0));
    ctx.closePath();
    hole();
    ctx.fill('evenodd');
    // 坑門（コンクリート）
    ctx.fillStyle = '#a3a199';
    ctx.beginPath();
    ctx.rect(PX(p, -(ow + 900)), PY(p, oh + 700), PX(p, ow + 900) - PX(p, -(ow + 900)), PY(p, 0) - PY(p, oh + 700));
    hole();
    ctx.fill('evenodd');
    ctx.fillStyle = '#8d8b83';
    ctx.fillRect(PX(p, -(ow + 900)), PY(p, oh + 700), PX(p, ow + 900) - PX(p, -(ow + 900)), Math.max(1, 90 * p.screen.scale * S));
    if (seg.tunnelName) {
      if (!seg.plate) seg.plate = Sprites.plate(seg.tunnelName);
      drawSprite(seg.plate, p.screen.scale, PX(p, 0), PY(p, oh + 120), 1, 0);
    }
  }

  // ---------------------------------------------------------------- スプライト
  function drawSprite(spr, scale, x, y, worldScale, fog, ww) {
    const destW = (ww || spr.worldW * (worldScale || 1)) * scale * S;
    const destH = destW * spr.h / spr.w;
    const dx = x - destW / 2, dy = y - destH;
    if (destW < 0.6 || dx > W || dx + destW < 0 || dy > H) return;
    if (fog > 0.05) ctx.globalAlpha = 1 - fog * (spr.worldW > 3000 ? 0.35 : 0.85);
    ctx.drawImage(spr.img, dx, dy, destW, destH);
    ctx.globalAlpha = 1;
  }
  function drawSegSprites(seg) {
    const p = seg.p1;
    const sc = p.screen.scale;
    for (const sp of seg.sprites) {
      drawSprite(sp.s, sc, p.screen.x + sc * sp.x * S, p.screen.y, 1, seg.fog, sp.ww);
    }
  }
  function drawSegCars(seg) {
    const p1 = seg.p1, p2 = seg.p2;
    for (const c of seg.cars) {
      const t = (c.z % SEG) / SEG;
      const sc = lerp(p1.screen.scale, p2.screen.scale, t);
      const x = lerp(p1.screen.x, p2.screen.x, t) + sc * c.x * S;
      const y = lerp(p1.screen.y, p2.screen.y, t);
      drawSprite(c.sprite, sc, x, y, 1, seg.fog * 0.8);
    }
    for (const r of seg.rocks) {
      const t = (r.z % SEG) / SEG;
      const sc = lerp(p1.screen.scale, p2.screen.scale, t);
      const x = lerp(p1.screen.x, p2.screen.x, t) + sc * r.x * S;
      const y = lerp(p1.screen.y, p2.screen.y, t);
      if (r.y > 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        const rw = r.size * sc * S * 0.5 * clamp(1 - r.y / 4000, 0.3, 1);
        ctx.beginPath(); ctx.ellipse(x, y, rw, rw * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      }
      drawSprite(r.sprite, sc, x, y - r.y * sc * S, 1, seg.fog * 0.6, r.size);
    }
  }
  function drawPlayer() {
    const spr = Sprites.lib.bike;
    const sc = DEPTH / PLAYER_Z;
    const dw = spr.worldW * sc * S, dh = dw * spr.h / spr.w;
    const sp = G.speed / MAXSPEED;
    let x = W / 2, y = PLAYER_SY;
    y += Math.sin(G.t * 60) * sp * 1.2;
    let ang = G.lean;
    if (G.crash > 0) {
      ang = G.crashRot;
      y -= Math.abs(Math.sin(G.crash * 6)) * dh * 0.15;
    }
    if (G.offroad) y += (Math.random() - 0.5) * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, PLAYER_SY, dw * 0.32, dw * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    if (G.invul > 0 && Math.floor(G.t * 14) % 2) ctx.globalAlpha = 0.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.drawImage(spr.img, -dw / 2, -dh, dw, dh);
    // テールランプのグロー
    if (input.brake && G.mode === 'play') {
      ctx.fillStyle = 'rgba(255,40,40,0.55)';
      ctx.beginPath(); ctx.arc(0, -dh * 0.38, dw * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- メイン描画
  const visible = [];
  function render() {
    const pz = G.position + PLAYER_Z;
    const baseSeg = findSeg(G.position);
    const basePct = (G.position % SEG) / SEG;
    const pseg = findSeg(pz);
    const ppct = (pz % SEG) / SEG;
    const playerY = lerp(pseg.p1.world.y, pseg.p2.world.y, ppct);
    const camY = playerY + CAM_H;
    const prog = clamp(pz / (track.goalSeg * SEG), 0, 1);

    ctx.save();
    if (G.shake > 0.1) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    drawBackground(prog);

    // 1パス目：投影
    let x = 0, dx = -(baseSeg.curve * basePct);
    let maxy = H;
    const fogD = THEME[G.theme].fog;
    visible.length = 0;
    for (let n = 0; n < DRAW; n++) {
      const seg = segments[Math.min(baseSeg.index + n, segments.length - 1)];
      project(seg.p1, G.x - x, camY, G.position);
      project(seg.p2, G.x - x - dx, camY, G.position);
      x += dx; dx += seg.curve;
      const d = n / DRAW;
      seg.fog = 1 - Math.exp(-d * d * fogD);
      seg.behind = seg.p1.camera.z <= DEPTH;
      seg.hidden = seg.behind || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy;
      if (!seg.hidden) maxy = Math.min(maxy, seg.p2.screen.y);
      visible.push(seg);
    }
    // 2パス目：奥から手前へ
    for (let n = visible.length - 1; n >= 0; n--) {
      const seg = visible[n];
      if (seg.behind) continue;
      if (!seg.hidden) drawRoad(seg);
      drawStructures(seg);
      drawSegSprites(seg);
      drawSegCars(seg);
      if (seg === pseg && G.mode !== 'title') drawPlayer();
    }

    // 演出
    if (pseg.tunnel) { ctx.fillStyle = 'rgba(255,150,40,0.10)'; ctx.fillRect(0, 0, W, H); }
    drawParticles();
    drawSpeedLines();
    ctx.restore();
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawSpeedLines() {
    const sp = G.speed / MAXSPEED;
    if (sp < 0.72 || G.mode === 'title') return;
    const a = (sp - 0.72) / 0.28;
    ctx.strokeStyle = `rgba(255,255,255,${0.28 * a})`;
    ctx.lineWidth = Math.max(1, W / 700);
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + (G.t * 7.3 + i * 13.7) % 0.3;
      const r0 = Math.max(W, H) * (0.42 + ((G.t * 3 + i * 0.37) % 1) * 0.25);
      const r1 = r0 + Math.max(W, H) * 0.12 * a;
      const cx = W / 2, cy = HORIZON;
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.7);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.7);
    }
    ctx.stroke();
  }
  function emit(n, x, y, color, spd, life) {
    for (let i = 0; i < n; i++) G.particles.push({ x, y, vx: rand(-1, 1) * spd, vy: rand(-1.2, 0.2) * spd, life: life * rand(0.6, 1), max: life, color });
  }
  function drawParticles() {
    for (const p of G.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, Math.max(2, W / 400), Math.max(2, W / 400));
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- 交通
  function laneX(c, seg) {
    const w = seg.width;
    let x;
    if (seg.lanes >= 4) x = (c.lane ? 0.75 : 0.25) * w;
    else if (seg.lanes === 2) x = 0.5 * w;
    else x = c.dir > 0 ? 0.42 * w : 0.3 * w;
    if (c.dir > 0) x = -x;
    else {
      const narrow = seg.lanes === 1 ? 1 : (seg.lanes === 2 ? 0.5 : 0.15);
      x -= c.aggr * narrow * 0.38 * w * (0.65 + 0.35 * Math.sin(c.phase + G.t * 1.3));
      x -= seg.curve * 75 * c.aggr * (seg.lanes >= 4 ? 0.2 : 1);
    }
    const half = c.w * 0.45;
    return clamp(x, -w + half, w - half);
  }
  function pickType(theme) {
    const mix = CAR_MIX[theme] || CAR_MIX.suburb;
    let r = Math.random();
    for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
    return 'sedan';
  }
  function spawnCar(dir, rel) {
    const pz = G.position + PLAYER_Z;
    const z = pz + rel;
    if (z >= (segments.length - 5) * SEG) return;
    const seg = findSeg(z);
    if (seg.index >= track.goalSeg) return;
    for (const o of G.cars) if (o.dir === dir && Math.abs(o.z - z) < 2400) return;
    const type = pickType(seg.theme);
    const set = Sprites.cars[type];
    const i = Math.floor(Math.random() * set.rear.length);
    const slow = type === 'truck' || type === 'bus' || type === 'keitruck';
    const narrow = seg.lanes === 1;
    const c = {
      z, dir, type,
      sprite: dir > 0 ? set.rear[i] : set.front[i],
      w: set.rear[i].worldW * 0.86,
      speed: dir > 0 ? MAXSPEED * (slow ? rand(0.18, 0.32) : rand(0.26, 0.44)) : -MAXSPEED * (narrow ? rand(0.25, 0.4) : rand(0.3, 0.5)),
      lane: Math.random() < 0.5 ? 1 : 0,
      aggr: dir < 0 ? Math.pow(Math.random(), 0.6) : 0,
      phase: Math.random() * 6.28,
      prevRel: rel, ghost: false,
    };
    c.x = laneX(c, seg);
    G.cars.push(c);
  }
  function initTraffic() {
    G.cars.length = 0;
    for (let i = 0; i < 4; i++) spawnCar(1, (40 + i * 45) * SEG);
    for (let i = 0; i < 2; i++) spawnCar(-1, (90 + i * 60) * SEG);
  }
  function updateTraffic(dt, collide) {
    const pz = G.position + PLAYER_Z;
    const pseg = findSeg(pz);
    const st = track.stages[pseg.stage];
    let ahead1 = 0, ahead2 = 0;
    for (let i = G.cars.length - 1; i >= 0; i--) {
      const c = G.cars[i];
      c.z += c.speed * dt;
      const cs = findSeg(c.z);
      c.x = lerp(c.x, laneX(c, cs), Math.min(1, dt * 2.5));
      const rel = c.z - pz;
      if (collide && !c.ghost && c.prevRel > 0 && rel <= 0) carCross(c);
      c.prevRel = rel;
      if (rel < -(PLAYER_Z + 600) || rel > (DRAW + 30) * SEG || c.z < 0 || c.z >= (segments.length - 3) * SEG) { G.cars.splice(i, 1); continue; }
      if (rel > 0) { if (c.dir > 0) ahead1++; else ahead2++; }
    }
    if (pseg.index < track.goalSeg - 20) {
      if (ahead1 < st.traffic[0]) spawnCar(1, rand(0.55, 0.95) * DRAW * SEG);
      if (ahead2 < st.traffic[1]) spawnCar(-1, rand(0.75, 0.98) * DRAW * SEG);
    }
  }
  function carCross(c) {
    if (G.invul > 0 || G.crash > 0) return;
    const gap = Math.abs(c.x - G.x) - (c.w + BIKE_W) / 2;
    if (gap < -40) {
      c.ghost = true;
      crash(c.dir > 0 ? '追突！' : '正面衝突！', c.dir > 0 ? 1.3 : 1.8);
      if (c.dir > 0) G.speed = Math.min(G.speed, c.speed * 0.4);
      return;
    }
    const sp = G.speed / MAXSPEED;
    if (c.dir > 0) { G.overtakes++; G.score += 100; }
    if (gap < 260 && sp > 0.45) {
      G.nearMiss++;
      G.score += 300;
      G.time += 0.5;
      showMsg(c.dir > 0 ? 'ギリギリ！ +0.5秒' : '対向車ギリギリ！ +0.5秒', 'near', 900);
      Sound.whoosh(); Sound.bonus();
    } else if (gap < 600) Sound.whoosh();
  }

  // ---------------------------------------------------------------- 落石
  function updateRocks(dt, collide) {
    const pz = G.position + PLAYER_Z;
    const pseg = findSeg(pz);
    const ahead = segments[Math.min(segments.length - 1, pseg.index + 85)];
    G.rockTimer -= dt;
    if (G.mode === 'play' && ahead.rock > 0 && !ahead.tunnel && G.rockTimer <= 0 && G.rocks.length < 6) {
      G.rockTimer = rand(1.2, 3.5) / ahead.rock;
      const z = pz + rand(75, 100) * SEG;
      const seg = findSeg(z);
      if (seg.rock > 0 && !seg.tunnel) {
        const w = seg.width;
        const cliffSide = seg.L === 'cliff' ? -1 : (seg.R === 'cliff' ? 1 : (Math.random() < 0.5 ? -1 : 1));
        const tx = rand(-w * 0.85, w * 0.85);
        G.rocks.push({ z, x0: cliffSide * (w + 500), x: cliffSide * (w + 500), tx, y: 2800, y0: 2800, vy: 0, size: rand(300, 520), sprite: Sprites.lib['rock' + Math.floor(Math.random() * 3)], prevRel: z - pz, landed: false, ghost: false });
        G.rockFalls++;
        showMsg('⚠ 落石！', 'warn', 1000);
        Sound.rumble();
      }
    }
    for (let i = G.rocks.length - 1; i >= 0; i--) {
      const r = G.rocks[i];
      if (!r.landed) {
        r.vy -= 4200 * dt;
        r.y += r.vy * dt;
        r.x = lerp(r.x0, r.tx, clamp(1 - r.y / r.y0, 0, 1));
        if (r.y <= 0) { r.y = 0; if (r.vy < -1500) { r.vy = -r.vy * 0.25; r.y = 1; } else { r.landed = true; r.vy = 0; } }
      }
      const rel = r.z - pz;
      if (collide && !r.ghost && r.prevRel > 0 && rel <= 0) {
        const gap = Math.abs(r.x - G.x) - (r.size * 0.75 + BIKE_W) / 2;
        if (gap < 0 && r.y < 450 && G.invul <= 0 && G.crash <= 0) { r.ghost = true; crash('落石に激突！', 1.6); }
        else if (gap < 250 && G.speed > MAXSPEED * 0.45) { G.score += 200; showMsg('落石回避！', 'near', 800); Sound.whoosh(); }
      }
      r.prevRel = rel;
      if (rel < -(PLAYER_Z + 600)) G.rocks.splice(i, 1);
    }
  }
  function initRocks() {
    G.rocks.length = 0;
    segments.forEach(s => {
      if (s.staticRock) {
        const w = s.width;
        G.rocks.push({ z: s.index * SEG + SEG / 2, x: rand(-w * 0.7, w * 0.7), x0: 0, tx: 0, y: 0, y0: 1, vy: 0, size: rand(280, 420), sprite: Sprites.lib['rock' + (s.index % 3)], prevRel: 1e9, landed: true, ghost: false, fixed: true });
        G.rocks[G.rocks.length - 1].tx = G.rocks[G.rocks.length - 1].x;
      }
    });
  }

  // ---------------------------------------------------------------- 衝突・転倒
  function crash(msg, dur) {
    G.crash = dur;
    G.crashes++;
    G.crashRot = 0;
    G.crashDir = Math.random() < 0.5 ? -1 : 1;
    G.shake = W / 60;
    G.flash = 0.5;
    G.score -= 300;
    showMsg(msg + '<small>転倒…タイムロス</small>', 'crash', 1500);
    Sound.crash();
    emit(40, W / 2, PLAYER_SY - H * 0.05, '#ffd27a', W / 200, 0.8);
    emit(20, W / 2, PLAYER_SY - H * 0.05, '#999', W / 300, 1.2);
    if (navigator.vibrate) try { navigator.vibrate(200); } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------- 更新
  function update(dt) {
    G.t += dt;
    G.flash = Math.max(0, (G.flash || 0) - dt * 2);
    G.shake = Math.max(0, G.shake - dt * W / 40);
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    if (G.mode === 'title') { attract(dt); return; }
    if (G.mode === 'paused' || G.mode === 'result' || G.mode === 'loading') { Sound.engine(0, false); return; }

    const pz = G.position + PLAYER_Z;
    const seg = findSeg(pz);
    const pct = (pz % SEG) / SEG;
    const sp = G.speed / MAXSPEED;
    updateTheme(seg, dt);

    if (G.mode === 'countdown') {
      const before = Math.ceil(G.countdown);
      G.countdown -= dt;
      const now = Math.ceil(G.countdown);
      if (now !== before && now > 0) { showMsg(String(now), 'count', 800); Sound.beep(false); }
      if (G.countdown <= 0) { G.mode = 'play'; showMsg('GO!!', 'count go', 900); Sound.beep(true); }
      updateTraffic(dt, false);
      Sound.engine(input.accel ? 0.25 : 0.05, true);
      return;
    }

    const playing = G.mode === 'play';
    const control = playing && G.crash <= 0;

    G.position = Math.min(G.position + G.speed * dt, (segments.length - DRAW - 3) * SEG);

    let steer = 0;
    if (control) { if (input.left) steer -= 1; if (input.right) steer += 1; }
    const lat = 3300 * Math.min(1, sp * 1.3 + 0.1);
    if (G.speed > 50) G.x += steer * lat * dt;
    G.x -= dt * 3300 * sp * sp * seg.curve * 0.22;
    G.lean = lerp(G.lean, steer * 0.32 + seg.curve * sp * 0.03, Math.min(1, dt * 8));

    if (G.crash > 0) {
      G.crash -= dt;
      G.crashRot += G.crashDir * dt * 7;
      G.speed = Math.max(0, G.speed - MAXSPEED * 1.4 * dt);
      if (G.crash <= 0) { G.invul = 1.6; G.crashRot = 0; G.lean = 0; G.x = clamp(G.x, -seg.width + BIKE_W, seg.width - BIKE_W); }
    } else if (G.mode === 'goal') {
      const floor = G.result && !G.result.goal ? 0 : MAXSPEED * 0.15;
      G.speed = Math.max(floor, G.speed - MAXSPEED * 0.5 * dt);
    } else if (control && input.accel) G.speed += ACCEL * (1 - 0.55 * sp) * dt;
    else if (control && input.brake) G.speed += BRAKE * dt;
    else G.speed += DECEL * dt;
    G.invul = Math.max(0, G.invul - dt);

    const slope = (seg.p2.world.y - seg.p1.world.y) / SEG;
    if (G.crash <= 0) G.speed -= slope * MAXSPEED * 0.3 * dt;

    // 道路端
    const w = lerp(seg.p1.world.w, seg.p2.world.w, pct);
    const edge = w - BIKE_W * 0.5;
    G.offroad = false;
    if (Math.abs(G.x) > edge) {
      const side = G.x < 0 ? seg.L : seg.R;
      if (side !== 'open') {
        G.x = Math.sign(G.x) * edge;
        if (G.speed > MAXSPEED * 0.15) {
          G.speed -= MAXSPEED * 0.9 * dt;
          G.shake = Math.max(G.shake, W / 250);
          G.scrapeT -= dt;
          if (G.scrapeT <= 0) {
            G.scrapeT = 0.15; Sound.scrape();
            emit(6, W / 2 + Math.sign(G.x) * W * 0.05, PLAYER_SY - H * 0.04, '#ffcc55', W / 250, 0.4);
            if (Math.random() < 0.2) showMsg(side === 'cliff' ? 'ガリガリッ！' : 'ガードレール！', 'warn small', 500);
          }
        }
      } else {
        if (Math.abs(G.x) > w + 60) {
          G.offroad = true;
          if (G.speed > OFF_LIMIT) G.speed += OFF_DECEL * dt;
          G.shake = Math.max(G.shake, W / 300 * sp);
          if (Math.random() < 0.4) emit(1, W / 2, PLAYER_SY, '#a08a5a', W / 300, 0.5);
        }
        G.x = clamp(G.x, -(w + 1500), w + 1500);
      }
    }
    G.speed = clamp(G.speed, 0, MAXSPEED);
    G.topSpeed = Math.max(G.topSpeed, G.speed);

    updateTraffic(dt, playing);
    updateRocks(dt, playing);
    G.skyOffset += seg.curve * sp * dt * 0.025;

    if (playing) {
      G.time -= dt;
      G.elapsed += dt;
      if (G.time <= 0) { G.time = 0; finish(false); return; }
      // チェックポイント
      if (seg.stage > G.stage) {
        G.stage = seg.stage;
        const st = track.stages[G.stage];
        G.time += st.bonus;
        showMsg(`CHECK POINT<small>${st.name}　+${st.bonus}秒</small>`, 'cp', 2200);
        Sound.chime();
      }
      // 名所トースト
      for (let i = G.lastSeg + 1; i <= seg.index; i++) {
        const inf = segments[i].info;
        if (inf && inf.title !== 'GOAL') toast(inf.title, inf.desc);
      }
      G.lastSeg = seg.index;
      if (seg.index >= track.goalSeg) {
        G.mode = 'goal';
        G.goalTimer = 0;
        showMsg('GOAL!!<small>国道168号 完走！</small>', 'cp goal', 3000);
        Sound.fanfare();
        G.result = makeResult(true);
      }
    } else if (G.mode === 'goal') {
      G.goalTimer += dt;
      if (G.goalTimer > 3.2) showResult();
    }
    Sound.engine(sp, true);
  }

  function updateTheme(seg, dt) {
    if (seg.theme !== G.theme) { G.themePrev = G.theme; G.theme = seg.theme; G.themeFade = 0; }
    if (G.themeFade < 1) G.themeFade = Math.min(1, G.themeFade + dt / 1.8);
  }

  function attract(dt) {
    const pz = G.position + PLAYER_Z;
    const seg = findSeg(pz);
    G.speed = MAXSPEED * 0.6;
    G.position += G.speed * dt;
    if (G.position >= (track.goalSeg - 10) * SEG) { G.position = 0; G.cars.length = 0; }
    const target = seg.lanes >= 4 ? -seg.width * 0.25 : -seg.width * 0.45;
    G.x = lerp(G.x, target, Math.min(1, dt * 1.5));
    G.skyOffset += seg.curve * 0.6 * dt * 0.025;
    updateTheme(seg, dt);
    updateTraffic(dt, false);
  }

  // ---------------------------------------------------------------- HUD・メッセージ
  const hud = {
    time: $('hudTime'), speed: $('hudSpeed'), km: $('hudKm'), stage: $('hudStage'), alt: $('hudAlt'),
    over: $('hudOver'), near: $('hudNear'), marker: $('hudMarker'), timeBox: $('hudTimeBox'),
  };
  let msgTimer = null, toastTimer = null;
  function showMsg(html, cls, ms) {
    const el = $('msg');
    el.innerHTML = html;
    el.className = 'show ' + (cls || '');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.className = ''; }, ms || 1200);
  }
  function toast(title, desc) {
    const el = $('toast');
    el.innerHTML = `<b>◆ ${title}</b>${desc ? `<span>${desc}</span>` : ''}`;
    el.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, 3800);
  }
  function updateHud() {
    if (G.mode === 'title' || G.mode === 'loading') return;
    const pz = G.position + PLAYER_Z;
    const segF = pz / SEG;
    const km = Math.min(track.TOTAL_KM, track.kmAt(segF));
    const seg = findSeg(pz);
    hud.time.textContent = G.time < 10 ? G.time.toFixed(1) : Math.ceil(G.time);
    hud.timeBox.classList.toggle('danger', G.time < 10 && G.mode === 'play');
    hud.speed.textContent = Math.round(G.speed / MAXSPEED * KMH_MAX);
    hud.km.textContent = `${km.toFixed(1)} km`;
    hud.stage.textContent = track.stages[seg.stage].name;
    hud.alt.textContent = `標高 ${Math.round(track.altAt(km))}m`;
    hud.over.textContent = G.overtakes;
    hud.near.textContent = G.nearMiss;
    hud.marker.style.left = `${(km / track.TOTAL_KM) * 100}%`;
  }
  function buildProgressBar() {
    const bar = $('hudBar');
    const towns = [['枚方', 0], ['生駒', 14], ['香芝', 30], ['五條', 58], ['十津川', 90], ['果無', 128], ['本宮', 146], ['新宮', 180]];
    towns.forEach(([n, k]) => {
      const d = document.createElement('div');
      d.className = 'town';
      d.style.left = `${(k / track.TOTAL_KM) * 100}%`;
      d.innerHTML = `<i></i><span>${n}</span>`;
      bar.appendChild(d);
    });
    // 標高プロファイル
    const c = $('hudProfile');
    c.width = 600; c.height = 60;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(0, 60);
    for (let x = 0; x <= 600; x += 3) g.lineTo(x, 58 - track.altAt(x / 600 * track.TOTAL_KM) / 820 * 54);
    g.lineTo(600, 60); g.closePath(); g.fill();
  }

  // ---------------------------------------------------------------- ゲーム進行
  function resetRun() {
    G.position = 0; G.speed = 0; G.x = -450; G.lean = 0;
    G.time = track.stages[0].bonus; G.elapsed = 0; G.stage = 0;
    G.crash = 0; G.invul = 0; G.shake = 0; G.flash = 0;
    G.overtakes = 0; G.nearMiss = 0; G.crashes = 0; G.rockFalls = 0; G.topSpeed = 0; G.score = 0;
    G.lastSeg = 0; G.skyOffset = 0; G.particles.length = 0; G.result = null;
    G.theme = 'city'; G.themePrev = null; G.themeFade = 1;
    initTraffic(); initRocks();
  }
  function startGame() {
    Sound.init();
    resetRun();
    hideAll();
    $('hud').hidden = false;
    if (isTouch()) $('touch').hidden = false;
    $('btnPause').hidden = false;
    G.mode = 'countdown';
    G.countdown = 3.2;
    toast('枚方市', '国道168号の起点。目指すは約180km先の新宮市！');
  }
  function finish(goal) {
    G.result = makeResult(goal);
    if (!goal) {
      showMsg('TIME UP<small>力尽きた…</small>', 'crash', 2500);
      G.mode = 'goal';
      G.goalTimer = 0.8;
    }
  }
  function makeResult(goal) {
    const pz = G.position + PLAYER_Z;
    const seg = findSeg(pz);
    const km = Math.min(track.TOTAL_KM, track.kmAt(pz / SEG));
    let score = Math.floor(km * 100) + G.overtakes * 100 + G.nearMiss * 300 - G.crashes * 300;
    if (goal) score += 5000 + Math.floor(G.time * 100);
    score = Math.max(0, score);
    let rank, title;
    if (goal) {
      if (score >= 42000 && G.crashes <= 2) { rank = 'S'; title = '酷道168号の星'; }
      else if (score >= 34000) { rank = 'A'; title = '十津川の韋駄天'; }
      else if (score >= 27000) { rank = 'B'; title = '果無を越えし者'; }
      else { rank = 'C'; title = '熊野詣ライダー'; }
    } else {
      const names = ['枚方の見習いライダー', '生駒越えの挑戦者', '大和路のツーリスト', '天辻峠の挑戦者', '十津川の修行者', '果無の旅人', '本宮まであと一歩', '新宮目前の勇者'];
      rank = seg.stage >= 5 ? 'D' : 'E';
      title = names[seg.stage];
    }
    return { goal, km, score, rank, title, time: G.elapsed, overtakes: G.overtakes, nearMiss: G.nearMiss, crashes: G.crashes, top: Math.round(G.topSpeed / MAXSPEED * KMH_MAX), place: track.stages[seg.stage].name };
  }
  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return `${m}'${String(s).padStart(2, '0')}"${String(cs).padStart(2, '0')}`;
  }
  function loadBest() { try { return JSON.parse(localStorage.getItem('k168_best') || 'null'); } catch (e) { return null; } }
  function saveBest(r) {
    const b = loadBest();
    if (!b || r.score > b.score) { try { localStorage.setItem('k168_best', JSON.stringify({ score: r.score, rank: r.rank, title: r.title, time: r.time, goal: r.goal, km: r.km })); } catch (e) { /* noop */ } return true; }
    return false;
  }
  function showResult() {
    if (G.mode === 'result') return;
    G.mode = 'result';
    const r = G.result || makeResult(false);
    const isBest = saveBest(r);
    $('hud').hidden = true; $('touch').hidden = true; $('btnPause').hidden = true;
    $('resRank').textContent = r.rank;
    $('resRank').className = 'rank rank-' + r.rank;
    $('resTitle').textContent = r.title;
    $('resHead').textContent = r.goal ? '完走！ 枚方 → 新宮' : `${r.place}で力尽きた…`;
    $('resTime').textContent = r.goal ? fmtTime(r.time) : `${r.km.toFixed(1)} km 地点`;
    $('resTimeLbl').textContent = r.goal ? 'タイム' : '到達';
    $('resScore').textContent = r.score.toLocaleString();
    $('resOver').textContent = r.overtakes + '台';
    $('resNear').textContent = r.nearMiss + '回';
    $('resCrash').textContent = r.crashes + '回';
    $('resTop').textContent = r.top + 'km/h';
    $('resBest').hidden = !isBest;
    drawResultCard(r);
    $('result').hidden = false;
  }

  // ---------------------------------------------------------------- シェア
  function shareUrl() { return /^https?:/.test(location.protocol) ? location.href.split('#')[0].split('?')[0] : ''; }
  function shareText() {
    const r = G.result;
    if (!r) return '';
    const head = r.goal ? `国道168号 枚方→新宮 約180kmを ${fmtTime(r.time)} で完走！` : `国道168号を ${r.km.toFixed(1)}km 地点（${r.place}）まで激走！`;
    return `【酷道168号の星】${head}\nランク${r.rank}「${r.title}」 SCORE ${r.score.toLocaleString()}\n追い抜き${r.overtakes}台・ギリギリ${r.nearMiss}回・転倒${r.crashes}回`;
  }
  function openShare(kind) {
    const text = shareText(), url = shareUrl();
    const e = encodeURIComponent;
    let href = '';
    if (kind === 'x') href = `https://twitter.com/intent/tweet?text=${e(text)}${url ? `&url=${e(url)}` : ''}&hashtags=${e('酷道168号の星,国道168号')}`;
    if (kind === 'line') href = `https://social-plugins.line.me/lineit/share?url=${e(url || 'https://line.me')}&text=${e(text + (url ? '\n' + url : ''))}`;
    if (kind === 'fb') href = `https://www.facebook.com/sharer/sharer.php?u=${e(url)}&quote=${e(text)}`;
    if (href) window.open(href, '_blank', 'noopener,width=620,height=560');
  }
  async function nativeShare() {
    const text = shareText(), url = shareUrl();
    const data = { title: '酷道168号の星', text: url ? text : text + '\n#酷道168号の星', url: url || undefined };
    try {
      const blob = await new Promise(res => $('resCard').toBlob(res, 'image/png'));
      if (blob) {
        const file = new File([blob], 'kokudo168.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      }
    } catch (e) { /* noop */ }
    try { await navigator.share(data); } catch (e) { /* キャンセル */ }
  }
  async function copyResult() {
    const t = shareText() + (shareUrl() ? '\n' + shareUrl() : '') + '\n#酷道168号の星';
    try { await navigator.clipboard.writeText(t); showCopied('コピーしました！'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showCopied('コピーしました！'); } catch (e2) { showCopied('コピーできませんでした'); }
      ta.remove();
    }
  }
  function showCopied(t) { const el = $('copied'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1600); }
  function saveImage() {
    const a = document.createElement('a');
    a.download = 'kokudo168_result.png';
    a.href = $('resCard').toDataURL('image/png');
    a.click();
  }
  function drawResultCard(r) {
    const c = $('resCard');
    c.width = 1200; c.height = 630;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 630);
    gr.addColorStop(0, '#22305e'); gr.addColorStop(0.6, '#b4566a'); gr.addColorStop(1, '#ffb15a');
    g.fillStyle = gr; g.fillRect(0, 0, 1200, 630);
    // 山並み
    const layers = Sprites.themes.kumano;
    layers.forEach((L, i) => g.drawImage(L.img, -200 * i, 630 - 300 + i * 20, 2048 * 0.7, 512 * 0.7));
    g.fillStyle = 'rgba(10,15,35,0.55)'; g.fillRect(0, 0, 1200, 630);
    // 星
    g.fillStyle = '#fff';
    const rr = Sprites.rng(9);
    for (let i = 0; i < 80; i++) { g.globalAlpha = rr() * 0.8; g.fillRect(rr() * 1200, rr() * 300, 2, 2); }
    g.globalAlpha = 1;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `400 72px ${Sprites.TITLE_FONT}`;
    g.fillStyle = '#ffd400'; g.fillText('酷道168号の星', 60, 110);
    g.font = `900 34px ${Sprites.FONT}`; g.fillStyle = '#fff';
    g.fillText(r.goal ? '完走！ 枚方市 → 新宮市 約180km' : `${r.place}（${r.km.toFixed(1)}km地点）で力尽きた…`, 60, 170);
    // ランク
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(60, 210, 300, 300);
    g.font = `400 220px ${Sprites.TITLE_FONT}`; g.textAlign = 'center';
    g.fillStyle = { S: '#ffd400', A: '#ff7a59', B: '#7fd1ff', C: '#a5e887', D: '#ddd', E: '#bbb' }[r.rank];
    g.fillText(r.rank, 210, 450);
    g.font = `900 30px ${Sprites.FONT}`; g.fillStyle = '#fff'; g.fillText(`「${r.title}」`, 210, 500);
    g.textAlign = 'left';
    const rows = [[r.goal ? 'TIME' : '到達', r.goal ? fmtTime(r.time) : `${r.km.toFixed(1)} km`], ['SCORE', r.score.toLocaleString()], ['追い抜き', `${r.overtakes} 台`], ['ギリギリ', `${r.nearMiss} 回`], ['転倒', `${r.crashes} 回`], ['最高速', `${r.top} km/h`]];
    rows.forEach(([k, v], i) => {
      const y = 250 + i * 50;
      g.font = `700 30px ${Sprites.FONT}`; g.fillStyle = '#ffd9a0'; g.fillText(k, 420, y);
      g.font = `400 40px ${Sprites.TITLE_FONT}`; g.fillStyle = '#fff'; g.fillText(v, 620, y + 2);
    });
    // ルート線
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(420, 580); g.lineTo(1140, 580); g.stroke();
    g.fillStyle = '#ffd400';
    const px = 420 + 720 * (r.km / track.TOTAL_KM);
    g.beginPath(); g.arc(px, 580, 12, 0, Math.PI * 2); g.fill();
    g.font = `700 20px ${Sprites.FONT}`; g.fillStyle = '#fff';
    g.fillText('枚方', 410, 560); g.textAlign = 'right'; g.fillText('新宮', 1150, 560);
    g.textAlign = 'right'; g.font = `700 22px ${Sprites.FONT}`; g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillText('#酷道168号の星', 1140, 70);
    const sign = Sprites.lib.sign168;
    g.drawImage(sign.img, 1060, 100, 90, 180);
  }

  // ---------------------------------------------------------------- 入力
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'accel', KeyW: 'accel', Space: 'accel', KeyZ: 'accel', ArrowDown: 'brake', KeyS: 'brake', KeyX: 'brake' };
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) { input[k] = true; e.preventDefault(); }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (e.code === 'Enter') {
      if (G.mode === 'title' && $('howto').hidden) startGame();
      else if (G.mode === 'result') startGame();
    }
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) { input[k] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { Object.keys(input).forEach(k => input[k] = false); if (G.mode === 'play') togglePause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') togglePause(true); });

  function bindTouch() {
    document.querySelectorAll('#touch [data-key]').forEach(btn => {
      const k = btn.dataset.key;
      const on = (e) => { e.preventDefault(); input[k] = true; btn.classList.add('on'); Sound.init(); };
      const off = (e) => { e.preventDefault(); input[k] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
  function isTouch() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; }

  let pausedFrom = null;
  function togglePause(force) {
    if (G.mode === 'play' || G.mode === 'countdown') {
      pausedFrom = G.mode; G.mode = 'paused'; $('pause').hidden = false;
    } else if (G.mode === 'paused' && force !== true) {
      G.mode = pausedFrom || 'play'; $('pause').hidden = true;
    }
  }
  function hideAll() { ['title', 'howto', 'pause', 'result'].forEach(id => { $(id).hidden = true; }); }
  function toTitle() {
    hideAll();
    $('hud').hidden = true; $('touch').hidden = true; $('btnPause').hidden = true;
    G.mode = 'title';
    G.position = 0; G.x = -450; G.cars.length = 0; G.rocks.length = 0; G.theme = 'city'; G.themePrev = null;
    showBest();
    $('title').hidden = false;
  }
  function showBest() {
    const b = loadBest();
    $('best').textContent = b ? `自己ベスト：ランク${b.rank}「${b.title}」 SCORE ${b.score.toLocaleString()}${b.goal ? ' / ' + fmtTime(b.time) : ''}` : '';
  }
  function bindUi() {
    $('btnStart').addEventListener('click', startGame);
    $('btnHowto').addEventListener('click', () => { $('howto').hidden = false; });
    $('btnHowtoClose').addEventListener('click', () => { $('howto').hidden = true; });
    $('btnResume').addEventListener('click', () => togglePause());
    $('btnPause').addEventListener('click', () => togglePause());
    $('btnQuit').addEventListener('click', toTitle);
    $('btnRetry').addEventListener('click', startGame);
    $('btnTitle').addEventListener('click', toTitle);
    $('shareX').addEventListener('click', () => openShare('x'));
    $('shareLine').addEventListener('click', () => openShare('line'));
    $('shareFb').addEventListener('click', () => openShare('fb'));
    $('shareCopy').addEventListener('click', copyResult);
    $('shareImg').addEventListener('click', saveImage);
    const ns = $('shareNative');
    if (navigator.share) ns.addEventListener('click', nativeShare); else ns.hidden = true;
    if (!shareUrl()) $('shareFb').hidden = true;
    const mute = $('btnMute');
    const upd = () => { mute.textContent = Sound.muted ? '🔇' : '🔊'; };
    upd();
    mute.addEventListener('click', () => { Sound.init(); Sound.setMuted(!Sound.muted); upd(); });
    bindTouch();
  }

  // ---------------------------------------------------------------- ループ
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  async function boot() {
    resize();
    window.addEventListener('resize', resize);
    try {
      await Promise.race([
        Promise.all([document.fonts.load('400 40px "Dela Gothic One"'), document.fonts.load('900 40px "Noto Sans JP"'), document.fonts.load('700 40px "Noto Sans JP"')]),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch (e) { /* フォント無しでも続行 */ }
    Sprites.buildAll();
    track = Route.build();
    segments = track.segments;
    window.KOKUDO_TRACK = track;
    trackLen = segments.length * SEG;
    // 区間ごとの持ち時間（秒）
    track.stages.forEach((s, i) => { s.bonus = Math.round(s.len / (i === 0 ? 40 : 43)) + (i === 0 ? 4 : 0); });
    buildProgressBar();
    bindUi();
    $('loading').hidden = true;
    const qs = new URLSearchParams(location.search);
    toTitle();
    if (qs.has('stage')) {
      // デバッグ用：指定区間から開始
      startGame();
      const st = track.stages[clamp(parseInt(qs.get('stage'), 10) || 0, 0, 7)];
      G.position = st.start * SEG; G.stage = track.stages.indexOf(st); G.lastSeg = st.start; G.time = 60;
      initTraffic();
    }
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }
  boot();
})();
