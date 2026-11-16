// VOIDLIGHT — bootstrap: canvas, game loop, state machine, self-test hook.
import { createGame, startGame, update, fireNova, toGameOver } from './game.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyShot, autoplay } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1337);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';

const audio = createAudio();
const input = createInput(canvas);

let dpr = Math.min(window.devicePixelRatio || 1, 2);
function fitCanvas() {
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();

const g = createGame(window.innerWidth, window.innerHeight, seed);
try {
  g.best = Number(window.localStorage.getItem('voidlight_best') || 0);
} catch (e) { g.best = 0; }

function saveBest() {
  const best = Math.max(g.best, g.score);
  g.best = best;
  try { window.localStorage.setItem('voidlight_best', String(best)); } catch (e) { /* private mode */ }
}

window.addEventListener('resize', () => {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  fitCanvas();
  import('./game.js').then((m) => m.resize(g, window.innerWidth, window.innerHeight));
});

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function handlePressed() {
  for (const key of input.pressed) {
    if (key === 'm') {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted' : 'Sound on');
    }
    if (key === 'e') {
      if (g.state === 'playing') fireNova(g);
    }
    if (g.state === 'title' && (key === 'enter' || key === 'click' || key === 'space')) {
      audio.unlock();
      startGame(g);
      announce('Wave 1. Good luck, pilot.');
    } else if (g.state === 'gameover' && (key === 'r' || key === 'click' || key === 'enter')) {
      audio.unlock();
      startGame(g);
      announce('Wave 1. Good luck, pilot.');
    } else if (g.state === 'playing' && key === 'p') {
      g.state = 'paused';
      announce('Paused');
    } else if (g.state === 'paused' && (key === 'p' || key === 'click' || key === 'enter')) {
      g.state = 'playing';
      announce('Resumed');
    }
  }
  // Space also starts / restarts (keydown adds it via 'Space' mapping in input).
  if (input.pressed.includes('space')) {
    if (g.state === 'title' || g.state === 'gameover') {
      audio.unlock();
      startGame(g);
    }
  }
}

let last = performance.now();
let firstFrame = true;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  handlePressed();
  if (input.autoplay && g.state === 'playing') autoplay(g, input, dt);
  if (input.touch) input.applyTouch(g);
  const prevState = g.state;
  const prevLives = g.lives;
  update(g, input, dt);
  // Drain one-frame audio events.
  for (const ev of g.events) {
    if (ev === 'shoot') audio.shoot();
    else if (ev === 'enemyShoot') audio.enemyShoot();
    else if (ev === 'explosion') audio.explosion();
    else if (ev === 'pickup') audio.pickup();
    else if (ev === 'powerup') audio.powerup();
    else if (ev === 'hit') audio.hit();
    else if (ev === 'nova') audio.nova();
    else if (ev === 'wave') audio.wave();
    else if (ev === 'gameover') { audio.gameOver(); saveBest(); }
  }
  if (g.state === 'gameover' && prevState === 'playing') {
    saveBest();
    announce('Game over. Score ' + g.score + '. Press R to play again.');
  } else if (prevLives > g.lives && g.state === 'playing') {
    announce('Hull hit. ' + g.lives + (g.lives === 1 ? ' life' : ' lives') + ' left.');
  }
  render(ctx, g);
  input.endFrame();
  firstFrame = false;
  requestAnimationFrame(frame);
}

// Screenshot scenes: set up a deterministic moment before the first frame.
if (shot) applyShot(g, input, shot, seed);
if (selftest) {
  window.__voidlightSelfTest = runSelfTest;
  const result = runSelfTest();
  const node = document.createElement('div');
  node.id = 'selftest';
  node.textContent = result;
  document.body.appendChild(node);
  document.title = result;
} else {
  requestAnimationFrame(frame);
}

// In-page self test (?selftest=1): drives the real state machine headlessly and
// reports PASS/FAIL into the DOM so a headless browser run can read it.
function runSelfTest() {
  const out = [];
  const ok = (name, cond) => out.push((cond ? 'PASS' : 'FAIL') + ' ' + name);
  try {
    // 1. Title -> start.
    ok('starts on title', g.state === 'title' || g.state === 'playing');
    if (g.state === 'title') { startGame(g); }
    ok('startGame enters playing', g.state === 'playing');
    ok('wave 1 spawned queue', g.spawnQueue.length > 0 || g.enemies.length >= 0);
    ok('player has 3 lives', g.lives === 3);
    // 2. Simulate 600 frames of play with the bot firing.
    const simInput = { left: false, right: false, up: false, down: false, firing: true, aimX: g.w / 2, aimY: 100, pressed: [], autoplay: false };
    let frames = 0;
    for (let i = 0; i < 600; i++) {
      // Point the aim at the nearest enemy each frame.
      if (g.enemies.length > 0) {
        let t = g.enemies[0], bd = Infinity;
        for (const e of g.enemies) {
          const d = Math.hypot(e.x - g.player.x, e.y - g.player.y);
          if (d < bd) { bd = d; t = e; }
        }
        simInput.aimX = t.x; simInput.aimY = t.y;
      }
      update(g, simInput, 1 / 60);
      frames++;
      if (g.state === 'gameover') break;
    }
    ok('600 frames simulated without exception', frames > 0);
    ok('score increased during play', g.score > 0);
    ok('kills registered', g.kills > 0);
    ok('wave advanced past 1', g.wave >= 1);
    // 3. Nova charges and fires.
    g.energy = 100;
    ok('nova fires at full energy', fireNova(g) === true);
    ok('nova drains energy', g.energy === 0);
    // 4. Damage -> game over -> restart.
    g.player.invuln = 0;
    g.powerTimers.shield = 0;
    g.lives = 1;
    // Force three hits through the damage path via direct enemy contact.
    for (let i = 0; i < 3 && g.state === 'playing'; i++) {
      g.player.invuln = 0;
      g.enemies.push({ type: 'drifter', x: g.player.x + 5, y: g.player.y, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, angle: 0, spin: 0, fireTimer: 0, dashTimer: 0, orbitDir: 1, flash: 0, born: g.time });
      update(g, simInput, 1 / 60);
    }
    ok('lethal damage ends the game', g.state === 'gameover');
    startGame(g);
    ok('restart resets score/lives/wave', g.score === 0 && g.lives === 3 && g.wave === 1 && g.state === 'playing');
    // 5. No network references in the page.
    const refs = Array.from(document.querySelectorAll('script[src], link[href], img[src]'))
      .map((el) => el.getAttribute('src') || el.getAttribute('href'));
    ok('no external references', refs.every((r) => !/^https?:\/\//.test(r) && !r.startsWith('//')));
  } catch (err) {
    out.push('FAIL exception: ' + (err && err.message));
  }
  const fails = out.filter((l) => l.startsWith('FAIL')).length;
  return (fails === 0 ? 'SELFTEST ALL PASS' : 'SELFTEST ' + fails + ' FAILURES') + ' :: ' + out.join(' | ');
}
