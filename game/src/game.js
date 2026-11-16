// VOIDLIGHT — core game logic (no DOM, no canvas here; rendering lives in render.js).
// A neon arena survival shooter: pilot a lumen-ship, survive the waves, harvest cores.
import { makeRng } from './rng.js';

export const TAU = Math.PI * 2;

export const ENEMY_TYPES = {
  drifter:  { hp: 1, speed: 95,  radius: 16, score: 100, color: '#ff4fd8', core: 1 },
  spitter:  { hp: 2, speed: 60,  radius: 18, score: 150, color: '#ff9a3d', core: 1 },
  splitter: { hp: 2, speed: 75,  radius: 20, score: 200, color: '#59ff7a', core: 2 },
  orbiter:  { hp: 2, speed: 130, radius: 15, score: 200, color: '#b06bff', core: 1 },
  warden:   { hp: 26, speed: 45, radius: 44, score: 1500, color: '#ff3b4e', core: 8 },
};

export const POWERUPS = {
  spread: { color: '#4dd8ff', label: 'SPREAD SHOT', secs: 12 },
  rapid:  { color: '#ffe14d', label: 'RAPID FIRE', secs: 12 },
  shield: { color: '#7dffce', label: 'SHIELD', secs: 0 },
  magnet: { color: '#ff8ad8', label: 'MAGNET', secs: 12 },
};

export function createGame(width, height, seed) {
  const rng = makeRng(seed || 1337);
  const g = {
    w: width, h: height, rng,
    state: 'title', // title | playing | paused | gameover
    time: 0,
    score: 0,
    best: 0,
    wave: 0,
    lives: 3,
    combo: 1,
    comboTimer: 0,
    kills: 0,
    energy: 0, // 0..100, nova at 100
    novaActive: 0, // nova ring radius, 0 = off
    shake: 0,
    flash: 0,
    banner: '',
    bannerTimer: 0,
    intermission: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    cores: [],
    powerups: [],
    particles: [],
    popups: [],
    stars: [],
    powerTimers: { spread: 0, rapid: 0, shield: 0, magnet: 0 },
    stats: { shots: 0, hits: 0, wavesCleared: 0, novaUsed: 0 },
    events: [], // one-frame event flags for audio: 'shoot','explosion','pickup','powerup','hit','nova','wave','gameover'
  };
  initStars(g);
  resetPlayer(g);
  return g;
}

function initStars(g) {
  g.stars = [];
  for (let i = 0; i < 3; i++) {
    const layer = [];
    const n = 40 + i * 30;
    for (let j = 0; j < n; j++) {
      layer.push({ x: g.rng.range(0, g.w), y: g.rng.range(0, g.h), r: 0.5 + i * 0.5, tw: g.rng.range(0, TAU) });
    }
    g.stars.push(layer);
  }
}

export function resize(g, width, height) {
  g.w = width; g.h = height;
  initStars(g);
  if (g.player) {
    g.player.x = Math.min(Math.max(g.player.x, 24), width - 24);
    g.player.y = Math.min(Math.max(g.player.y, 24), height - 24);
  }
}

function resetPlayer(g) {
  g.player = {
    x: g.w / 2, y: g.h / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
    radius: 14, fireTimer: 0, invuln: 0, thrust: 0,
  };
}

export function startGame(g) {
  g.state = 'playing';
  g.time = 0;
  g.score = 0;
  g.wave = 0;
  g.lives = 3;
  g.combo = 1;
  g.comboTimer = 0;
  g.kills = 0;
  g.energy = 0;
  g.novaActive = 0;
  g.bullets = []; g.enemyBullets = []; g.enemies = [];
  g.cores = []; g.powerups = []; g.particles = []; g.popups = [];
  g.powerTimers = { spread: 0, rapid: 0, shield: 0, magnet: 0 };
  g.stats = { shots: 0, hits: 0, wavesCleared: 0, novaUsed: 0 };
  resetPlayer(g);
  nextWave(g);
}

export function nextWave(g) {
  g.wave++;
  g.intermission = 0;
  const n = 6 + g.wave * 2;
  const queue = [];
  for (let i = 0; i < n; i++) {
    let type = 'drifter';
    const roll = g.rng.next();
    if (g.wave >= 5 && i === 0) type = 'warden';
    else if (g.wave >= 3 && roll < 0.16) type = 'orbiter';
    else if (g.wave >= 2 && roll < 0.34) type = 'splitter';
    else if (g.wave >= 2 && roll < 0.55) type = 'spitter';
    queue.push(type);
  }
  g.spawnQueue = queue;
  g.spawnTimer = 0.4;
  g.banner = 'WAVE ' + g.wave;
  g.bannerTimer = 2.2;
  g.events.push('wave');
}

function spawnEnemy(g, type) {
  const t = ENEMY_TYPES[type];
  // Spawn just outside a random edge, away from the player.
  let x, y, tries = 0;
  do {
    const edge = g.rng.int(0, 3);
    if (edge === 0) { x = g.rng.range(0, g.w); y = -30; }
    else if (edge === 1) { x = g.w + 30; y = g.rng.range(0, g.h); }
    else if (edge === 2) { x = g.rng.range(0, g.w); y = g.h + 30; }
    else { x = -30; y = g.rng.range(0, g.h); }
    tries++;
  } while (tries < 8 && Math.hypot(x - g.player.x, y - g.player.y) < 260);
  g.enemies.push({
    type, x, y, vx: 0, vy: 0, hp: t.hp, maxHp: t.hp,
    radius: t.radius, angle: g.rng.angle(), spin: g.rng.range(-1.5, 1.5),
    fireTimer: g.rng.range(1, 2.5), dashTimer: g.rng.range(2, 4), orbitDir: g.rng.chance(0.5) ? 1 : -1,
    flash: 0, born: g.time,
  });
}

function burst(g, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = g.rng.angle();
    const s = g.rng.range(speed * 0.3, speed);
    g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: g.rng.range(0.3, 0.8), maxLife: 0.8, color, radius: g.rng.range(1.5, 3.5) });
  }
  if (g.particles.length > 420) g.particles.splice(0, g.particles.length - 420);
}

function addPopup(g, x, y, text, color) {
  g.popups.push({ x, y, text, color: color || '#ffffff', life: 1 });
}

export function fireNova(g) {
  if (g.state !== 'playing' || g.energy < 100 || g.novaActive > 0) return false;
  g.energy = 0;
  g.novaActive = 1;
  g.stats.novaUsed++;
  g.shake = 14;
  g.flash = 0.5;
  g.events.push('nova');
  return true;
}

function damagePlayer(g) {
  const p = g.player;
  if (p.invuln > 0 || g.state !== 'playing') return;
  if (g.powerTimers.shield > 0) {
    g.powerTimers.shield = 0;
    p.invuln = 1.2;
    addPopup(g, p.x, p.y - 30, 'SHIELD SAVED YOU', '#7dffce');
    burst(g, p.x, p.y, '#7dffce', 24, 220);
    return;
  }
  g.lives--;
  g.combo = 1;
  g.comboTimer = 0;
  g.shake = 16;
  g.flash = 0.7;
  g.events.push('hit');
  burst(g, p.x, p.y, '#ff3b4e', 30, 260);
  if (g.lives <= 0) {
    g.state = 'gameover';
    g.events.push('gameover');
    burst(g, p.x, p.y, '#4dd8ff', 80, 380);
    burst(g, p.x, p.y, '#ff4fd8', 60, 300);
  } else {
    p.invuln = 2;
  }
}

function killEnemy(g, e, index) {
  const t = ENEMY_TYPES[e.type];
  g.kills++;
  g.stats.hits++;
  const gained = t.score * g.combo;
  g.score += gained;
  addPopup(g, e.x, e.y, '+' + gained, t.color);
  burst(g, e.x, e.y, t.color, e.type === 'warden' ? 70 : 22, 260);
  g.events.push('explosion');
  // Combo grows, capped at x8; the window refreshes on every kill.
  g.combo = Math.min(8, g.combo + 1);
  g.comboTimer = 3;
  // Drop cores.
  for (let i = 0; i < t.core; i++) {
    g.cores.push({ x: e.x + g.rng.range(-14, 14), y: e.y + g.rng.range(-14, 14), vx: g.rng.range(-40, 40), vy: g.rng.range(-40, 40), value: 25, life: 9 });
  }
  // Power-up drop chance (not from wardens — they drop a shower of cores instead).
  if (e.type !== 'warden' && g.rng.chance(0.09)) {
    const kind = g.rng.pick(['spread', 'rapid', 'shield', 'magnet']);
    g.powerups.push({ x: e.x, y: e.y, kind, life: 10, bob: g.rng.angle() });
  }
  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      g.enemies.push({ type: 'drifter', x: e.x + (i ? 18 : -18), y: e.y, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, angle: g.rng.angle(), spin: 1, fireTimer: 0, dashTimer: 0, orbitDir: 1, flash: 0, born: g.time });
    }
  }
  g.enemies.splice(index, 1);
}

function updatePlayer(g, input, dt) {
  const p = g.player;
  const accel = 1400;
  let ax = 0, ay = 0;
  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.up) ay -= 1;
  if (input.down) ay += 1;
  if (ax || ay) {
    const len = Math.hypot(ax, ay);
    p.vx += (ax / len) * accel * dt;
    p.vy += (ay / len) * accel * dt;
    p.thrust = 1;
  } else {
    p.thrust = 0;
  }
  // Drag + speed cap.
  p.vx *= Math.pow(0.12, dt);
  p.vy *= Math.pow(0.12, dt);
  const sp = Math.hypot(p.vx, p.vy);
  const max = 340;
  if (sp > max) { p.vx = (p.vx / sp) * max; p.vy = (p.vy / sp) * max; }
  p.x = Math.min(Math.max(p.x + p.vx * dt, 20), g.w - 20);
  p.y = Math.min(Math.max(p.y + p.vy * dt, 20), g.h - 20);
  // Aim at the mouse; keyboard-only players aim along movement.
  if (input.aimX !== null && input.aimY !== null) {
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  } else if (sp > 30) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  p.invuln = Math.max(0, p.invuln - dt);
  // Fire.
  p.fireTimer -= dt;
  const interval = g.powerTimers.rapid > 0 ? 0.09 : 0.16;
  if (input.firing && p.fireTimer <= 0) {
    p.fireTimer = interval;
    const spread = g.powerTimers.spread > 0;
    const angles = spread ? [-0.22, 0, 0.22] : [0];
    for (const off of angles) {
      const a = p.angle + off;
      g.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 620 + p.vx * 0.4, vy: Math.sin(a) * 620 + p.vy * 0.4, radius: 4, life: 1.1 });
    }
    g.stats.shots++;
    g.events.push('shoot');
    p.vx -= Math.cos(p.angle) * 12;
    p.vy -= Math.sin(p.angle) * 12;
  }
}

function updateEnemies(g, dt) {
  const p = g.player;
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    const t = ENEMY_TYPES[e.type];
    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    e.flash = Math.max(0, e.flash - dt);
    if (e.type === 'drifter' || e.type === 'warden') {
      e.vx += nx * t.speed * 2.4 * dt;
      e.vy += ny * t.speed * 2.4 * dt;
    } else if (e.type === 'spitter') {
      // Keep a mid range and strafe.
      const want = 260;
      const radial = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
      e.vx += (nx * radial * t.speed * 2 + -ny * 40) * dt;
      e.vy += (ny * radial * t.speed * 2 + nx * 40) * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && dist < 560) {
        e.fireTimer = g.rng.range(1.6, 2.4);
        g.enemyBullets.push({ x: e.x, y: e.y, vx: nx * 190, vy: ny * 190, radius: 7, life: 4 });
        g.events.push('enemyShoot');
      }
    } else if (e.type === 'orbiter') {
      e.angle += e.orbitDir * 1.6 * dt;
      const ox = p.x + Math.cos(e.angle) * 170, oy = p.y + Math.sin(e.angle) * 170;
      e.vx += ((ox - e.x) * 3 - e.vx) * Math.min(1, 3 * dt);
      e.vy += ((oy - e.y) * 3 - e.vy) * Math.min(1, 3 * dt);
      e.dashTimer -= dt;
      if (e.dashTimer <= 0 && dist < 320) {
        e.dashTimer = g.rng.range(2.5, 4);
        e.vx = nx * 420; e.vy = ny * 420;
      }
    } else if (e.type === 'splitter') {
      e.vx += nx * t.speed * 2.2 * dt;
      e.vy += ny * t.speed * 2.2 * dt;
    }
    // Speed cap + wobble.
    const sp = Math.hypot(e.vx, e.vy);
    const cap = t.speed * (e.type === 'orbiter' ? 3.2 : 1.6);
    if (sp > cap) { e.vx = (e.vx / sp) * cap; e.vy = (e.vy / sp) * cap; }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = Math.min(Math.max(e.x, -40), g.w + 40);
    e.y = Math.min(Math.max(e.y, -40), g.h + 40);
    // Touching the player hurts.
    if (dist < e.radius + p.radius - 2) {
      damagePlayer(g);
      // Push the enemy back so one touch is not a double hit.
      e.x -= nx * 30; e.y -= ny * 30;
      e.vx = -nx * 160; e.vy = -ny * 160;
    }
  }
}

function updateBullets(g, dt) {
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > g.w + 20 || b.y < -20 || b.y > g.h + 20) { g.bullets.splice(i, 1); continue; }
    for (let j = g.enemies.length - 1; j >= 0; j--) {
      const e = g.enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        e.hp--;
        e.flash = 0.12;
        burst(g, b.x, b.y, '#bfe9ff', 4, 120);
        g.bullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(g, e, j);
        break;
      }
    }
  }
  for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
    const b = g.enemyBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > g.w + 20 || b.y < -20 || b.y > g.h + 20) { g.enemyBullets.splice(i, 1); continue; }
    const p = g.player;
    if (Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius - 2) {
      g.enemyBullets.splice(i, 1);
      damagePlayer(g);
    }
  }
}

function updatePickups(g, dt) {
  const p = g.player;
  const magnet = g.powerTimers.magnet > 0;
  for (let i = g.cores.length - 1; i >= 0; i--) {
    const c = g.cores[i];
    c.life -= dt;
    const dx = p.x - c.x, dy = p.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (magnet && dist < 260) { c.vx += (dx / dist) * 900 * dt; c.vy += (dy / dist) * 900 * dt; }
    else { c.vx *= Math.pow(0.2, dt); c.vy *= Math.pow(0.2, dt); }
    c.x += c.vx * dt; c.y += c.vy * dt;
    if (dist < p.radius + 12) {
      g.cores.splice(i, 1);
      g.score += c.value * g.combo;
      g.energy = Math.min(100, g.energy + 7);
      g.events.push('pickup');
      burst(g, c.x, c.y, '#ffe14d', 6, 140);
    } else if (c.life <= 0) {
      g.cores.splice(i, 1);
    }
  }
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const pu = g.powerups[i];
    pu.life -= dt;
    pu.bob += dt * 3;
    const dist = Math.hypot(p.x - pu.x, p.y - pu.y);
    if (dist < p.radius + 18) {
      g.powerups.splice(i, 1);
      const def = POWERUPS[pu.kind];
      if (pu.kind === 'shield') g.powerTimers.shield = 999;
      else g.powerTimers[pu.kind] = def.secs;
      addPopup(g, p.x, p.y - 34, def.label, def.color);
      g.events.push('powerup');
      burst(g, pu.x, pu.y, def.color, 20, 200);
    } else if (pu.life <= 0) {
      g.powerups.splice(i, 1);
    }
  }
}

function updateParticles(g, dt) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const pt = g.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.3, dt); pt.vy *= Math.pow(0.3, dt);
    pt.life -= dt;
    if (pt.life <= 0) g.particles.splice(i, 1);
  }
  for (let i = g.popups.length - 1; i >= 0; i--) {
    const pp = g.popups[i];
    pp.y -= 34 * dt; pp.life -= dt * 0.9;
    if (pp.life <= 0) g.popups.splice(i, 1);
  }
  // Nova shockwave.
  if (g.novaActive > 0) {
    g.novaActive += 900 * dt;
    const R = g.novaActive;
    for (let j = g.enemies.length - 1; j >= 0; j--) {
      const e = g.enemies[j];
      if (Math.abs(Math.hypot(e.x - g.player.x, e.y - g.player.y) - R) < 46) {
        e.hp -= 6;
        e.flash = 0.15;
        if (e.hp <= 0) killEnemy(g, e, j);
      }
    }
    g.enemyBullets.length = 0;
    if (R > Math.max(g.w, g.h)) g.novaActive = 0;
  }
}

export function update(g, input, dt) {
  dt = Math.min(dt, 0.05);
  g.events = [];
  g.time += dt;
  g.shake = Math.max(0, g.shake - 40 * dt);
  g.flash = Math.max(0, g.flash - 1.6 * dt);
  g.bannerTimer = Math.max(0, g.bannerTimer - dt);
  if (g.state !== 'playing') {
    updateParticles(g, dt);
    return;
  }
  // Power-up timers.
  for (const k of Object.keys(g.powerTimers)) {
    if (k === 'shield') continue;
    g.powerTimers[k] = Math.max(0, g.powerTimers[k] - dt);
  }
  // Combo decay.
  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 1;
  }
  // Spawning.
  if (g.spawnQueue.length > 0) {
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      g.spawnTimer = Math.max(0.25, 0.9 - g.wave * 0.05);
      spawnEnemy(g, g.spawnQueue.shift());
    }
  } else if (g.enemies.length === 0) {
    // Wave cleared.
    if (g.intermission === 0) {
      const bonus = 250 * g.wave;
      g.score += bonus;
      addPopup(g, g.w / 2, g.h / 2 - 60, 'WAVE ' + g.wave + ' CLEAR  +' + bonus, '#ffe14d');
      g.stats.wavesCleared++;
      // Core shower as a breather reward.
      for (let i = 0; i < 6; i++) {
        g.cores.push({ x: g.w / 2 + g.rng.range(-120, 120), y: g.h / 2 + g.rng.range(-80, 80), vx: g.rng.range(-30, 30), vy: g.rng.range(-30, 30), value: 25, life: 8 });
      }
    }
    g.intermission += dt;
    if (g.intermission > 2.5) nextWave(g);
  }
  updatePlayer(g, input, dt);
  updateEnemies(g, dt);
  updateBullets(g, dt);
  updatePickups(g, dt);
  updateParticles(g, dt);
}

export function toGameOver(g) {
  if (g.state === 'playing') {
    g.lives = 0;
    g.state = 'gameover';
    g.events.push('gameover');
  }
}
