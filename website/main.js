/* Meme Swap landing — parallax, reveal-on-scroll, nav state. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav background on scroll ---------- */
  const nav = document.getElementById('nav');
  const updateNav = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  const revealables = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('visible'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    revealables.forEach((el) => io.observe(el));
  }

  if (reducedMotion) return; // no parallax for users who opted out

  /* ---------- Scroll parallax (data-parallax="speed") ---------- */
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0,
  }));

  /* ---------- Hero mouse + scroll parallax (data-depth) ---------- */
  const depthEls = [...document.querySelectorAll('[data-depth]')].map((el) => ({
    el,
    depth: parseFloat(el.dataset.depth) || 0,
  }));

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  let ticking = false;

  const render = () => {
    ticking = false;
    const vh = window.innerHeight;

    // Ease mouse toward target for a floaty feel
    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;

    const scrollY = window.scrollY;

    // Hero layers: drift with mouse, rise with scroll
    for (const { el, depth } of depthEls) {
      const mx = mouseX * depth * 60;
      const my = mouseY * depth * 60;
      const sy = Math.min(scrollY, vh) * depth * -0.6;
      el.style.transform = `translate3d(${mx}px, ${my + sy}px, 0)`;
    }

    // Section elements: subtle offset relative to viewport center
    for (const { el, speed } of parallaxEls) {
      const rect = el.getBoundingClientRect();
      const fromCenter = rect.top + rect.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${(fromCenter * speed * -1).toFixed(1)}px, 0)`;
    }

    // Keep animating while the eased mouse position settles
    if (Math.abs(targetX - mouseX) > 0.001 || Math.abs(targetY - mouseY) > 0.001) {
      requestTick();
    }
  };

  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  };

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick, { passive: true });
  window.addEventListener(
    'mousemove',
    (e) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
      requestTick();
    },
    { passive: true },
  );

  requestTick();
})();
