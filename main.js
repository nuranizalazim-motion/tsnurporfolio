(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Header tucks away on scroll down, returns on scroll up. */
  const header = document.querySelector('[data-header]');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    header.classList.toggle('is-hidden', y > lastY && y > 160);
    lastY = y;
  }, { passive: true });

  /* Publications: show all / fewer. */
  const pubs = document.querySelector('[data-pubs]');
  const toggle = document.getElementById('pubs-toggle');
  toggle?.addEventListener('click', () => {
    const open = pubs.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'show fewer' : 'show all 16';
  });

  /* Copy email. Falls back to selecting the text if the clipboard is refused. */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.querySelector(btn.dataset.copy);
      const done = () => { btn.textContent = 'copied'; setTimeout(() => (btn.textContent = 'copy'), 1600); };
      const select = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'selected'; };
      try { navigator.clipboard.writeText(el.textContent.trim()).then(done, select); } catch { select(); }
    });
  });

  /* Play tile videos only while they are on screen. */
  const vids = document.querySelectorAll('video[data-autoplay]');
  if (!reduceMotion) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause();
    }), { threshold: 0.25 });
    vids.forEach(v => io.observe(v));
  }

  if (!finePointer) return;

  /* Soft cursor dot inside the hero stage. */
  const stage = document.querySelector('[data-hero]');
  const dot = document.querySelector('[data-hero-dot]');
  stage?.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    dot.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
  });

  /* "view" bubble that trails the pointer over work tiles. */
  const bubble = document.querySelector('[data-view-cursor]');
  let tx = 0, ty = 0, x = 0, y = 0, running = false;
  const follow = () => {
    x += (tx - x) * (reduceMotion ? 1 : 0.18);
    y += (ty - y) * (reduceMotion ? 1 : 0.18);
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.3) requestAnimationFrame(follow); else running = false;
  };
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    if (!running) { running = true; requestAnimationFrame(follow); }
  }, { passive: true });
  document.querySelectorAll('[data-cursor]').forEach(tile => {
    tile.addEventListener('pointerenter', () => { bubble.textContent = tile.dataset.cursor; bubble.classList.add('is-on'); });
    tile.addEventListener('pointerleave', () => bubble.classList.remove('is-on'));
  });
})();
