/* Fractis Studios — shared UI behaviour */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* year */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* mobile nav */
  const toggle = document.querySelector(".nav-toggle");
  const scrim = document.querySelector(".nav-scrim");
  if (toggle) {
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", document.body.classList.contains("nav-open") ? "true" : "false");
    });
  }
  if (scrim) {
    scrim.addEventListener("click", () => document.body.classList.remove("nav-open"));
  }
  document.querySelectorAll(".site-nav a").forEach((a) => {
    a.addEventListener("click", () => document.body.classList.remove("nav-open"));
  });

  /* active nav highlighting by hash/section */
  const navLinks = Array.from(document.querySelectorAll('.site-nav a[href*="#"]'));
  if (navLinks.length && "IntersectionObserver" in window) {
    const targets = navLinks
      .map((a) => {
        const id = a.getAttribute("href").split("#")[1];
        return id ? document.getElementById(id) : null;
      })
      .filter(Boolean);
    if (targets.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((a) => {
              const id = a.getAttribute("href").split("#")[1];
              a.classList.toggle("is-active", id === entry.target.id);
            });
          });
        },
        { rootMargin: "-30% 0px -55% 0px" }
      );
      targets.forEach((t) => io.observe(t));
    }
  }

  /* marquee — duplicate content for seamless loop */
  document.querySelectorAll(".marquee").forEach((root) => {
    const track = root.querySelector(".marquee-track");
    if (!track) return;
    const group = track.querySelector(".marquee-group");
    if (!group) return;
    /* ensure 3+ copies */
    while (track.children.length < 3) {
      track.appendChild(group.cloneNode(true));
    }
  });

  /* FAQ accordions */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const btn = item.querySelector(".faq-q");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      item.parentElement.querySelectorAll(".faq-item.is-open").forEach((other) => {
        if (other !== item) {
          other.classList.remove("is-open");
          other.querySelector(".faq-q")?.setAttribute("aria-expanded", "false");
        }
      });
      item.classList.toggle("is-open", !open);
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  /* tabs */
  document.querySelectorAll("[data-tabs]").forEach((root) => {
    const tabs = Array.from(root.querySelectorAll(".tab"));
    const panels = Array.from(root.querySelectorAll(".tab-panel"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.tab;
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", String(on));
        });
        panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === key));
      });
    });
  });

  /* offerings image swap */
  const offerMedia = document.querySelector("[data-offer-media]");
  const offerItems = Array.from(document.querySelectorAll(".offer-item[data-img]"));
  if (offerMedia && offerItems.length) {
    const img = offerMedia.querySelector("img");
    let current = offerItems[0].dataset.img;
    const activate = (item) => {
      if (item.classList.contains("is-active")) return;
      offerItems.forEach((i) => i.classList.toggle("is-active", i === item));
      const next = item.dataset.img;
      if (!next || next === current || !img) return;
      current = next;
      img.classList.add("is-swapping");
      window.setTimeout(() => {
        img.src = next;
        img.alt = item.dataset.imgAlt || "";
        img.addEventListener(
          "load",
          () => img.classList.remove("is-swapping"),
          { once: true }
        );
      }, 160);
    };
    offerItems.forEach((item) => {
      item.addEventListener("mouseenter", () => activate(item));
      item.addEventListener("click", () => activate(item));
      item.addEventListener("focusin", () => activate(item));
    });
  }

  /* forms — formsubmit.co ajax wiring */
  document.querySelectorAll("form[data-mailto]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const endpoint = "https://formsubmit.co/ajax/" + form.dataset.mailto;
      const btn = form.querySelector('[type="submit"]');
      const original = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        });
        if (!res.ok) throw new Error("bad response");
        form.reset();
        form.querySelector(".form-success")?.classList.add("is-visible");
      } catch (err) {
        window.alert("Something went wrong sending your form. Please try again or email us directly.");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      }
    });
  });

  /* expose tiny helper for page scripts */
  window.Fractis = { reduced };
})();
