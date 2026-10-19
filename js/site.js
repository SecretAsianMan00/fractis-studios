/* Fractis Studios — anime.js motion layer
   Scroll-scrubbed blueprint deconstruction chapter (animejs.com-style):
   pinned stage, HUD cards arranged around the scene, DOF, interactive camera. */
import {
  animate,
  createTimeline,
} from "animejs";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* piecewise eased keyframes: lerpKeys(p, [[pos, val, ease?], ...]) */
function lerpKeys(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i];
    const [p1, v1, ease] = keys[i + 1];
    if (p <= p1) {
      let t = (p - p0) / (p1 - p0 || 1);
      if (ease === "out") t = 1 - Math.pow(1 - t, 3);
      else if (ease === "inout") t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}

/* opacity envelope: fade in over [a0,a1], hold, fade out over [b0,b1] */
function win(p, a0, a1, b0, b1) {
  if (p < a0 || p > b1) return 0;
  if (p < a1) return (p - a0) / (a1 - a0 || 1);
  if (p > b0) return 1 - (p - b0) / (b1 - b0 || 1);
  return 1;
}

/* ============================================================
   BLUEPRINT CHAPTER — deconstructing Fractis mark, scrubbed by scroll
   ============================================================ */
function initBlueprintChapter() {
  const chapter = document.querySelector(".hero-chapter");
  const stage = chapter?.querySelector(".chapter-stage");
  const canvas = document.getElementById("blueprint");
  if (!chapter || !stage || !canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const headerEl = document.querySelector(".site-header");
  const isMobile = () => window.innerWidth < 900;

  /* ---------- build the F-monolith panel cloud ---------- */
  const panels = [];
  const addPanel = (x, y, z, w, h, thick, tag) => {
    const dist = Math.hypot(x, y, z) || 1;
    const delay = 0.12 + Math.random() * 0.55;
    panels.push({
      hx: x, hy: y, hz: z,
      w, h, thick, tag,
      ex: (x / dist) * (0.9 + Math.random() * 1.6) + (Math.random() - 0.5) * 0.5,
      ey: (y / dist) * (0.7 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.6 + 0.15,
      ez: (z / dist) * (1.2 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.8,
      rx: (Math.random() - 0.5) * 1.4,
      ry: (Math.random() - 0.5) * 1.8,
      rz: (Math.random() - 0.5) * 1.1,
      delay,
      ph: Math.random() * Math.PI * 2,
    });
  };

  /* spine — vertical stack of slats */
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const y = (i - (rows - 1) / 2) * 0.148;
    addPanel(-0.42, y, 0, 0.30, 0.118, 0.05, `SPINE·${String(i + 1).padStart(2, "0")}`);
    addPanel(-0.42, y, -0.16, 0.26, 0.10, 0.03, "");
    addPanel(-0.42, y, 0.16, 0.26, 0.10, 0.03, "");
  }
  /* top arm */
  for (let i = 0; i < 5; i++) {
    const x = -0.10 + i * 0.175;
    addPanel(x, 0.592, 0, 0.145, 0.118, 0.05, i === 2 ? "ARM·TOP" : "");
    addPanel(x, 0.592, -0.16, 0.125, 0.10, 0.03, "");
  }
  /* mid arm */
  for (let i = 0; i < 3; i++) {
    const x = -0.10 + i * 0.175;
    addPanel(x, 0.148, 0, 0.145, 0.118, 0.05, i === 1 ? "ARM·MID" : "");
    addPanel(x, 0.148, 0.16, 0.125, 0.10, 0.03, "");
  }
  /* floating detail plates around the mark */
  const floaters = [
    [0.55, 0.42, -0.3], [0.62, -0.05, 0.25], [-0.78, 0.3, 0.3],
    [-0.7, -0.35, -0.28], [0.35, -0.55, 0.15], [0.15, 0.75, 0.3],
    [-0.2, -0.72, -0.2], [0.72, 0.62, -0.15],
  ];
  floaters.forEach(([x, y, z], i) => addPanel(x, y, z, 0.16, 0.11, 0.025, i === 0 ? "PLATE·AUX" : ""));

  const total = panels.length;
  /* shuffle draw order slightly by seeding delays sorted outward */
  panels.forEach((pn, i) => {
    pn.order = i;
    /* stagger delay: pieces farther from center explode earlier-ish */
    pn.delay = 0.08 + (Math.hypot(pn.hx, pn.hy, pn.hz) / 1.6) * 0.42 + (i % 7) * 0.018;
  });

  /* ---------- state ---------- */
  const state = {
    p: 0,            // smoothed scroll progress 0..1
    target: 0,
    mx: 0, my: 0,    // pointer -1..1
    pmx: 0, pmy: 0,  // smoothed pointer
    t: 0,
    w: 0, h: 0, cx: 0, cy: 0,
  };

  let dpr = 1;
  const resize = () => {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 1.75);
    state.w = Math.max(320, rect.width);
    state.h = Math.max(320, rect.height);
    canvas.width = Math.round(state.w * dpr);
    canvas.height = Math.round(state.h * dpr);
    canvas.style.width = state.w + "px";
    canvas.style.height = state.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cx = state.w * 0.5;
    state.cy = state.h * 0.48;
  };
  resize();
  window.addEventListener("resize", resize);

  /* interactive camera + focus */
  if (!reduced && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      state.mx = (e.clientX / window.innerWidth) * 2 - 1;
      state.my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ---------- scroll progress ---------- */
  const measure = () => {
    const headerH = headerEl ? headerEl.offsetHeight : 64;
    const rect = chapter.getBoundingClientRect();
    const travel = chapter.offsetHeight - stage.offsetHeight;
    if (travel <= 0) return 0;
    return clamp((headerH - rect.top) / travel, 0, 1);
  };

  /* ---------- projection ---------- */
  const FOV = 2.6;
  const project = (x, y, z, cam) => {
    const zz = z + cam.z;
    if (zz <= 0.12) return null;
    const s = (FOV / zz) * cam.scale;
    return { x: state.cx + x * s + cam.ox, y: state.cy - y * s + cam.oy, s, z: zz };
  };

  const rotY = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  };
  const rotX = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  };

  /* ---------- HUD elements ---------- */
  const hud = {
    title: stage.querySelector('[data-hud="title"]'),
    specs: stage.querySelector('[data-hud="specs"]'),
    cta: stage.querySelector('[data-hud="cta"]'),
    stats: stage.querySelector('[data-hud="stats"]'),
    code: stage.querySelector('[data-hud="code"]'),
    codeText: document.getElementById("hud-code-text"),
    cursor: document.getElementById("progress-cursor"),
    pct: document.getElementById("progress-pct"),
    chapterLabel: document.getElementById("progress-chapter"),
  };
  const titleLines = hud.title ? Array.from(hud.title.querySelectorAll(".hero-title .line > span")) : [];

  const CODE_SNIPPETS = [
    "studio: 'Fractis'\nmode:   'senior-led'\nscope:  'full-stack'",
    "assemble: false\nstagger:  42ms\nscatter:  'radial'",
    "camera: 'traverse'\ndof:     'rack focus'\nfocus:   'deep'",
    "status: 'reassembled'\nready:   true",
  ];
  let codeIdx = 0;
  const setCode = (i) => {
    if (i === codeIdx || !hud.codeText) return;
    codeIdx = i;
    hud.codeText.textContent = CODE_SNIPPETS[i];
  };

  const CHAPTER_NAMES = ["Identity", "Deconstruct", "Traverse", "Reform"];
  let chapIdx = 0;
  const setChapterName = (i) => {
    if (i === chapIdx || !hud.chapterLabel) return;
    chapIdx = i;
    hud.chapterLabel.textContent = CHAPTER_NAMES[i];
  };

  const applyHud = (el, o, ty, scale) => {
    if (!el) return;
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translateY(${ty.toFixed(1)}px) scale(${(0.96 + 0.04 * o + (scale || 0)).toFixed(4)})`;
  };

  /* ---------- render ---------- */
  const drawGrid = (cam, alpha) => {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.strokeStyle = `rgba(0, 255, 249, ${0.07 * alpha})`;
    ctx.lineWidth = 1;
    const N = 14, span = 2.2;
    for (let i = -N; i <= N; i++) {
      const v = (i / N) * span;
      const a = project(v, -1.05, -span, cam);
      const b = project(v, -1.05, span, cam);
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      const c = project(-span, -1.05, v, cam);
      const d = project(span, -1.05, v, cam);
      if (c && d) { ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); }
    }
    /* horizon ticks */
    ctx.strokeStyle = `rgba(0, 255, 249, ${0.16 * alpha})`;
    for (let i = -6; i <= 6; i++) {
      const x = (i / 6) * 1.4;
      const a = project(x, -1.05, -span, cam);
      const b = project(x, -1.05, -span + 0.08, cam);
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    ctx.restore();
  };

  const drawFrame = () => {
    const { w, h } = state;
    const p = state.p;

    /* master choreography */
    const orbit = lerpKeys(p, [[0, -0.28], [0.2, -0.1], [0.55, 0.55, "inout"], [0.8, 0.95], [1, 1.25, "out"]]);
    const pitch = 0.38 + Math.sin(p * Math.PI) * 0.14 + state.pmy * 0.12;
    const camZ = lerpKeys(p, [[0, 3.15], [0.25, 3.45], [0.55, 3.1, "inout"], [0.72, 1.15, "inout"], [0.88, 2.6, "out"], [1, 3.0, "out"]]);
    const camScale = lerpKeys(p, [[0, 1], [0.55, 1.05], [0.72, 1.35, "inout"], [1, 1.05, "out"]]);
    const explodeBase = lerpKeys(p, [[0, 0], [0.14, 0], [0.5, 1, "out"], [0.72, 1.06], [0.84, 0.35, "inout"], [1, 0.06, "out"]]);
    const gridAlpha = lerpKeys(p, [[0, 1], [0.3, 0.5], [0.6, 0.15], [1, 0.45]]);
    const focusZ = lerpKeys(p, [[0, 3.15], [0.35, 3.0], [0.72, 1.0, "inout"], [1, 2.9, "out"]]) + state.pmx * 0.35;
    const glow = lerpKeys(p, [[0, 0.55], [0.5, 0.35], [0.8, 0.5], [1, 1, "out"]]);

    const cam = {
      z: camZ,
      scale: camScale * Math.min(w, h) * 0.34,
      ox: state.pmx * 26,
      oy: state.pmy * 18,
    };
    const yaw = orbit + state.pmx * 0.16;

    ctx.fillStyle = "#020613";
    ctx.fillRect(0, 0, w, h);

    /* faint radial bloom behind mark */
    const bloom = ctx.createRadialGradient(state.cx, state.cy, 0, state.cx, state.cy, Math.min(w, h) * 0.5);
    bloom.addColorStop(0, `rgba(0, 255, 249, ${0.05 + glow * 0.05})`);
    bloom.addColorStop(0.5, `rgba(151, 0, 255, ${0.03 + glow * 0.03})`);
    bloom.addColorStop(1, "rgba(2,6,19,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    drawGrid(cam, gridAlpha);

    /* transform panels */
    const drawn = [];
    for (let i = 0; i < total; i++) {
      const pn = panels[i];
      const local = clamp((explodeBase - pn.delay * 0.55) / (1 - pn.delay * 0.55 || 1), 0, 1);
      const e = local * local * (3 - 2 * local); /* smoothstep */
      const drift = Math.sin(state.t * 0.7 + pn.ph) * 0.03 * e;

      let x = pn.hx + pn.ex * e * 1.35;
      let y = pn.hy + pn.ey * e * 1.2 + drift;
      let z = pn.hz + pn.ez * e * 1.6;

      /* per-panel tumble */
      const rx = pn.rx * e, ry = pn.ry * e, rz = pn.rz * e;
      if (ry || rx) {
        let corners = [
          [-pn.w / 2, -pn.h / 2, 0], [pn.w / 2, -pn.h / 2, 0],
          [pn.w / 2, pn.h / 2, 0], [-pn.w / 2, pn.h / 2, 0],
        ];
        corners = corners.map((c) => {
          let q = [c[0] + x, c[1] + y, c[2] + z];
          q = rotY(q, yaw + ry);
          q = rotX(q, pitch + rx);
          return q;
        });
        /* thickness side */
        const top = corners.map((c) => project(c[0], c[1], c[2], cam));
        const bot = corners.map((c) => project(c[0], c[1] - pn.thick * (1 + e), c[2], cam));
        if (top.every(Boolean) && bot.every(Boolean)) {
          const zAvg = (top.reduce((s, q) => s + q.z, 0)) / 4;
          drawn.push({ pn, e, top, bot, zAvg, rz });
        }
      } else {
        /* axis-aligned fast path with yaw/pitch via corners */
        let corners = [
          [-pn.w / 2, -pn.h / 2, 0], [pn.w / 2, -pn.h / 2, 0],
          [pn.w / 2, pn.h / 2, 0], [-pn.w / 2, pn.h / 2, 0],
        ].map((c) => {
          let q = [c[0] + x, c[1] + y, c[2] + z];
          q = rotY(q, yaw);
          q = rotX(q, pitch);
          return q;
        });
        const top = corners.map((c) => project(c[0], c[1], c[2], cam));
        const bot = corners.map((c) => project(c[0], c[1] - pn.thick, c[2], cam));
        if (top.every(Boolean) && bot.every(Boolean)) {
          const zAvg = (top.reduce((s, q) => s + q.z, 0)) / 4;
          drawn.push({ pn, e, top, bot, zAvg, rz: 0 });
        }
      }
    }

    /* painter's sort: far → near */
    drawn.sort((a, b) => b.zAvg - a.zAvg);

    /* depth-of-field: quantized blur buckets */
    const BLUR_STEPS = isMobile() ? [0, 0, 3, 6] : [0, 0, 2, 4, 7, 10];
    const maxZ = camZ + 2.2, minZ = 0.25;

    let bucket = -1;
    for (let i = 0; i < drawn.length; i++) {
      const d = drawn[i];
      const fog = clamp((d.zAvg - minZ) / (maxZ - minZ), 0, 1);
      const dofDist = Math.abs(d.zAvg - focusZ);
      const blur = clamp(dofDist * (isMobile() ? 3.2 : 4.4) - 0.4, 0, BLUR_STEPS[BLUR_STEPS.length - 1]);
      /* quantize to bucket */
      const bIdx = Math.min(BLUR_STEPS.length - 1, Math.round((blur / BLUR_STEPS[BLUR_STEPS.length - 1]) * (BLUR_STEPS.length - 1)));
      if (bIdx !== bucket) {
        bucket = bIdx;
        const bpx = BLUR_STEPS[bIdx];
        ctx.filter = bpx > 0 ? `blur(${bpx}px)` : "none";
      }

      const alpha = (0.5 + glow * 0.5) * (1 - fog * 0.72);
      const hue = 178 + fog * 40 + d.e * 30;
      const lw = Math.max(0.6, d.pn.thick * d.top[0].s * 0.5);

      /* side face */
      ctx.beginPath();
      ctx.moveTo(d.top[0].x, d.top[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(d.top[k].x, d.top[k].y);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${0.05 * alpha + d.e * 0.04})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue}, 100%, 62%, ${0.75 * alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();

      /* depth edge (slab thickness) */
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = d.top[k], b = d.bot[k];
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.strokeStyle = `hsla(${hue + 12}, 100%, 60%, ${0.3 * alpha})`;
      ctx.lineWidth = Math.max(0.5, lw * 0.6);
      ctx.stroke();

      /* annotation on tagged panels mid-deconstruction */
      if (d.pn.tag && d.top[0]) {
        const tagAlpha = win(state.p, 0.1, 0.2, 0.55, 0.72) * alpha;
        if (tagAlpha > 0.03) {
          ctx.filter = "none";
          bucket = -1;
          const ax = d.top[0].x, ay = d.top[0].y;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + 26, ay - 20);
          ctx.lineTo(ax + 58, ay - 20);
          ctx.strokeStyle = `rgba(0, 255, 249, ${0.5 * tagAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.font = "600 9px 'Martian Mono', monospace";
          ctx.fillStyle = `rgba(250, 254, 255, ${0.85 * tagAlpha})`;
          ctx.fillText(d.pn.tag, ax + 30, ay - 24);
        }
      }
    }
    ctx.filter = "none";

    /* central eye / core mark */
    const eyeA = (0.4 + glow * 0.6) * (1 - win(state.p, 0.2, 0.35, 0.65, 0.8) * 0.85);
    if (eyeA > 0.02) {
      const c0 = project(0, 0, 0, cam);
      if (c0) {
        const r = 0.045 * c0.s * (1 + glow * 0.4);
        const g = ctx.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, r * 4);
        g.addColorStop(0, `rgba(250, 254, 255, ${0.9 * eyeA})`);
        g.addColorStop(0.3, `rgba(0, 255, 249, ${0.45 * eyeA})`);
        g.addColorStop(1, "rgba(0,255,249,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c0.x, c0.y, r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* scanline sweep during traverse */
    const scan = win(state.p, 0.52, 0.58, 0.78, 0.86);
    if (scan > 0.02) {
      const sy = ((state.t * 140) % (h + 200)) - 100;
      const grad = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
      grad.addColorStop(0, "rgba(0,255,249,0)");
      grad.addColorStop(0.5, `rgba(0,255,249,${0.06 * scan})`);
      grad.addColorStop(1, "rgba(0,255,249,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, sy - 60, w, 120);
    }
  };

  /* ---------- HUD sync ---------- */
  const syncHud = () => {
    const p = state.p;
    const oTitle = win(p, -1, 0, 0.1, 0.2);
    const oSpecs = win(p, 0.15, 0.23, 0.48, 0.56);
    const oCode = win(p, 0.28, 0.36, 0.8, 0.88);
    const oStats = win(p, 0.52, 0.6, 0.74, 0.82);
    const oCta = Math.max(win(p, -1, 0, 0.06, 0.14), win(p, 0.78, 0.86, 2, 3));

    applyHud(hud.title, oTitle, (1 - oTitle) * -12);
    applyHud(hud.specs, oSpecs, (1 - oSpecs) * 16);
    applyHud(hud.code, oCode, (1 - oCode) * 10);
    applyHud(hud.stats, oStats, (1 - oStats) * 16);
    applyHud(hud.cta, oCta, (1 - oCta) * 18);

    if (hud.cursor) hud.cursor.style.left = (p * 100).toFixed(2) + "%";
    if (hud.pct) hud.pct.textContent = String(Math.round(p * 100)).padStart(2, "0") + "%";

    setCode(p < 0.34 ? 0 : p < 0.58 ? 1 : p < 0.82 ? 2 : 3);
    setChapterName(p < 0.16 ? 0 : p < 0.52 ? 1 : p < 0.8 ? 2 : 3);
  };

  /* ---------- loop ---------- */
  let raf = 0;
  let last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    state.t += dt;
    state.target = measure();
    state.p += (state.target - state.p) * (reduced ? 1 : 0.085);
    state.pmx += (state.mx - state.pmx) * 0.04;
    state.pmy += (state.my - state.pmy) * 0.04;
    drawFrame();
    syncHud();
  };

  if (reduced) {
    state.p = 0;
    drawFrame();
    syncHud();
    /* show everything statically */
    [hud.title, hud.specs, hud.code, hud.stats, hud.cta].forEach((el) => {
      if (el) { el.style.opacity = "1"; el.style.transform = "none"; }
    });
  } else {
    /* intro: title lines rise once on load */
    if (titleLines.length) {
      createTimeline({ defaults: { ease: "outExpo" } })
        .add(titleLines, { y: ["112%", "0%"], duration: 1050, delay: (i) => 200 + i * 110 }, 0)
        .add(hud.title?.querySelector(".hero-label"), { opacity: [0, 1], y: [10, 0], duration: 700 }, 100);
    }
    raf = requestAnimationFrame(loop);
    /* pause when chapter offscreen */
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }, { threshold: 0.01 });
      io.observe(chapter);
    }
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
initBlueprintChapter();
initMarquee();
initReveals();
initAccentWatch();
