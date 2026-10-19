/* Fractis Studios — anime.js motion layer
   Kaleidoscope hero ("Fractis" fractal) + scroll reveals + marquee. */
import {
  animate,
  createTimeline,
  onScroll,
} from "animejs";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   KALEIDOSCOPE — fractal fracture wedges, mirrored into a lens
   ============================================================ */
function initKaleidoscope() {
  const canvas = document.getElementById("kaleido");
  if (!canvas) return null;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  const SEGMENTS = 14;
  const TAU = Math.PI * 2;
  const SEG = TAU / SEGMENTS;

  const state = {
    rot: 0,          // global rotation (rad)
    inner: 0,        // inner counter-rotation (rad)
    hue: 178,        // 178 cyan → 270 purple → 322 magenta
    pulse: 1,        // radial breathing
    depth: 1,        // branch opacity multiplier
    glow: 1,         // core glow
    mx: 0, my: 0,    // mouse parallax target (-1..1)
    px: 0, py: 0,    // smoothed parallax
    t: 0,
  };

  /* deterministic pseudo-random */
  let seed = 20261019;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /* pre-generate fracture trees inside one wedge (angle 0..SEG) */
  const trees = [];
  const roots = 3;
  for (let r = 0; r < roots; r++) {
    const baseAngle = SEG * (0.18 + (r / roots) * 0.64) + (rnd() - 0.5) * SEG * 0.12;
    const baseLen = 0.34 + rnd() * 0.1;
    const segs = [];
    const branch = (x, y, ang, len, w, depth) => {
      if (depth <= 0 || len < 0.012 || segs.length > 220) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      segs.push({ x1: x, y1: y, x2, y2, w, d: depth, ph: rnd() * TAU });
      const k = 0.38 + rnd() * 0.34;
      const bias = (rnd() - 0.5) * 0.24;
      branch(x2, y2, ang - k + bias, len * (0.62 + rnd() * 0.16), w * 0.74, depth - 1);
      branch(x2, y2, ang + k + bias, len * (0.58 + rnd() * 0.18), w * 0.7, depth - 1);
      if (depth > 3 && rnd() > 0.55) {
        branch(x2, y2, ang + (rnd() - 0.5) * 0.3, len * 0.5, w * 0.55, depth - 2);
      }
    };
    branch(0, 0, baseAngle, baseLen, 0.0075, 7);
    /* faint mirrored twin for density */
    const twin = segs.map((s) => ({
      x1: s.x1, y1: -s.y1, x2: s.x2, y2: -s.y2,
      w: s.w * 0.7, d: Math.max(1, s.d - 1), ph: s.ph + 1.3,
    }));
    trees.push({ segs, spin: (r % 2 === 0 ? 1 : -1) * (0.015 + r * 0.006), segs2: twin });
  }

  /* drifting motes inside the wedge */
  const motes = [];
  for (let i = 0; i < 26; i++) {
    motes.push({
      a: rnd() * SEG,
      r: 0.15 + rnd() * 0.75,
      s: 0.008 + rnd() * 0.02,
      sz: 0.6 + rnd() * 1.8,
      ph: rnd() * TAU,
    });
  }

  let w = 0, h = 0, cx = 0, cy = 0, R = 0;
  let dpr = 1;
  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = Math.max(320, rect.width);
    h = Math.max(320, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w * 0.5;
    cy = h * 0.46;
    R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 1.02;
  };
  resize();
  window.addEventListener("resize", resize);

  /* mouse parallax */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      state.mx = (e.clientX / window.innerWidth) * 2 - 1;
      state.my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const drawTree = (tree, phase) => {
    const all = tree.segs;
    for (let i = 0; i < all.length; i++) {
      const s = all[i];
      const breathe = 0.75 + 0.25 * Math.sin(state.t * 0.9 + s.ph + phase);
      const a = (0.045 + s.d * 0.028) * state.depth * breathe;
      const hue = state.hue + s.d * 7 + Math.sin(s.ph) * 6;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${58 + s.d * 2}%, ${a})`;
      ctx.lineWidth = s.w * R * state.pulse * (0.85 + s.d * 0.06);
      ctx.beginPath();
      ctx.moveTo(s.x1 * R, s.y1 * R);
      ctx.lineTo(s.x2 * R, s.y2 * R);
      ctx.stroke();
    }
  };

  const drawFrame = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx + state.px * 18, cy + state.py * 12);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    const globalRot = state.rot + state.px * 0.06;

    for (let m = 0; m < SEGMENTS; m++) {
      ctx.save();
      ctx.rotate(globalRot + m * SEG);
      if (m % 2 === 1) ctx.scale(1, -1); /* true kaleidoscope mirroring */
      const scale = state.pulse;
      ctx.scale(scale, scale);

      /* core bloom */
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.22);
      core.addColorStop(0, `hsla(${state.hue}, 100%, 70%, ${0.10 * state.glow})`);
      core.addColorStop(0.5, `hsla(${state.hue + 30}, 100%, 55%, ${0.03 * state.glow})`);
      core.addColorStop(1, "hsla(0, 0%, 0%, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.22, 0, TAU);
      ctx.fill();

      /* fracture trees with slow counter-spin */
      trees.forEach((tree, i) => {
        ctx.save();
        ctx.rotate(state.inner * tree.spin * 18 + Math.sin(state.t * 0.22 + i) * 0.05);
        drawTree(tree, i * 2.1);
        ctx.restore();
      });

      /* motes */
      for (const mo of motes) {
        const a = mo.a + Math.sin(state.t * 0.15 + mo.ph) * 0.04;
        const r = (mo.r + Math.sin(state.t * mo.s * 6 + mo.ph) * 0.03) * R * 0.9;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(state.t * 1.6 + mo.ph));
        ctx.fillStyle = `hsla(${state.hue + 20}, 100%, 72%, ${0.28 * tw * state.depth})`;
        ctx.beginPath();
        ctx.arc(x, y, mo.sz * (0.8 + tw * 0.5), 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }

    /* central eye */
    ctx.rotate(globalRot * 0.5);
    const eyeR = R * 0.035 * (1 + 0.15 * Math.sin(state.t * 1.2));
    const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeR * 3);
    eye.addColorStop(0, `hsla(${state.hue - 10}, 100%, 80%, ${0.85 * state.glow})`);
    eye.addColorStop(0.35, `hsla(${state.hue + 40}, 100%, 60%, ${0.35 * state.glow})`);
    eye.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(0, 0, eyeR * 3, 0, TAU);
    ctx.fill();

    ctx.restore();
  };

  /* master clock — rAF renders, anime.js drives state */
  let raf = 0;
  const loop = () => {
    state.t += 0.016;
    state.px += (state.mx - state.px) * 0.045;
    state.py += (state.my - state.py) * 0.045;
    drawFrame();
    raf = requestAnimationFrame(loop);
  };

  if (reduced) {
    state.depth = 0.85;
    drawFrame();
  } else {
    /* intro: kaleido blooms in */
    state.depth = 0;
    state.pulse = 1.35;
    state.glow = 0;
    createTimeline({ defaults: { ease: "outExpo" } })
      .add(state, { depth: 1, pulse: 1, glow: 1, duration: 2400 }, 0)
      .add(state, { rot: "+=0.55", duration: 2400, ease: "outQuint" }, 0);

    /* perpetual motion */
    createTimeline({ loop: true, defaults: { ease: "inOutSine" } })
      .add(state, { rot: "+=6.283185307179586", duration: 56000, ease: "linear" }, 0)
      .add(state, { inner: "+=12.566370614359172", duration: 48000, ease: "linear" }, 0)
      .add(state, { hue: [[178, 268, 322, 205, 178]], duration: 36000 }, 0)
      .add(state, { pulse: [1, 1.07, 0.96, 1], duration: 9000 }, 0)
      .add(state, { glow: [1, 1.35, 0.9, 1], duration: 7000 }, 0);

    /* occasional fracture "burst" */
    const burst = () => {
      createTimeline()
        .add(state, { depth: [state.depth, 1.55, 1], duration: 2600, ease: "outQuart" })
        .add(state, { pulse: [state.pulse, 1.1, 1], duration: 2600, ease: "outBack" }, 0);
      setTimeout(burst, 9000 + Math.random() * 9000);
    };
    setTimeout(burst, 9000);

    raf = requestAnimationFrame(loop);
  }

  /* pause offscreen for performance */
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!raf) raf = requestAnimationFrame(loop);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }, { threshold: 0.01 });
    io.observe(canvas);
  }

  return { state, canvas };
}

/* ============================================================
   HERO INTRO + scroll parallax
   ============================================================ */
function initHeroIntro() {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  if (reduced) {
    hero.querySelectorAll("[data-hero]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  const tl = createTimeline({ defaults: { ease: "outExpo" } });
  tl.add(".hero-label", { opacity: [0, 1], y: [14, 0], duration: 700 }, 150)
    .add(".hero-title .line > span", { y: ["112%", "0%"], duration: 1050, stagger: 110 }, 280)
    .add(".hero-sub", { opacity: [0, 1], y: [20, 0], duration: 800 }, "-=520")
    .add(".hero-actions .btn", { opacity: [0, 1], y: [16, 0], duration: 650, stagger: 90 }, "-=420");

  /* scroll: hero content drifts up + fades, canvas dims */
  const content = hero.querySelector(".hero-content");
  const canvas = hero.querySelector("#kaleido");
  const veil = hero.querySelector(".hero-veil");
  if (content) {
    animate(content, {
      opacity: [1, 0],
      y: [0, -70],
      autoplay: onScroll({
        target: hero,
        enter: "bottom-=80 top",
        leave: "bottom top",
        sync: true,
      }),
    });
  }
  if (canvas) {
    animate(canvas, {
      opacity: [1, 0.25],
      scale: [1, 1.12],
      ease: "linear",
      autoplay: onScroll({
        target: hero,
        enter: "bottom-=80 top",
        leave: "bottom top",
        sync: true,
      }),
    });
  }
  if (veil) {
    animate(veil, {
      opacity: [1, 1.6],
      ease: "linear",
      autoplay: onScroll({
        target: hero,
        enter: "bottom-=80 top",
        leave: "bottom top",
        sync: true,
      }),
    });
  }
}

/* ============================================================
   MARQUEE — seamless anime.js loop
   ============================================================ */
function initMarquee() {
  const track = document.querySelector(".marquee-track");
  const group = track?.querySelector(".marquee-group");
  if (!track || !group || reduced) return;
  const loopWidth = group.getBoundingClientRect().width;
  if (!loopWidth) return;
  animate(track, {
    x: [0, -loopWidth],
    duration: 30000,
    ease: "linear",
    loop: true,
  });
}

/* ============================================================
   SCROLL REVEALS — anime.js + IntersectionObserver
   ============================================================ */
function initReveals() {
  const items = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("reveal-done"));
    return;
  }

  /* group siblings for stagger */
  const groups = new Map();
  items.forEach((el) => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, []);
    groups.get(parent).push(el);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      const siblings = groups.get(el.parentElement) || [el];
      const index = siblings.indexOf(el);
      animate(el, {
        opacity: [0, 1],
        y: [22, 0],
        duration: 850,
        delay: index * 70,
        ease: "outExpo",
        onComplete: () => el.classList.add("reveal-done"),
      });
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  items.forEach((el) => io.observe(el));
}

/* ============================================================
   SECTION ACCENT SHIFT — header hairline tints per section
   ============================================================ */
function initAccentWatch() {
  if (!("IntersectionObserver" in window)) return;
  const sections = document.querySelectorAll("[data-accent]");
  if (!sections.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      document.documentElement.style.setProperty(
        "--header-accent",
        `var(--${entry.target.dataset.accent}-1, var(--cyan-1))`
      );
    });
  }, { rootMargin: "-40% 0px -50% 0px" });
  sections.forEach((s) => io.observe(s));
}

/* boot */
initKaleidoscope();
initHeroIntro();
initMarquee();
initReveals();
initAccentWatch();
