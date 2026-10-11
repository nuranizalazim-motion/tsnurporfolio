/*
  Miss Nur — cursor-driven gaze hero
  ----------------------------------
  The sprite sheet is one horizontal strip of 48 frames pulled from the
  classroom clip with FFmpeg:
    index 0  .. 23  → source frames 48 → 25  (full look left → front, smiling)
    index 24 .. 47  → source frames 129 → 152 (front → full look right)
  So the strip is a single, monotonic left-to-right head turn. The cursor's
  horizontal position maps to an index on that strip; a critically damped
  spring chases it, and adjacent frames are cross-faded so the motion reads
  smoother than 48 discrete steps.

  The animator put blinks on the head turns (indices 15–20 and 27–31).
  They look natural in motion, but a held blink looks broken, so when the
  pointer comes to rest the target settles onto the nearest open-eyed frame.
*/
(() => {
  const FRAMES = 48;
  const IDLE = 23;                       // front-facing, smiling
  const BLINKS = [[15, 20], [27, 31]];   // closed or closing eyes
  const FOCUS_X = 0.497;                 // character's centre line in the source frame
  const TRACK_TIME = 0.16;               // seconds — spring while following the cursor
  const RETURN_TIME = 0.55;              // seconds — graceful drift back to idle
  const REST_DELAY = 260;                // ms of stillness before snapping to a rest pose
  const GLANCE_AFTER = 5200;             // ms idle before she glances around by herself

  const stage = document.querySelector('[data-hero]');
  if (!stage) return;
  const canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const counter = document.querySelector('[data-hero-frame]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let bitmaps = null, sheet = null, fw = 0, fh = 0;
  let cur = IDLE, vel = 0, target = IDLE, smoothTime = RETURN_TIME;
  let pointerInside = false, dragging = false;
  let lastMove = 0, lastActivity = performance.now();
  let glanceUntil = 0, visible = true, raf = 0, last = 0, drawn = -1;

  /* ---------- loading ---------- */
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const sheetWidth = stage.clientWidth * dpr() > 1000 ? 960 : 640;

  const img = new Image();
  img.decoding = 'async';
  img.src = `assets/hero-sprite-${sheetWidth}.jpg`;
  img.decode().then(async () => {
    fw = img.naturalWidth / FRAMES;
    fh = img.naturalHeight;
    try {
      // Slice once into per-frame bitmaps: cheaper to draw, and mobile
      // browsers no longer have to keep a 30,000px-wide image around.
      bitmaps = await Promise.all(
        Array.from({ length: FRAMES }, (_, i) => createImageBitmap(img, i * fw, 0, fw, fh))
      );
    } catch {
      sheet = img;
    }
    resize();
    stage.classList.add('is-ready');
    start();
  }).catch(() => stage.classList.add('is-failed'));

  /* ---------- drawing ---------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr());
    canvas.height = Math.round(r.height * dpr());
    drawn = -1;
  }

  function blit(i, alpha) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / fw, ch / fh);          // cover
    const dw = fw * s, dh = fh * s;
    let dx = cw / 2 - FOCUS_X * dw;                 // keep her on the centre line
    dx = Math.min(0, Math.max(cw - dw, dx));
    const dy = (ch - dh) / 2;
    ctx.globalAlpha = alpha;
    if (bitmaps) ctx.drawImage(bitmaps[i], dx, dy, dw, dh);
    else ctx.drawImage(sheet, i * fw, 0, fw, fh, dx, dy, dw, dh);
  }

  function render() {
    const v = Math.min(FRAMES - 1, Math.max(0, cur));
    if (Math.abs(v - drawn) < 0.002) return;
    drawn = v;
    const i0 = Math.floor(v), f = v - i0;
    ctx.imageSmoothingQuality = 'high';
    blit(i0, 1);
    if (f > 0.01 && i0 + 1 < FRAMES) blit(i0 + 1, f);
    ctx.globalAlpha = 1;
    if (counter) counter.textContent = String(Math.round(v) + 1).padStart(2, '0');
  }

  /* ---------- motion ---------- */
  // Critically damped spring (same maths as Unity's SmoothDamp).
  function smoothDamp(c, t, v, time, dt) {
    const omega = 2 / time, x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = c - t, temp = (v + omega * change) * dt;
    return [t + (change + temp) * exp, (v - omega * temp) * exp];
  }

  function restPose(t) {
    t = Math.round(t);
    for (const [a, b] of BLINKS) {
      if (t >= a && t <= b) return (t - a < b - t) ? a - 1 : b + 1;
    }
    return t;
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    const tracking = pointerInside || dragging;
    if (tracking && now - lastMove > REST_DELAY) target = restPose(target);

    // Left alone for a while, she looks around the room on her own.
    if (!tracking && !reduceMotion) {
      if (glanceUntil && now > glanceUntil) {
        glanceUntil = 0; target = IDLE; smoothTime = RETURN_TIME; lastActivity = now;
      } else if (!glanceUntil && now - lastActivity > GLANCE_AFTER) {
        target = Math.random() < 0.5 ? 6 + Math.round(Math.random() * 4) : 38 + Math.round(Math.random() * 6);
        smoothTime = 0.45;
        glanceUntil = now + 1500;
      }
    }

    [cur, vel] = smoothDamp(cur, target, vel, smoothTime, dt);
    render();
    if (visible) raf = requestAnimationFrame(tick);
  }

  function start() {
    if (!raf && visible && (bitmaps || sheet)) { last = lastActivity = performance.now(); raf = requestAnimationFrame(tick); }
  }

  /* ---------- input ---------- */
  function aim(clientX) {
    const r = stage.getBoundingClientRect();
    let nx = ((clientX - r.left) / r.width - 0.5) * 2;     // -1 … 1 across the stage
    nx = Math.max(-1, Math.min(1, nx * 1.12));              // reach the extremes before the edges
    const eased = Math.sign(nx) * Math.pow(Math.abs(nx), 0.9);
    target = eased < 0 ? IDLE + eased * IDLE : IDLE + eased * (FRAMES - 1 - IDLE);
    smoothTime = TRACK_TIME;
    lastMove = lastActivity = performance.now();
    glanceUntil = 0;
    stage.classList.add('has-moved');
  }

  function release() {
    pointerInside = dragging = false;
    target = IDLE;
    smoothTime = RETURN_TIME;
    lastActivity = performance.now();
  }

  stage.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') pointerInside = true; });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && !dragging) return;
    aim(e.clientX);
  });
  stage.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') release(); });
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') { dragging = true; aim(e.clientX); }
  });
  ['pointerup', 'pointercancel'].forEach(t => stage.addEventListener(t, e => {
    if (e.pointerType === 'touch') release();
  }));

  // Keyboard: arrow keys turn her head when the stage has focus.
  stage.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    target = restPose(Math.max(0, Math.min(FRAMES - 1, Math.round(target) + (e.key === 'ArrowLeft' ? -6 : 6))));
    smoothTime = 0.25; lastActivity = performance.now();
  });
  stage.addEventListener('blur', release);

  new ResizeObserver(() => { if (bitmaps || sheet) { resize(); render(); } }).observe(stage);
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) start();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start();
  });
})();
