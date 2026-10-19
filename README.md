# Fractis Studios — Static Site

Static rebuild of [fractisstudios.com](https://fractisstudios.com) for GitHub Pages. The original WordPress site was scraped and archived in `scrape/fractisstudios-homepage-original.html`; all page content is reproduced verbatim from the source (with a few deliberate bug fixes noted below).

## Structure

```
index.html                        Homepage (001 Identity → 010 Do It)
start-a-project/                  Client intake form + guide CTA
start-a-project/client-welcome-guide/   14-slide client deck
join-the-collective/              Talent intake form + FAQs
join-the-collective/talent-welcome-guide/   21-slide talent deck
join-the-collective/academy-guide/         11-slide Academy deck
refer-a-client/                   Referral programme: stats, tiers, FAQs, 2 Google Forms
refer-a-client/partner-guide/     10-slide referral deck
privacy-policy/ · terms-and-conditions/ · cookie-policy/
css/style.css                     Design system (animejs.com layout × Fractis brand)
js/main.js                        Nav, FAQ, tabs, forms
js/site.js                        anime.js v4: kaleidoscope hero, reveals, marquee
assets/                           Logos, service/work imagery, guide slides, PDFs
scrape/                           Archived original homepage HTML
```

All paths are relative — the site works as a GitHub Pages project site under `/fractis-studios/`.

## Tech

- Plain HTML/CSS/JS, no build step.
- [anime.js](https://animejs.com) v4 via importmap ESM from jsDelivr.
- Fonts: Martian Mono + IBM Plex Sans (Google Fonts).
- Hero: custom canvas kaleidoscope ("Fractis" fracture fractal), driven by anime.js state timelines; respects `prefers-reduced-motion`.

## Forms

The original WordPress forms are replaced with [FormSubmit](https://formsubmit.co) AJAX posts (`js/main.js`, `form[data-mailto]`). **Before launch:** email `fractis.studios@gmail.com` once to activate FormSubmit, or fork/replace the endpoint. The refer-a-client tabs embed the original Google Forms unchanged.

## Deliberate fixes vs. the original

- Client Welcome Guide: removed mislabeled "Download the Talent Introduction Guide" button (it linked to the Talent PDF; no client PDF exists).
- Cookie Policy: H1 corrected to "Cookie Policy" (original said "Terms & Conditions"); duplicate "3.1" numbering corrected.
- Privacy Policy title tag no longer contains literal `%` characters.
- "Intersted" typos corrected on guide pages.

## Deploy

Pushed to `main`; GitHub Pages serves from the branch root. No workflow required.
