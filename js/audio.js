'use strict';
// 効果音・エンジン音（WebAudio で合成。外部音源なし）
const Sound = (() => {
  let ac = null, master = null, engGain = null, engFilter = null, osc1 = null, osc2 = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('k168_muted') === '1'; } catch (e) { /* noop */ }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ac.destination);

    engFilter = ac.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 700;
    engFilter.Q.value = 4;
    engGain = ac.createGain();
    engGain.gain.value = 0;
    osc1 = ac.createOscillator(); osc1.type = 'sawtooth';
    osc2 = ac.createOscillator(); osc2.type = 'square';
    const g2 = ac.createGain(); g2.gain.value = 0.4;
    osc1.connect(engFilter); osc2.connect(g2); g2.connect(engFilter);
    engFilter.connect(engGain); engGain.connect(master);
    osc1.start(); osc2.start();

    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // sp: 0..1 の速度率
  function engine(sp, on) {
    if (!ac) return;
    const t = ac.currentTime;
    const gears = 6;
    const g = Math.min(gears - 1, Math.floor(sp * gears));
    const within = sp * gears - g;
    const rpm = 0.3 + within * 0.7;
    const f = 38 + g * 9 + rpm * 120;
    osc1.frequency.setTargetAtTime(f, t, 0.03);
    osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    engFilter.frequency.setTargetAtTime(400 + sp * 2200, t, 0.05);
    engGain.gain.setTargetAtTime(on ? 0.06 + sp * 0.09 : 0, t, 0.08);
  }

  function noise(dur, vol, freq, type) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, type, vol, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('k168_muted', m ? '1' : '0'); } catch (e) { /* noop */ }
    if (master) master.gain.value = m ? 0 : 0.55;
  }

  return {
    init,
    engine,
    crash() { noise(0.7, 0.8, 900); noise(0.4, 0.5, 200); },
    scrape() { noise(0.18, 0.25, 3200, 'bandpass'); },
    whoosh() { noise(0.35, 0.35, 1800, 'bandpass'); },
    rumble() { noise(1.1, 0.5, 160); },
    beep(hi) { tone(hi ? 880 : 440, hi ? 0.5 : 0.2, 'square', 0.18); },
    chime() { tone(784, 0.25, 'triangle', 0.3); tone(1047, 0.4, 'triangle', 0.3, 0.12); },
    fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, i * 0.14)); },
    bonus() { tone(1320, 0.12, 'square', 0.12); tone(1760, 0.15, 'square', 0.12, 0.06); },
    setMuted,
    // アプリが裏に回ったときや広告の表示中は音を止める
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    get muted() { return muted; },
  };
})();
