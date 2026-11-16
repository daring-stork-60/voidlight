// Deterministic screenshot scenes (?shot=start|play|elite|end&seed=N) and the autoplay
// bot used for action screenshots. The scenes are built from the same seeded RNG as
// the game, so a screenshot with a given seed always shows the same moment.
import { startGame, nextWave } from './game.js';

export function applyShot(g, input, shot, seed) {
  if (shot === 'start') {
    g.state = 'title';
    return;
  }
  if (shot === 'end') {
    startGame(g);
    g.score = 12840;
    g.wave = 7;
    g.kills = 143;
    g.lives = 0;
    g.state = 'gameover';
    return;
  }
  // play / elite: a live game, mid-action.
  startGame(g);
  if (shot === 'elite') {
    // Jump to wave 5 so the Warden is on screen.
    g.wave = 4;
    nextWave(g);
    g.score = 8450;
    g.energy = 100;
  } else {
    g.wave = 2;
    nextWave(g);
    g.score = 3200;
    g.energy = 62;
  }
  // Pre-populate the arena so the very first frame already shows a fight.
  for (let i = 0; i < 9; i++) {
    g.spawnQueue.shift();
  }
  // Force-spawn a lively mix right now (bypass the trickle timer).
  const types = shot === 'elite'
    ? ['warden', 'drifter', 'drifter', 'spitter', 'orbiter', 'splitter', 'drifter', 'spitter']
    : ['drifter', 'drifter', 'spitter', 'splitter', 'orbiter', 'drifter', 'spitter', 'drifter'];
  const cx = g.w / 2, cy = g.h / 2;
  types.forEach((type, i) => {
    const a = (i / types.length) * Math.PI * 2;
    const r = 160 + (i % 3) * 90;
    const t = { drifter: 1, spitter: 2, splitter: 2, orbiter: 2, warden: 26 }[type];
    const rad = { drifter: 16, spitter: 18, splitter: 20, orbiter: 15, warden: 44 }[type];
    g.enemies.push({
      type, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0,
      hp: t, maxHp: t, radius: rad, angle: a, spin: 1,
      fireTimer: 1, dashTimer: 3, orbitDir: 1, flash: 0, born: 0,
    });
  });
  // Some cores, bullets and a power-up already in flight.
  for (let i = 0; i < 6; i++) {
    g.cores.push({ x: cx + (i - 3) * 40, y: cy - 90, vx: 0, vy: 0, value: 25, life: 9 });
  }
  g.powerups.push({ x: cx + 130, y: cy + 70, kind: 'spread', life: 10, bob: 0 });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.2;
    g.bullets.push({ x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 30, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, radius: 4, life: 1 });
  }
  g.combo = 4;
  g.comboTimer = 2.5;
  input.autoplay = true;
}

// A simple bot: drift toward the arena centre, shoot at the nearest enemy,
// collect nearby cores, fire the nova when charged and crowded.
export function autoplay(g, input, dt) {
  const p = g.player;
  if (!p || g.enemies.length === 0) {
    input.firing = true;
    input.aimX = g.w / 2; input.aimY = g.h / 2 - 120;
    return;
  }
  let target = null, bestD = Infinity;
  for (const e of g.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; target = e; }
  }
  // Keep some distance: back away when too close, strafe otherwise.
  const dx = p.x - target.x, dy = p.y - target.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = 220;
  let mx = (dx / d) * (d < want - 40 ? 1 : d > want + 60 ? -1 : 0.4);
  let my = (dy / d) * (d < want - 40 ? 1 : d > want + 60 ? -1 : 0.4) + 0.5;
  // Center bias: never hug the edges, so the ship stays on screen.
  const margin = 150;
  if (p.x < margin) mx += 1.2;
  if (p.x > g.w - margin) mx -= 1.2;
  if (p.y < margin) my += 1.2;
  if (p.y > g.h - margin) my -= 1.2;
  p.vx += mx * 900 * dt;
  p.vy += my * 900 * dt;
  input.aimX = target.x;
  input.aimY = target.y;
  input.firing = true;
  if (g.energy >= 100 && g.enemies.length >= 5) input.pressed.push('e');
}
