// Chiptune music and sound effects made with the Web Audio API (no files to download).
let ctx = null, master = null, musicGain = null, current = null, timer = 0, muted = false;
try { muted = localStorage.getItem('sg.mute') === '1'; } catch (e) { /* ignore */ }
export const isMuted = () => muted;
export function unlock() { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; } try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination); musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master); if (current) { const c = current; current = null; music(c); } } catch (e) { ctx = null; } }
export function toggleMute() { muted = !muted; try { localStorage.setItem('sg.mute', muted ? '1' : '0'); } catch (e) { /* ignore */ } if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (s) => { if (s === 'R') return null; const m = /^([A-G])(#|b)?(\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
function tone(f, t, dur, type = 'square', vol = 0.2, dest = master) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
// themes: melody, bass ("note:beats" lists), tempo
const THEMES = {
  title: { bpm: 84, mel: 'D4:2 A4:2 G4:1 F4:1 E4:2 D4:2 F4:1 G4:1 A4:4 C5:2 Bb4:2 A4:1 G4:1 F4:2 E4:2 D4:4 R:2', bass: 'D3:4 Bb2:4 C3:4 A2:4 D3:4 Bb2:4 A2:4 D3:4' },
  world: { bpm: 104, mel: 'G4:1 A4:1 B4:2 D5:2 B4:1 A4:1 G4:2 E4:2 G4:1 A4:1 B4:2 A4:2 G4:4 B4:1 C5:1 D5:2 G5:2 F#5:1 E5:1 D5:2 B4:2 C5:2 A4:2 G4:4', bass: 'G2:4 E2:4 C3:4 D3:4 G2:4 B2:4 C3:4 D3:4' },
  town: { bpm: 96, mel: 'E5:1 D5:1 C5:2 G4:2 A4:1 B4:1 C5:2 E5:2 D5:1 C5:1 B4:2 G4:2 A4:4 C5:1 D5:1 E5:2 G5:2 F5:1 E5:1 D5:2 B4:2 C5:4', bass: 'C3:4 A2:4 F2:4 G2:4 C3:4 E2:4 F2:2 G2:2 C3:4' },
  battle: { bpm: 144, mel: 'A4:1 A4:1 C5:1 A4:1 E5:2 D5:1 C5:1 B4:1 B4:1 D5:1 B4:1 G5:2 F5:1 E5:1 A4:1 C5:1 E5:1 A5:1 G5:2 E5:2 F5:1 E5:1 D5:1 B4:1 C5:2 B4:2', bass: 'A2:1 A2:1 A3:1 A2:1 G2:1 G2:1 G3:1 G2:1 F2:1 F2:1 F3:1 F2:1 E2:1 E2:1 E3:1 G#2:1' },
  boss: { bpm: 156, mel: 'D5:1 C#5:1 D5:1 F5:1 A5:2 G5:1 F5:1 E5:1 D5:1 E5:1 F5:1 G5:2 A5:2 Bb5:1 A5:1 G5:1 F5:1 E5:2 C#5:2 D5:4', bass: 'D2:1 D3:1 D2:1 D3:1 Bb1:1 Bb2:1 Bb1:1 Bb2:1 C2:1 C3:1 C2:1 C3:1 A1:1 A2:1 A1:1 C#3:1' },
  sad: { bpm: 70, mel: 'A4:2 G4:1 F4:1 E4:3 R:1 F4:2 E4:1 D4:1 C#4:4 D4:2 E4:2 F4:2 A4:2 G4:3 F4:1 E4:4', bass: 'D3:4 A2:4 Bb2:4 A2:4 D3:4 Bb2:4 G2:4 A2:4' },
  victory: { bpm: 140, mel: 'C5:1 C5:1 C5:1 C5:3 Ab4:3 Bb4:3 C5:2 Bb4:1 C5:6', bass: 'C3:3 Ab2:3 Bb2:3 C3:6', once: true },
};
export function music(name) {
  if (current === name) return; current = name; clearTimeout(timer);
  if (!ctx || !THEMES[name]) return;
  const th = THEMES[name], beat = 60 / th.bpm, parse = (s) => s.split(' ').map((x) => { const [n, b] = x.split(':'); return [midi(n), +b]; });
  const mel = parse(th.mel), bass = parse(th.bass), len = mel.reduce((s, [, b]) => s + b, 0);
  const loop = () => {
    if (current !== name || !ctx) return;
    let t = ctx.currentTime + 0.05;
    for (const [n, b] of mel) { if (n != null) tone(N(n), t, b * beat * 0.9, 'square', 0.12, musicGain); t += b * beat; }
    let tb = ctx.currentTime + 0.05; const blen = bass.reduce((s, [, b]) => s + b, 0);
    for (let rep = 0; rep < Math.max(1, Math.round(len / blen)); rep++) for (const [n, b] of bass) { if (n != null) tone(N(n), tb, b * beat * 0.95, 'triangle', 0.22, musicGain); tb += b * beat; }
    if (!th.once) timer = setTimeout(loop, len * beat * 1000 - 30);
  };
  loop();
}
export function sfx(name) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const S = {
    hit: () => { tone(220, t, 0.08, 'square', 0.25); tone(110, t + 0.02, 0.1, 'sawtooth', 0.2); },
    hurt: () => { tone(160, t, 0.12, 'sawtooth', 0.22); tone(90, t + 0.05, 0.15, 'square', 0.18); },
    magic: () => { for (let i = 0; i < 5; i++) tone(600 + i * 180, t + i * 0.04, 0.18, 'triangle', 0.14); },
    skill: () => { tone(440, t, 0.06, 'square', 0.2); tone(660, t + 0.06, 0.1, 'square', 0.18); },
    die: () => { for (let i = 0; i < 4; i++) tone(300 - i * 60, t + i * 0.08, 0.14, 'square', 0.18); },
    treasure: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.08, 0.2, 'square', 0.16)); },
    levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'triangle', 0.2)); },
    turn: () => tone(880, t, 0.06, 'triangle', 0.12),
    ok: () => tone(1046, t, 0.05, 'square', 0.1),
    jump: () => { for (let i = 0; i < 6; i++) tone(300 + i * 90, t + i * 0.025, 0.06, 'square', 0.12); },
    win: () => music('victory'),
    lose: () => { [392, 370, 349, 330].forEach((f, i) => tone(f, t + i * 0.25, 0.3, 'triangle', 0.2)); },
  };
  (S[name] || S.ok)();
}
