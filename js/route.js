'use strict';
// 国道168号のコースデータ。枚方市 → 新宮市
// 道幅・勾配・カーブ・景観を区間ごとに定義する。
const Route = (() => {
  const SEG = 200;
  const W4 = 1800, W2 = 1000, W15 = 780;

  // 実際のキロ程（おおよそ）と区間
  const STAGES = [
    { name: '枚方市・交野市', short: '枚方', km: [0, 14], traffic: [6, 4] },
    { name: '生駒市・平群町・王寺町', short: '生駒', km: [14, 30], traffic: [6, 4] },
    { name: '香芝市 → 五條市', short: '香芝', km: [30, 58], traffic: [7, 4] },
    { name: '天辻峠・大塔', short: '五條', km: [58, 90], traffic: [5, 4] },
    { name: '十津川村', short: '十津川', km: [90, 124], traffic: [5, 4] },
    { name: '十津川温泉・果無', short: '十津川温泉', km: [124, 146], traffic: [5, 4] },
    { name: '熊野本宮', short: '本宮', km: [146, 157], traffic: [6, 4] },
    { name: '熊野川 → 新宮市', short: '新宮', km: [157, 180], traffic: [6, 4] },
  ];
  const TOTAL_KM = 180;
  // 標高プロファイル（km, m）おおよその値
  const ALT = [[0, 15], [6, 30], [11, 230], [13, 290], [15, 120], [22, 90], [29, 40], [40, 70], [55, 110], [60, 130], [66, 380], [71, 760], [74, 700], [80, 520], [88, 420], [100, 330], [112, 250], [124, 190], [134, 170], [146, 80], [157, 50], [170, 25], [180, 5]];

  let segs, cur, lastY, lastW, rnd, infos, stageStarts;

  const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
  const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);

  function set(o) { Object.assign(cur, o); }
  function addSeg(curve, y) {
    const n = segs.length;
    const tw = cur.width;
    let w = lastW + (tw - lastW) * 0.06;
    if (Math.abs(w - tw) < 4) w = tw;
    const prev = segs[n - 1];
    const s = {
      index: n,
      p1: { world: { x: 0, y: lastY, z: n * SEG, w: lastW }, camera: {}, screen: {} },
      p2: { world: { x: 0, y, z: (n + 1) * SEG, w }, camera: {}, screen: {} },
      curve, sprites: [], cars: [], rocks: [],
      width: w, lanes: cur.lanes, line: cur.line, L: cur.L, R: cur.R,
      ground: cur.ground, theme: cur.theme, deco: cur.deco, tunnel: cur.tunnel,
      rock: cur.tunnel ? 0 : cur.rock, stage: cur.stage, water: cur.water, cliffStyle: cur.cliffStyle, railColor: cur.railColor,
      cliffH: 2200 + rnd() * 1400,
    };
    s.prevCliffH = prev ? prev.cliffH : s.cliffH;
    if (cur.tunnel && (!prev || !prev.tunnel)) { s.tunnelStart = true; s.tunnelName = cur.tunnelName || ''; }
    segs.push(s);
    lastY = y; lastW = w;
  }
  function road(enter, hold, leave, curve, dy) {
    const startY = lastY, endY = startY + (dy || 0), total = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }
  // 長さ len のカーブ（curve: 正=右, 負=左）と高低差 dy
  function R(len, curve, dy) { const e = Math.floor(len * 0.25); road(e, len - e * 2, e, curve, dy); }
  function S(len, dy) { R(len, 0, dy); }
  // ランダムなワインディング
  function wind(n, len, maxC, dyEach) {
    let sgn = rnd() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const c = sgn * maxC * (0.5 + rnd() * 0.5);
      const l = Math.floor(len * (0.7 + rnd() * 0.6));
      R(l, c, typeof dyEach === 'function' ? dyEach(i) : (dyEach || 0) * (0.6 + rnd() * 0.8));
      sgn = -sgn;
    }
  }

  // 景観・ランドマーク
  function at(k) { return segs.length + (k || 0); }
  const pending = [];
  function mark(k, key, side, gap, opts = {}) { pending.push({ i: at(k), key, side, gap, ...opts }); }
  function sign(k, key, side) { pending.push({ i: at(k), key, side: side || 'L', gap: 260 }); }
  function obj(k, sprite, side, gap, opts = {}) { pending.push({ i: at(k), sprite, side, gap, ...opts }); }
  function info(k, title, desc) { infos.push({ i: at(k), title, desc }); }
  function town(k, name, roman) { obj(k, Sprites.blueSign([name, roman], 2000), 'L', 260); }
  function stage(i) {
    cur.stage = i;
    stageStarts[i] = segs.length;
    if (i > 0) obj(2, Sprites.gate('CHECK POINT', STAGES[i].name, '#1f6fb2'), 'C', 0);
  }
  function bridge(len, name, color, desc) {
    const save = { L: cur.L, R: cur.R, deco: cur.deco };
    set({ L: 'bridge', R: 'bridge', railColor: color || '#c0392b', deco: 'none' });
    if (name) info(0, name, desc || '');
    S(len, 0);
    set(save);
  }
  function tunnel(len, name, dy) {
    set({ tunnel: true, tunnelName: name || '' });
    const saveL = cur.L, saveR = cur.R, saveDeco = cur.deco;
    set({ L: 'tunnel', R: 'tunnel', deco: 'none' });
    if (name) info(0, name, 'トンネルを一気に抜けろ！');
    S(len, dy || 0);
    set({ tunnel: false, L: saveL, R: saveR, deco: saveDeco });
  }

  function build() {
    segs = []; infos = []; stageStarts = []; pending.length = 0;
    rnd = Sprites.rng(168);
    lastY = 0; lastW = W4;
    cur = { width: W4, lanes: 4, line: 'yellow', L: 'open', R: 'open', ground: 'city', theme: 'city', deco: 'city', tunnel: false, rock: 0, stage: 0, water: '#3f86a8', cliffStyle: 0, railColor: '#c0392b' };

    // ===== 1. 枚方市・交野市・磐船街道 =====
    stage(0);
    obj(10, Sprites.gate('START', '国道168号 枚方市', '#d6312b'), 'C', 0);
    info(4, '枚方市', '国道168号の起点。目指すは約180km先の新宮市！');
    sign(16, 'sign168', 'L');
    S(40, 0);
    R(120, 0.8, 0); R(100, -1.2, 400); S(80, 0); R(100, 1.4, -200);
    town(0, '交野市', 'Katano City');
    info(0, '交野市', '七夕伝説が残る“星のまち”');
    set({ width: W2, lanes: 2, line: 'white', ground: 'grass', theme: 'suburb', deco: 'suburb' });
    R(130, -1, 600); S(50, 200);
    bridge(26, '天野川', '#c0392b', '織姫と彦星の“天の川”。交野は星の伝説の地');
    R(90, 1.5, 800);
    sign(0, 'sign_kokudo', 'L');
    sign(14, 'sign_narrow', 'L');
    set({ width: W15, lanes: 1, line: 'none', L: 'cliff', R: 'valley', ground: 'forest', theme: 'mountain', deco: 'forest', rock: 0.25, water: '#3c8a86' });
    info(10, '磐船街道', 'ここから酷道！ 狭い・急カーブ・対向車に注意');
    sign(24, 'sign_rock', 'L');
    R(60, -4, 1600); R(50, 5, 1800); R(40, -5.5, 1200);
    mark(5, 'iwafune', 'R', 1900);
    info(5, '磐船神社', '天の磐船を御神体とする古社。巨岩が谷にそびえる');
    R(60, 3.5, 800); R(50, -4.5, 600);
    mark(10, 'buranko', 'R', 3800);
    info(10, '星のブランコ', 'ほしだ園地の大吊り橋。全長280m');
    R(70, 4, -600); R(60, -3, -1500); R(80, 2, -2200);

    // ===== 2. 生駒・平群・王寺 =====
    stage(1);
    set({ width: W2, lanes: 2, line: 'white', L: 'open', R: 'open', ground: 'grass', theme: 'suburb', deco: 'suburb', rock: 0 });
    town(6, '生駒市', 'Ikoma City');
    info(6, '生駒市', '生駒山上のテレビ塔群が見えてきた');
    R(120, 1, -800); S(60, 0); R(100, -2, 300); R(80, 1.5, 0);
    town(0, '平群町', 'Heguri Town');
    info(0, '竜田川', '平群谷を竜田川に沿って南へ。紅葉の名所');
    set({ R: 'river', water: '#4a8aa0', line: 'yellow' });
    R(90, -1.5, -200); R(90, 2, -300); R(80, -1, -200); R(70, 1.8, -100);
    set({ R: 'open', line: 'white' });
    R(100, 1, 0);
    town(0, '王寺町', 'Oji Town');
    S(30, 0);
    bridge(36, '大和川', '#7f8c8d', '奈良盆地の水を集める大和川を渡る');
    R(80, -1, 100);

    // ===== 3. 香芝 → 五條 =====
    stage(2);
    set({ theme: 'yamato', deco: 'field', ground: 'field', width: W4, lanes: 4, line: 'yellow' });
    town(6, '香芝市', 'Kashiba City');
    info(6, '二上山', '雄岳と雌岳、ふたこぶの二上山が見える');
    S(100, 0); R(150, 0.6, 200); S(120, -100);
    set({ width: W2, lanes: 2 });
    R(120, -1.2, 300); R(100, 1, 0); S(80, 0);
    info(0, '金剛山・葛城山', '奈良と大阪を分ける金剛山地が連なる');
    R(140, 0.8, -200); R(100, -1.5, 200);
    town(0, '五條市', 'Gojo City');
    info(0, '五條市', '日本有数の柿の産地。柿畑が広がる');
    set({ deco: 'kaki' });
    R(120, 1, -200); S(60, 0);

    // ===== 4. 五條 → 天辻峠 → 大塔 =====
    stage(3);
    set({ deco: 'town', ground: 'grass', theme: 'yamato' });
    info(10, '五條新町', '江戸時代の町家が残る古い町並み');
    S(70, 0);
    bridge(44, '吉野川', '#2e6da4', '紀の川上流・吉野川を渡る');
    sign(4, 'sign_slope', 'L');
    sign(30, 'sign_curveR', 'L');
    set({ theme: 'mountain', deco: 'forest', ground: 'forest', L: 'cliff', R: 'valley', width: W2, lanes: 2, line: 'yellow', rock: 0.35, water: '#3c8a86', cliffStyle: 1 });
    info(4, '天辻峠へ', '標高差約700mの大登り！ ヘアピン連続');
    R(30, -6, 1600); R(40, 5, 2200); R(30, -6.5, 1800); R(40, 6, 2400);
    set({ L: 'valley', R: 'cliff' });
    R(50, -3, 1800); R(30, 6.5, 1600); R(40, -5, 1800);
    set({ width: W15, lanes: 1, line: 'none', cliffStyle: 0 });
    R(40, 4, 1500); R(30, -6, 1400); R(50, 3, 1000);
    info(0, '天辻峠', '標高約800m。168号の最高地点付近');
    set({ width: W2, lanes: 2, line: 'yellow' });
    S(20, 0);
    tunnel(110, '新天辻トンネル', -500);
    town(4, '五條市大塔町', 'Otō');
    set({ L: 'cliff', R: 'valley', cliffStyle: 1 });
    R(60, -4, -2600); R(50, 5, -2200); R(60, -3, -1800);
    set({ L: 'open', R: 'valley', deco: 'forest' });
    mark(10, 'hoshinokuni', 'L', 700);
    info(10, '星のくに', '満天の星空で知られる大塔の天文の里');
    R(70, 1.5, -600);
    mark(20, 'michi_oto', 'L', 500);
    info(20, '道の駅 吉野路大塔', 'ひと休み…している暇はない！');
    R(70, -2.5, -600);
    set({ L: 'cliff', cliffStyle: 0 });
    mark(16, 'dam', 'R', 4500);
    info(16, '猿谷ダム', '熊野川（天ノ川）最上流のダム湖');
    R(70, 3, -300); R(70, -3.5, -300); R(60, 2.5, -200);

    // ===== 5. 十津川村 =====
    stage(4);
    set({ theme: 'deep', L: 'cliff', R: 'valley', width: W15, lanes: 1, line: 'none', rock: 0.7, deco: 'forest', ground: 'forest', water: '#2f8a7e', cliffStyle: 0 });
    town(6, '十津川村', 'Totsukawa Village');
    info(6, '十津川村', '日本一面積の広い村。深い谷と落石の世界へ');
    sign(16, 'sign_rock', 'L');
    sign(30, 'sign_narrow', 'L');
    wind(6, 46, 5, () => (rnd() - 0.55) * 1400);
    tunnel(40, '', 0);
    set({ width: W2, lanes: 2, line: 'yellow', cliffStyle: 1 });
    mark(20, 'dam', 'R', 4800);
    info(20, '風屋ダム', '十津川をせき止める巨大ダム');
    R(80, 2.5, -300); R(70, -3, 200);
    tunnel(50, '', -100);
    set({ width: W15, lanes: 1, line: 'none', cliffStyle: 0, rock: 0.8 });
    wind(5, 44, 5.5, () => (rnd() - 0.5) * 1200);
    mark(18, 'tanize', 'R', 3800);
    info(18, '谷瀬の吊り橋', '長さ297m・高さ54m。日本有数の生活用吊り橋');
    R(70, 2, -200); R(60, -2.5, 0);
    sign(0, 'sign_totsu', 'L');
    set({ width: W2, lanes: 2, line: 'yellow', L: 'open', deco: 'town', ground: 'grass' });
    mark(16, 'michi_totsu', 'L', 500);
    info(16, '道の駅 十津川郷', '十津川村の玄関口');
    R(80, -1.5, 0);
    mark(6, 'onsen_tosenji', 'L', 400);
    info(6, '湯泉地温泉', '十津川温泉郷のひとつ。源泉かけ流し');
    R(60, 1.5, -100);
    set({ L: 'cliff', deco: 'forest', ground: 'forest', width: W15, lanes: 1, line: 'none', rock: 0.9 });
    sign(4, 'sign_rock', 'L');
    wind(6, 42, 5.5, () => (rnd() - 0.55) * 1000);
    tunnel(36, '', 0);
    set({ L: 'valley', R: 'cliff' });
    wind(4, 46, 4.5, () => (rnd() - 0.5) * 800);

    // ===== 6. 十津川温泉・果無 =====
    stage(5);
    set({ theme: 'hatenashi', L: 'open', R: 'river', width: W2, lanes: 2, line: 'yellow', deco: 'town', ground: 'grass', rock: 0, water: '#2f8a7e' });
    info(6, '十津川温泉', '源泉かけ流し宣言の湯の里');
    mark(10, 'onsen_totsukawa', 'L', 400);
    mark(40, 'onsen_kamiyu', 'L', 500);
    R(70, 1.2, -100); R(60, -1.5, 0);
    set({ L: 'cliff', deco: 'forest', ground: 'forest' });
    mark(14, 'dam', 'R', 4600);
    info(14, '二津野ダム', '果無山脈を望むダム湖');
    R(70, 2.5, 0); R(60, -3, 0);
    set({ width: W15, lanes: 1, line: 'none', rock: 0.6 });
    info(10, '果無山脈', '奈良と和歌山の県境に連なる果無山脈');
    wind(5, 46, 5, () => (rnd() - 0.5) * 1000);
    set({ L: 'open', deco: 'forest' });
    mark(6, 'hatenashi', 'L', 2200);
    info(6, '果無集落', '熊野古道 小辺路沿い“天空の郷”');
    sign(2, 'sign_kodo', 'L');
    sign(30, 'sign_isan', 'L');
    info(30, '熊野古道 小辺路', '高野山と熊野本宮を結ぶ参詣道。果無峠を越える');
    R(80, -2, 400); R(70, 2.5, 200);
    set({ L: 'cliff' });
    wind(4, 46, 4.5, () => (rnd() - 0.6) * 1200);
    obj(0, Sprites.blueSign(['和歌山県', 'Wakayama Pref.'], 2000), 'L', 260);
    obj(4, Sprites.blueSign(['田辺市', 'Tanabe City'], 2000), 'L', 260);
    info(0, '和歌山県', '県境を越えて和歌山県田辺市本宮町へ');
    sign(16, 'sign_hongu', 'L');
    set({ width: W2, lanes: 2, line: 'yellow', rock: 0.3 });
    wind(3, 60, 3.5, -300);

    // ===== 7. 熊野本宮 =====
    stage(6);
    set({ theme: 'kumano', L: 'open', R: 'river', width: W2, lanes: 2, line: 'yellow', deco: 'field', ground: 'field', rock: 0, water: '#3a8f8a' });
    info(10, '熊野本宮大社', '熊野三山のひとつ。全国の熊野神社の総本宮');
    obj(8, null, 'L', 0, { key: 'torii_big', gap: 300 });
    for (let k = 0; k < 8; k++) mark(14 + k * 3, 'nobori', 'L', 120);
    mark(30, 'hongu', 'L', 1200);
    R(80, -1, 200); R(60, 1, 0);
    mark(30, 'ootorii', 'L', 1600);
    info(30, '大斎原の大鳥居', '高さ約34m、日本最大級の大鳥居。熊野本宮大社の旧社地');
    S(90, 0);
    sign(10, 'sign_yunomine', 'L');
    info(10, '湯の峰温泉', '日本最古の湯とも。“つぼ湯”は世界遺産');
    R(80, 1.5, -100);
    info(10, '川湯温泉', '川原を掘ると温泉が湧き出す');
    R(70, -1.5, 0); R(60, 1, -100);

    // ===== 8. 熊野川 → 新宮 =====
    stage(7);
    set({ theme: 'kumano', L: 'cliff', R: 'river', width: W2, lanes: 2, line: 'yellow', deco: 'forest', ground: 'forest', rock: 0.25, water: '#3a8f8a', cliffStyle: 1 });
    info(6, '熊野川', '世界遺産「川の参詣道」。川舟がゆく');
    mark(12, 'boat', 'R', 2600);
    R(150, 2, 0); R(150, -2.5, -100);
    set({ L: 'open', deco: 'forest' });
    mark(16, 'michi_kumano', 'L', 500);
    info(16, '道の駅 瀞峡街道熊野川', '新宮まであと少し！');
    sign(40, 'sign_shingu', 'L');
    R(130, 1.8, 0);
    set({ L: 'cliff' });
    mark(30, 'boat', 'R', 3200);
    R(130, -2, -100); R(120, 1.5, 0);
    town(0, '新宮市', 'Shingu City');
    info(0, '新宮市', '熊野速玉大社のまち。ゴールは目前！');
    set({ theme: 'coast', L: 'open', R: 'river', deco: 'city', ground: 'city', rock: 0 });
    mark(20, 'hayatama', 'L', 900);
    info(20, '熊野速玉大社', '熊野三山のひとつ。朱塗りの社殿');
    R(100, -1, 0);
    mark(10, 'gotobiki', 'R', 6500);
    info(10, '神倉神社 ゴトビキ岩', '神倉山の巨岩。お燈まつりの舞台');
    set({ width: W4, lanes: 4, R: 'open' });
    R(100, 1, 0); S(60, 0);
    const goalSeg = at(0);
    obj(0, Sprites.gate('GOAL', '国道168号 終点 新宮市', '#d6312b'), 'C', 0);
    info(0, 'GOAL', '');
    S(400, 0);

    // 終端
    const total = segs.length;
    STAGES.forEach((s, i) => { s.start = stageStarts[i]; s.end = i < STAGES.length - 1 ? stageStarts[i + 1] : goalSeg; s.len = s.end - s.start; });

    decorate();
    placePending();
    infos.forEach(f => { if (segs[f.i]) segs[f.i].info = f; });

    return { segments: segs, stages: STAGES, goalSeg, total, SEG, kmAt, altAt, TOTAL_KM };
  }

  function sideX(seg, side, gap, worldW) {
    const half = (worldW || 0) / 2;
    if (side === 'C') return 0;
    const d = seg.width + gap + half;
    return side === 'L' ? -d : d;
  }
  function put(seg, sprite, x, extra) { seg.sprites.push(Object.assign({ s: sprite, x }, extra || {})); }

  function placePending() {
    pending.forEach(p => {
      const seg = segs[Math.min(p.i, segs.length - 1)];
      let sprite = p.sprite || Sprites.lib[p.key];
      if (!sprite) return;
      if (p.side === 'C') { put(seg, sprite, 0, { ww: (seg.width + 420) * 2, gate: true }); return; }
      put(seg, sprite, sideX(seg, p.side, p.gap, sprite.worldW));
    });
  }

  function decorate() {
    const L = Sprites.lib;
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const sugis = ['sugi0', 'sugi1', 'sugi2', 'sugi3'];
    let lastRock = 0;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.rock > 0 && !lastRock) put(seg, L.sign_rock, sideX(seg, 'L', 260, L.sign_rock.worldW));
      lastRock = seg.rock;
      if (seg.rock > 0.5 && rnd() < 0.006) seg.staticRock = true;
      [['L', seg.L], ['R', seg.R]].forEach(([side, type]) => {
        if (type === 'open') decoOpen(seg, side, pick, sugis);
        else if (type === 'valley' || type === 'river') {
          if (i % 4 === 0) put(seg, L.delineator, sideX(seg, side, 110, L.delineator.worldW));
          const bank = type === 'valley' ? 3800 : 6400;
          if (rnd() < 0.55) {
            const k = seg.theme === 'mountain' || seg.theme === 'deep' ? (rnd() < 0.3 ? pick(['maple0', 'maple1']) : pick(sugis)) : (rnd() < 0.2 ? pick(['maple0', 'maple1', 'tree0']) : pick(sugis));
            put(seg, L[k], sideX(seg, side, bank + 300 + rnd() * 3000, L[k].worldW));
          }
        } else if (type === 'cliff') {
          if (i % 4 === 2) put(seg, L.delineator, sideX(seg, side, 110, L.delineator.worldW));
        }
      });
    }
  }
  function decoOpen(seg, side, pick, sugis) {
    const L = Sprites.lib;
    const i = seg.index;
    const r = rnd();
    switch (seg.deco) {
      case 'city':
        if (i % 5 === 0) { const k = r < 0.12 ? 'shop' : 'bldg' + Math.floor(rnd() * 6); put(seg, L[k], sideX(seg, side, 500 + rnd() * 900, L[k].worldW)); }
        if (i % 9 === 3) put(seg, L.pole, sideX(seg, side, 200, L.pole.worldW));
        if (i % 7 === 1 && rnd() < 0.5) put(seg, L.tree1, sideX(seg, side, 250, L.tree1.worldW));
        break;
      case 'suburb':
        if (i % 6 === 0 && r < 0.7) { const k = rnd() < 0.08 ? 'shop' : 'house' + Math.floor(rnd() * 4); put(seg, L[k], sideX(seg, side, 400 + rnd() * 1200, L[k].worldW)); }
        else if (r < 0.12) { const k = pick(['tree0', 'tree1', 'maple0', 'bamboo']); put(seg, L[k], sideX(seg, side, 300 + rnd() * 2500, L[k].worldW)); }
        if (i % 10 === 5) put(seg, L.pole, sideX(seg, side, 200, L.pole.worldW));
        break;
      case 'field':
        if (r < 0.05) { const k = 'house' + Math.floor(rnd() * 4); put(seg, L[k], sideX(seg, side, 1200 + rnd() * 3500, L[k].worldW)); }
        else if (r < 0.1) { const k = pick(['tree0', 'tree1', 'bamboo', 'maple1']); put(seg, L[k], sideX(seg, side, 800 + rnd() * 4000, L[k].worldW)); }
        if (i % 10 === 5) put(seg, L.pole, sideX(seg, side, 200, L.pole.worldW));
        break;
      case 'kaki':
        if (r < 0.3) put(seg, L.kaki, sideX(seg, side, 300 + rnd() * 2500, L.kaki.worldW));
        else if (r < 0.34) { const k = 'house' + Math.floor(rnd() * 4); put(seg, L[k], sideX(seg, side, 800 + rnd() * 2000, L[k].worldW)); }
        if (i % 10 === 5) put(seg, L.pole, sideX(seg, side, 200, L.pole.worldW));
        break;
      case 'town':
        if (i % 4 === 0 && r < 0.85) { const k = 'house' + Math.floor(rnd() * 4); put(seg, L[k], sideX(seg, side, 250 + rnd() * 300, L[k].worldW)); }
        if (i % 10 === 5) put(seg, L.pole, sideX(seg, side, 180, L.pole.worldW));
        break;
      case 'forest':
        if (r < 0.65) {
          const k = (seg.theme === 'mountain' && rnd() < 0.35) ? pick(['maple0', 'maple1']) : (rnd() < 0.1 ? 'bamboo' : pick(sugis));
          put(seg, L[k], sideX(seg, side, 250 + rnd() * 2600, L[k].worldW));
        }
        break;
      default: break;
    }
  }

  function kmAt(segFloat) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      const s = STAGES[i];
      if (segFloat >= s.start) {
        const t = Math.min(1, Math.max(0, (segFloat - s.start) / s.len));
        return s.km[0] + (s.km[1] - s.km[0]) * t;
      }
    }
    return 0;
  }
  function altAt(km) {
    for (let i = 1; i < ALT.length; i++) {
      if (km <= ALT[i][0]) {
        const [k0, a0] = ALT[i - 1], [k1, a1] = ALT[i];
        return a0 + (a1 - a0) * (km - k0) / (k1 - k0);
      }
    }
    return ALT[ALT.length - 1][1];
  }

  return { SEG, build, STAGES, TOTAL_KM };
})();
