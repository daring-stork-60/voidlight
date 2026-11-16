// Keyboard + mouse + touch input. Produces one plain input object per frame.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    left: false, right: false, up: false, down: false,
    firing: false, aimX: null, aimY: null,
    pressed: [], // one-frame key presses: 'enter','r','p','e','m','space'
    touch: null, // {x,y} while a touch drag is active
  };

  function updateFromKeys() {
    input.left = keys.has('ArrowLeft') || keys.has('KeyA');
    input.right = keys.has('ArrowRight') || keys.has('KeyD');
    input.up = keys.has('ArrowUp') || keys.has('KeyW');
    input.down = keys.has('ArrowDown') || keys.has('KeyS');
    input.firing = keys.has('Space') || mouseDown;
  }

  let mouseDown = false;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Enter') input.pressed.push('enter');
      if (e.code === 'KeyR') input.pressed.push('r');
      if (e.code === 'KeyP' || e.code === 'Escape') input.pressed.push('p');
      if (e.code === 'KeyE') input.pressed.push('e');
      if (e.code === 'KeyM') input.pressed.push('m');
      if (e.code === 'Space') input.pressed.push('space');
    }
    keys.add(e.code);
    updateFromKeys();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    updateFromKeys();
  });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; updateFromKeys(); });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.aimX = e.clientX - r.left;
    input.aimY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; input.pressed.push('click'); updateFromKeys(); }
    if (e.button === 2) input.pressed.push('e'); // right click = nova
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { mouseDown = false; updateFromKeys(); }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch: drag to move, auto-fire at the nearest enemy.
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    input.touch = { x: t.clientX - r.left, y: t.clientY - r.top };
    input.pressed.push('click');
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    input.touch = { x: t.clientX - r.left, y: t.clientY - r.top };
  }, { passive: false });
  canvas.addEventListener('touchend', () => { input.touch = null; });

  // Touch steering: the ship chases the finger; aim follows movement.
  input.applyTouch = function (g) {
    if (!input.touch) return;
    const p = g.player;
    const dx = input.touch.x - p.x, dy = input.touch.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      p.vx += (dx / d) * 1400 * (1 / 60);
      p.vy += (dy / d) * 1400 * (1 / 60);
    }
    input.firing = true;
    if (g.enemies.length > 0) {
      let bestE = null, bestD = Infinity;
      for (const e of g.enemies) {
        const dd = Math.hypot(e.x - p.x, e.y - p.y);
        if (dd < bestD) { bestD = dd; bestE = e; }
      }
      if (bestE) { input.aimX = bestE.x; input.aimY = bestE.y; }
    }
  };

  input.endFrame = function () { input.pressed.length = 0; };

  return input;
}
