// VOIDLIGHT — all canvas drawing. Neon vector art, drawn fresh every frame.
import { ENEMY_TYPES, POWERUPS, TAU } from './game.js';

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function poly(ctx, x, y, radius, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBackground(ctx, g) {
  const grad = ctx.createLinearGradient(0, 0, 0, g.h);
  grad.addColorStop(0, '#070b1e');
  grad.addColorStop(0.55, '#0d1030');
  grad.addColorStop(1, '#160a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g.w, g.h);
  // Nebula blobs (fixed positions, slow drift with time).
  const blobs = [
    { x: g.w * 0.22, y: g.h * 0.28, r: 260, c: 'rgba(90,40,160,0.20)' },
    { x: g.w * 0.78, y: g.h * 0.62, r: 300, c: 'rgba(20,110,140,0.16)' },
    { x: g.w * 0.55, y: g.h * 0.12, r: 200, c: 'rgba(200,60,140,0.10)' },
  ];
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  // Parallax starfield.
  for (let layer = 0; layer < g.stars.length; layer++) {
    const speed = 6 + layer * 10;
    const off = (g.time * speed) % g.h;
    ctx.fillStyle = layer === 2 ? '#cfe6ff' : '#8fa8cc';
    for (const s of g.stars[layer]) {
      const tw = 0.55 + 0.45 * Math.sin(g.time * 2 + s.tw);
      ctx.globalAlpha = tw * (0.35 + layer * 0.25);
      const y = (s.y + off) % g.h;
      ctx.fillRect(s.x, y, s.r, s.r);
    }
  }
  ctx.globalAlpha = 1;
  // Arena border.
  ctx.strokeStyle = 'rgba(90,220,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, g.w - 12, g.h - 12);
}

function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.invuln > 0 && Math.floor(g.time * 14) % 2 === 0) return; // blink while invulnerable
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  glow(ctx, '#4dd8ff', 18);
  ctx.fillStyle = '#bff3ff';
  ctx.beginPath();
  ctx.moveTo(20, 0); ctx.lineTo(-12, -11); ctx.lineTo(-6, 0); ctx.lineTo(-12, 11);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b2a3a';
  ctx.beginPath(); ctx.arc(2, 0, 4.5, 0, TAU); ctx.fill();
  // Engine flame.
  if (p.thrust) {
    ctx.fillStyle = '#ff9a3d';
    glow(ctx, '#ff9a3d', 12);
    ctx.beginPath();
    ctx.moveTo(-12, -5); ctx.lineTo(-12 - 10 - Math.random() * 8, 0); ctx.lineTo(-12, 5);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Shield ring.
  if (g.powerTimers.shield > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125,255,206,0.8)';
    ctx.lineWidth = 2;
    glow(ctx, '#7dffce', 14);
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(g.time * 5) * 2, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, g, e) {
  const t = ENEMY_TYPES[e.type];
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  const color = flash ? '#ffffff' : t.color;
  glow(ctx, t.color, 14);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (e.type === 'drifter') {
    ctx.rotate(g.time * 1.5 + e.angle);
    poly(ctx, 0, 0, e.radius, 4, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0b22';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  } else if (e.type === 'spitter') {
    ctx.rotate(Math.sin(g.time + e.angle) * 0.3);
    poly(ctx, 0, 0, e.radius, 6, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a1503';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
  } else if (e.type === 'splitter') {
    ctx.rotate(g.time * 0.8);
    ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#0d2b12';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-e.radius * 0.8, 0); ctx.lineTo(e.radius * 0.8, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -e.radius * 0.8); ctx.lineTo(0, e.radius * 0.8); ctx.stroke();
  } else if (e.type === 'orbiter') {
    ctx.rotate(e.angle + Math.PI / 2);
    poly(ctx, 0, 0, e.radius + 4, 3, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1d0b33';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  } else if (e.type === 'warden') {
    ctx.rotate(g.time * 0.5);
    poly(ctx, 0, 0, e.radius, 5, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2b0508';
    poly(ctx, 0, 0, e.radius * 0.55, 5, Math.PI / 5);
    ctx.fill();
    ctx.fillStyle = '#ffd7dc';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    // HP arc.
    ctx.strokeStyle = '#ff3b4e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, e.radius + 10, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp)); ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, g) {
  const pad = 22;
  ctx.textBaseline = 'alphabetic';
  // Score block.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('SCORE', pad, pad + 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, sans-serif';
  glow(ctx, '#4dd8ff', 10);
  ctx.fillText(String(g.score).padStart(6, '0'), pad, pad + 34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('BEST  ' + Math.max(g.best, g.score), pad, pad + 54);
  // Combo.
  if (g.combo > 1) {
    ctx.fillStyle = '#ffe14d';
    ctx.font = '800 18px system-ui, sans-serif';
    glow(ctx, '#ffe14d', 10);
    ctx.fillText('COMBO x' + g.combo, pad, pad + 82);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,225,77,0.5)';
    ctx.fillRect(pad, pad + 90, 120 * (g.comboTimer / 3), 4);
  }
  // Wave (top center).
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('WAVE ' + Math.max(1, g.wave), g.w / 2, pad + 22);
  // Lives (top right, hearts).
  ctx.textAlign = 'right';
  for (let i = 0; i < 3; i++) {
    const x = g.w - pad - i * 30;
    const y = pad + 14;
    ctx.fillStyle = i < g.lives ? '#ff5b7a' : 'rgba(255,255,255,0.18)';
    glow(ctx, i < g.lives ? '#ff5b7a' : 'transparent', i < g.lives ? 10 : 0);
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.bezierCurveTo(x - 11, y - 3, x - 6, y - 12, x, y - 5);
    ctx.bezierCurveTo(x + 6, y - 12, x + 11, y - 3, x, y + 7);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Nova meter.
  const mw = 150, mh = 10, mx = g.w - pad - mw, my = pad + 34;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(mx, my, mw, mh);
  const grad = ctx.createLinearGradient(mx, my, mx + mw, my);
  grad.addColorStop(0, '#4dd8ff'); grad.addColorStop(1, '#ff4fd8');
  ctx.fillStyle = grad;
  ctx.fillRect(mx, my, mw * (g.energy / 100), mh);
  ctx.fillStyle = g.energy >= 100 ? '#ffffff' : 'rgba(255,255,255,0.6)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText(g.energy >= 100 ? 'NOVA READY — press E' : 'NOVA ' + Math.floor(g.energy) + '%', g.w - pad, my + 26);
  // Active power-ups (bottom left).
  ctx.textAlign = 'left';
  let py = g.h - pad - 8;
  for (const k of Object.keys(POWERUPS)) {
    const t = g.powerTimers[k];
    if (t > 0 && k !== 'shield') {
      ctx.fillStyle = POWERUPS[k].color;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(POWERUPS[k].label + '  ' + Math.ceil(t) + 's', pad, py);
      py -= 20;
    }
  }
  if (g.powerTimers.shield > 0) {
    ctx.fillStyle = POWERUPS.shield.color;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('SHIELD ACTIVE', pad, py);
  }
  // Mute hint.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · mouse aim · click fire · E nova · P pause · M mute', g.w - pad, g.h - pad - 8);
}

function centerText(ctx, g, text, y, font, color, blurColor) {
  ctx.textAlign = 'center';
  ctx.font = font;
  if (blurColor) glow(ctx, blurColor, 22);
  ctx.fillStyle = color;
  ctx.fillText(text, g.w / 2, y);
  ctx.shadowBlur = 0;
}

export function render(ctx, g) {
  const shakeX = g.shake ? (Math.random() - 0.5) * g.shake : 0;
  const shakeY = g.shake ? (Math.random() - 0.5) * g.shake : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground(ctx, g);

  if (g.state === 'title') {
    centerText(ctx, g, 'VOIDLIGHT', g.h * 0.32, '900 84px system-ui, sans-serif', '#eafcff', '#4dd8ff');
    centerText(ctx, g, 'Harvest the cores. Survive the void.', g.h * 0.32 + 44, '600 20px system-ui, sans-serif', 'rgba(255,255,255,0.75)', null);
    centerText(ctx, g, 'WASD / arrows — move      Mouse — aim      Click / Space — fire      E — nova bomb', g.h * 0.52, '600 16px system-ui, sans-serif', 'rgba(255,255,255,0.85)', null);
    centerText(ctx, g, 'Collect cores to charge your nova. Chain kills for combo. Survive every wave.', g.h * 0.52 + 28, '600 15px system-ui, sans-serif', 'rgba(255,255,255,0.6)', null);
    const pulse = 0.6 + 0.4 * Math.sin(g.time * 4);
    ctx.globalAlpha = pulse;
    centerText(ctx, g, g.best > 0 ? 'BEST SCORE  ' + g.best + '   ·   CLICK OR PRESS ENTER TO START' : 'CLICK OR PRESS ENTER TO START', g.h * 0.68, '800 20px system-ui, sans-serif', '#ffe14d', '#ffe14d');
    ctx.globalAlpha = 1;
    // A few decorative drifters.
    ctx.restore();
    return;
  }

  // Cores.
  for (const c of g.cores) {
    ctx.save();
    ctx.translate(c.x, c.y);
    const tw = 0.7 + 0.3 * Math.sin(g.time * 6 + c.x);
    ctx.globalAlpha = Math.min(1, c.life) * tw;
    glow(ctx, '#ffe14d', 12);
    ctx.fillStyle = '#ffe14d';
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // Power-ups.
  for (const pu of g.powerups) {
    const def = POWERUPS[pu.kind];
    ctx.save();
    ctx.translate(pu.x, pu.y + Math.sin(pu.bob) * 4);
    glow(ctx, def.color, 16);
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#081018';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pu.kind[0].toUpperCase(), 0, 1);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  // Enemy bullets.
  for (const b of g.enemyBullets) {
    ctx.save();
    glow(ctx, '#ff9a3d', 12);
    ctx.fillStyle = '#ffb35c';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // Enemies.
  for (const e of g.enemies) drawEnemy(ctx, g, e);
  // Player bullets.
  for (const b of g.bullets) {
    ctx.save();
    glow(ctx, '#4dd8ff', 10);
    ctx.strokeStyle = '#bff3ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  // Player.
  if (g.state !== 'gameover') drawPlayer(ctx, g);
  // Particles.
  for (const pt of g.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Nova shockwave.
  if (g.novaActive > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,240,255,0.9)';
    ctx.lineWidth = 6;
    glow(ctx, '#4dd8ff', 30);
    ctx.beginPath(); ctx.arc(g.player.x, g.player.y, g.novaActive, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // Score popups.
  ctx.textAlign = 'center';
  for (const pp of g.popups) {
    ctx.globalAlpha = Math.max(0, pp.life);
    ctx.fillStyle = pp.color;
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText(pp.text, pp.x, pp.y);
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, g);

  // Wave banner.
  if (g.bannerTimer > 0) {
    const a = Math.min(1, g.bannerTimer);
    ctx.globalAlpha = a;
    centerText(ctx, g, g.banner, g.h * 0.4, '900 54px system-ui, sans-serif', '#ffffff', '#ff4fd8');
    ctx.globalAlpha = 1;
  }
  // Intermission hint.
  if (g.state === 'playing' && g.enemies.length === 0 && g.spawnQueue.length === 0 && g.intermission > 0) {
    centerText(ctx, g, 'Next wave incoming…', g.h * 0.4 + 60, '600 18px system-ui, sans-serif', 'rgba(255,255,255,0.7)', null);
  }

  if (g.state === 'paused') {
    ctx.fillStyle = 'rgba(4,6,18,0.6)';
    ctx.fillRect(0, 0, g.w, g.h);
    centerText(ctx, g, 'PAUSED', g.h * 0.42, '900 64px system-ui, sans-serif', '#ffffff', '#4dd8ff');
    centerText(ctx, g, 'Press P or click to resume', g.h * 0.42 + 40, '600 18px system-ui, sans-serif', 'rgba(255,255,255,0.8)', null);
  }

  if (g.state === 'gameover') {
    ctx.fillStyle = 'rgba(10,4,12,0.55)';
    ctx.fillRect(0, 0, g.w, g.h);
    centerText(ctx, g, 'GAME OVER', g.h * 0.34, '900 72px system-ui, sans-serif', '#ff5b7a', '#ff3b4e');
    centerText(ctx, g, 'SCORE  ' + g.score, g.h * 0.34 + 52, '800 30px system-ui, sans-serif', '#ffffff', null);
    const best = Math.max(g.best, g.score);
    centerText(ctx, g, 'BEST  ' + best + '    ·    WAVES SURVIVED  ' + Math.max(0, g.wave - 1) + '    ·    KILLS  ' + g.kills, g.h * 0.34 + 92, '600 17px system-ui, sans-serif', 'rgba(255,255,255,0.8)', null);
    const pulse = 0.6 + 0.4 * Math.sin(g.time * 4);
    ctx.globalAlpha = pulse;
    centerText(ctx, g, 'PRESS R OR CLICK TO PLAY AGAIN', g.h * 0.62, '800 20px system-ui, sans-serif', '#ffe14d', '#ffe14d');
    ctx.globalAlpha = 1;
  }

  // Damage flash.
  if (g.flash > 0) {
    ctx.fillStyle = 'rgba(255,40,70,' + (g.flash * 0.35) + ')';
    ctx.fillRect(0, 0, g.w, g.h);
  }
  ctx.restore();
}
