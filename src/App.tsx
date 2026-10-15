import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { MotionValue } from "framer-motion";

// Lets TSX accept the <wistia-player> custom element.
interface WistiaPlayerElement extends HTMLElement {
  play?: () => Promise<void> | void;
  pause?: () => void;
}

interface WistiaPlayerAttributes {
  "media-id": string;
  aspect?: string;
  autoplay?: string;
  muted?: string;
  "silent-autoplay"?: string;
  "end-video-behavior"?: string;
  "controls-visible-on-load"?: string;
  "play-bar-control"?: string;
  "play-pause-control"?: string;
  "big-play-button"?: string;
  "volume-control"?: string;
  "fullscreen-control"?: string;
  "settings-control"?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wistia-player": DetailedHTMLProps<HTMLAttributes<WistiaPlayerElement>, WistiaPlayerElement> & WistiaPlayerAttributes;
    }
  }
}

/* ==========================================================================
   DESIGN TOKENS: single source of truth. CSS variables are generated from this.
   ========================================================================== */
const T = {
  color: {
    bg: "#D9E6F5", // light blue page field: keeps the #182e6f logo high contrast
    bgDeep: "#C7D9EE",
    paper: "#F3F7FC",
    brand: "#182e6f", // logo colour
    brandDark: "#0E1D4A",
    ink: "#0B1633",
    inkSoft: "#44547D",
    line: "rgba(24, 46, 111, 0.16)",
    glassLight: "rgba(255, 255, 255, 0.62)",
    glassDark: "rgba(255, 255, 255, 0.12)",
    glassEdge: "rgba(255, 255, 255, 0.32)",
    onDark: "#F4F8FF",
    onDarkSoft: "rgba(244, 248, 255, 0.76)",
    call: "#F26B1D", // used only for call-to-action surfaces
    scrim: "rgba(8, 17, 44, 0.78)",
  },
  space: { xs: "0.5rem", sm: "0.75rem", md: "1rem", lg: "1.5rem", xl: "2.5rem", xxl: "4rem", section: "clamp(4.5rem, 9vw, 8rem)" },
  radius: { sm: "4px", md: "8px", lg: "14px" },
  font: {
    display: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    body: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.25rem",
    xl: "clamp(1.5rem, 2.4vw, 2.1rem)",
    xxl: "clamp(2.25rem, 5vw, 4.25rem)",
    mega: "clamp(3rem, 6.4vw, 6.5rem)",
  },
  sizeMobile: { xs: "0.6875rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.5rem", xxl: "2rem", mega: "2.375rem" },
  bp: { mobile: 768, wide: 1280 },
  layout: { max: "1200px", maxWide: "1360px", gutter: "clamp(1rem, 4vw, 3rem)", header: "68px", callBar: "60px", protrude: "clamp(28px, calc((100vw - 1230px) / 2), 88px)" },
  motion: { ease: "cubic-bezier(0.22, 1, 0.36, 1)", fast: "180ms", base: "320ms" },
  hero: { runDesktop: "250vh", runMobile: "190vh" },
  spring: { stiffness: 230, damping: 32, mass: 0.3, restDelta: 0.0005 },
  focal: { x: 0.5, y: 0.5 },
  frames: { count: 120, dir: "/Plumberanimated", prefix: "ezgif-frame-", ext: ".jpg", pad: 3 },
  business: {
    name: "Cofulent Solutions",
    phoneDisplay: "817-999-7363",
    phoneHref: "tel:+18179997363",
    address: "1319 Madeline Pl, Fort Worth, Texas 76107",
    leadEndpoint: "/api/lead",
    logoCandidates: ["/logo.png", "/Logo.png", "/logo.PNG", "/logo.webp", "/logo.svg", "/logo.jpg"] as readonly string[], // first one that exists is used; save yours in public/
    wistia: { mediaId: "19s5ibgs65", playerSrc: "https://fast.wistia.com/player.js", embedSrc: "https://fast.wistia.com/embed/19s5ibgs65.js" },
    facebook: "https://facebook.com/ConfluentSolutionsTX/",
    google: "https://www.google.com/maps/place/Confluent+Solutions/@32.7462208,-97.3747285,2107m/data=!3m1!1e3!4m6!3m5!1s0x864e7374d014c9e3:0xd453b45bc08216e6!8m2!3d32.7462431!4d-97.3744597!16s%2Fg%2F11jp9n7nrs!5m1!1e2?entry=ttu",
  },
} as const;

const frameUrl = (n: number): string =>
  `${T.frames.dir}/${T.frames.prefix}${String(n).padStart(T.frames.pad, "0")}${T.frames.ext}`;

/* ==========================================================================
   CONTENT
   ========================================================================== */
const SERVICES: readonly string[] = [
  "Gas Line Repair & Gas Leak Detection",
  "Water Line & Sewer Line Replacement",
  "Whole-House Repiping Services",
  "Slab Leak Detection & Repair",
  "Drain Cleaning & Sewer Backup Repair",
  "Water Heater Installation & Repair",
  "Leak Detection Services",
  "Residential Plumbing Repairs",
];

const SERVICE_AREAS: readonly string[] = [
  "Fort Worth",
  "Haltom City",
  "Richland Hills",
  "White Settlement",
  "Saginaw",
  "Forest Hill",
  "North Richland Hills",
  "Watauga",
  "Hurst",
  "Euless",
  "Bedford",
  "Colleyville",
  "Keller",
  "Southlake",
  "Crowley",
];

// Drop a photo at /public/services/<slug>.jpg and the card uses it automatically. Index-aligned with SERVICES.
const SERVICE_SLUGS: readonly string[] = [
  "gas-line",
  "water-sewer-line",
  "repiping",
  "slab-leak",
  "drain-cleaning",
  "water-heater",
  "leak-detection",
  "plumbing-repairs",
];

interface Badge {
  name: string;
  src: string;
  width: number;
  height: number;
}

const BADGES: readonly Badge[] = [
  { name: "Nextdoor Neighborhood Fave", src: "/badges/nextdoor-fave.png", width: 126, height: 126 },
  { name: "Rinnai Pro", src: "/badges/rinnai-pro.png", width: 126, height: 126 },
  { name: "MapQuest", src: "/badges/mapquest.png", width: 306, height: 57 },
  { name: "BuildZoom", src: "/badges/buildzoom.png", width: 212, height: 38 },
  { name: "Atmos Energy", src: "/badges/atmos-energy.png", width: 246, height: 114 },
  { name: "Bradford White Water Heaters", src: "/badges/bradford-white.png", width: 297, height: 110 },
  { name: "Delta", src: "/badges/delta.png", width: 294, height: 80 },
];

interface Step {
  n: string;
  title: string;
  body: string;
}

// Draft process copy: confirm steps 2 and 4 match how you actually work before launch.
const STEPS: readonly Step[] = [
  { n: "01", title: "You call or send the form", body: "A person picks up. Tell us what you are seeing, at any hour." },
  { n: "02", title: "We tell you what to do right now", body: "Shutoff valves, gas safety, what not to touch, before anyone is on the road." },
  { n: "03", title: "We find the problem first", body: "Leak and line detection before digging, so only what has to open gets opened." },
  { n: "04", title: "You get the plan and price before work starts", body: "You decide. No surprise add-ons after the fact." },
];

// Fill in any of these and they appear on the site automatically. Empty values stay hidden.
const TRUST_FACTS: readonly { label: string; value: string }[] = [
  { label: "License", value: "" },
  { label: "Insured", value: "" },
  { label: "Warranty", value: "" },
  { label: "Service call fee", value: "" },
];

interface Triage {
  symptom: string;
  level: "now" | "today" | "soon";
  headline: string;
  advice: string;
}

const TRIAGE: readonly Triage[] = [
  { symptom: "I smell gas", level: "now", headline: "Leave the home first", advice: "Do not use switches, lighters or phones inside. From outside, call 911 and your gas utility, then call us for repair and leak detection." },
  { symptom: "Water is flowing and won't stop", level: "now", headline: "Shut off the main valve", advice: "Turn off the main water shutoff, then call us right away. Move belongings away from the wet area." },
  { symptom: "Sewage is backing up", level: "now", headline: "Stop using every drain", advice: "No sinks, showers or toilets until it is cleared. Call us for drain cleaning and sewer backup repair." },
  { symptom: "Water heater is not working", level: "today", headline: "Call today", advice: "No hot water is disruptive but rarely dangerous. If you see water pooling under the tank, turn off its supply and call us." },
  { symptom: "Damp floor spot or high water bill", level: "soon", headline: "Possible hidden leak", advice: "Check that the meter stops when everything is off. If it keeps moving, request a call for leak and slab leak detection." },
  { symptom: "Slow drain or low pressure", level: "soon", headline: "Book a visit", advice: "Usually not an emergency, but it seldom fixes itself. Send a call request and we will schedule it." },
];

interface Faq {
  q: string;
  a: string;
}

const FAQS: readonly Faq[] = [
  { q: "How can I tell if a plumbing issue is urgent or can wait?", a: "Act immediately for a gas smell, water that will not stop, sewage backing into the home or no water at all. Slow drains, small drips and uneven pressure can usually wait for a scheduled visit, but they rarely fix themselves." },
  { q: "Why does my water pressure suddenly drop throughout the house?", a: "Common causes are a failing pressure regulator or partly closed valve, buildup inside aging pipes, or a hidden leak. Testing pressure at the source shows which one it is." },
  { q: "Why do plumbing leaks often go unnoticed until damage appears?", a: "Slab, in-wall and underground leaks stay out of sight. Clues include an unexplained jump in the water bill, damp or warm floor spots, musty smells, or a meter that moves while everything is off." },
  { q: "Is it safe to use chemical drain cleaners regularly?", a: "Regular use is not recommended. Harsh chemicals can wear on pipes and fittings and do not remove the underlying cause. Mechanical cleaning or a camera inspection is the safer route for repeat clogs." },
  { q: "What's the difference between a plumbing repair and a long-term solution?", a: "A repair fixes the section that failed. A long-term fix such as repiping or line replacement addresses why it failed, which matters when pipes are aging or keep failing." },
  { q: "How often should plumbing systems be professionally inspected?", a: "A periodic inspection helps most homes, especially older ones and before buying or selling. Ask us what interval fits your home." },
];

interface Stage {
  time: string;
  label: string;
  frame: number;
}

// Frame numbers map the 0-5s timestamps onto the extracted 24fps sequence (second * 24 + 1).
const STAGES: readonly Stage[] = [
  { time: "0s", label: "Disconnected", frame: 1 },
  { time: "1s", label: "Alignment begins", frame: 25 },
  { time: "2s", label: "Connection in progress", frame: 49 },
  { time: "3s", label: "Fittings coming together", frame: 73 },
  { time: "4s", label: "Final alignment", frame: 97 },
  { time: "5s", label: "Connected", frame: 120 },
];

interface Reason {
  title: string;
  detail: string;
  spotX: string;
  spotY: string;
}

const REASONS: readonly Reason[] = [
  { title: "Decades of proven expertise", detail: "Experience that reads the problem before the shovel goes in.", spotX: "50%", spotY: "72%" },
  { title: "True 24/7 emergency response", detail: "Leaks and gas issues keep no schedule. Call any hour: " + T.business.phoneDisplay + ".", spotX: "50%", spotY: "34%" },
  { title: "Advanced, non-invasive solutions", detail: "Locate first, then repair only what has to open, so less of your property is torn up.", spotX: "16%", spotY: "68%" },
  { title: "Honest, residential-focused service", detail: "Homes only. Plain answers on what is wrong and what the fix takes.", spotX: "74%", spotY: "14%" },
];

const HERO_TITLE = "Plumbing and gas line work, done right.";

const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "#services", label: "Services" },
  { href: "#triage", label: "Is It Urgent?" },
  { href: "#why", label: "Why Us" },
  { href: "#jobs", label: "Job Files" },
  { href: "#faq", label: "FAQ" },
  { href: "#areas", label: "Areas" },
];

/* ==========================================================================
   STYLES: one template literal. Every rule references the :root variables.
   ========================================================================== */
const mq = `${T.bp.mobile - 1}px`;
const wide = `${T.bp.wide}px`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');

:root {
  --c-bg: ${T.color.bg}; --c-bg-deep: ${T.color.bgDeep}; --c-paper: ${T.color.paper};
  --c-brand: ${T.color.brand}; --c-brand-dark: ${T.color.brandDark};
  --c-ink: ${T.color.ink}; --c-ink-soft: ${T.color.inkSoft}; --c-line: ${T.color.line};
  --c-glass-light: ${T.color.glassLight}; --c-glass-dark: ${T.color.glassDark}; --c-glass-edge: ${T.color.glassEdge};
  --c-on-dark: ${T.color.onDark}; --c-on-dark-soft: ${T.color.onDarkSoft};
  --c-call: ${T.color.call}; --c-scrim: ${T.color.scrim};
  --s-xs: ${T.space.xs}; --s-sm: ${T.space.sm}; --s-md: ${T.space.md}; --s-lg: ${T.space.lg};
  --s-xl: ${T.space.xl}; --s-xxl: ${T.space.xxl}; --s-section: ${T.space.section};
  --r-sm: ${T.radius.sm}; --r-md: ${T.radius.md}; --r-lg: ${T.radius.lg};
  --f-display: ${T.font.display}; --f-body: ${T.font.body};
  --t-xs: ${T.size.xs}; --t-sm: ${T.size.sm}; --t-md: ${T.size.md}; --t-lg: ${T.size.lg};
  --t-xl: ${T.size.xl}; --t-xxl: ${T.size.xxl}; --t-mega: ${T.size.mega};
  --max: ${T.layout.max}; --gutter: ${T.layout.gutter}; --header-h: ${T.layout.header};
  --callbar-h: ${T.layout.callBar}; --protrude: ${T.layout.protrude};
  --ease: ${T.motion.ease}; --dur-fast: ${T.motion.fast}; --dur-base: ${T.motion.base};
  --hero-run: ${T.hero.runDesktop};
  --shadow-1: 0 1px 2px rgba(24, 46, 111, 0.08), 0 0 0 1px var(--c-line);
}

@media (max-width: ${mq}) {
  :root {
    --t-xs: ${T.sizeMobile.xs}; --t-sm: ${T.sizeMobile.sm}; --t-md: ${T.sizeMobile.md}; --t-lg: ${T.sizeMobile.lg};
    --t-xl: ${T.sizeMobile.xl}; --t-xxl: ${T.sizeMobile.xxl}; --t-mega: ${T.sizeMobile.mega};
    --header-h: 56px; --hero-run: ${T.hero.runMobile};
  }
}

@media (min-width: ${wide}) {
  :root { --max: ${T.layout.maxWide}; }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; scroll-padding-top: var(--header-h); -webkit-text-size-adjust: 100%; }
body {
  background: var(--c-bg); color: var(--c-ink); font-family: var(--f-body); font-size: var(--t-md);
  line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
@media (max-width: ${mq}) { body { padding-bottom: calc(var(--callbar-h) + env(safe-area-inset-bottom)); } }
a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; color: inherit; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 3px solid var(--c-call); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; } }

.wrap { width: 100%; max-width: var(--max); margin-inline: auto; padding-inline: var(--gutter); }
.section { padding-block: var(--s-section); }
.eyebrow { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-ink-soft); }
.h2 { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; letter-spacing: -0.02em; color: var(--c-brand); margin-top: var(--s-sm); }


/* ---------- Header ---------- */
.header {
  position: fixed; inset: 0 0 auto 0; z-index: 50; height: var(--header-h);
  background: rgba(217, 230, 245, 0.82); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--c-line);
}
.header__row { height: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--s-lg); }
.logo { display: inline-flex; align-items: center; gap: var(--s-xs); color: var(--c-brand); font-family: var(--f-display); font-weight: 700; font-size: var(--t-lg); letter-spacing: -0.01em; }
.logo svg { width: 1.5em; height: 1.5em; flex: none; }
.logo__img { height: 40px; width: auto; max-width: 220px; object-fit: contain; }
.logo__img--light { filter: brightness(0) invert(1); height: 52px; }
@media (max-width: ${mq}) { .logo__img { height: 34px; } }
.nav { display: flex; gap: var(--s-lg); font-size: var(--t-sm); font-weight: 500; color: var(--c-ink-soft); }
.nav a { padding-block: var(--s-xs); border-bottom: 2px solid transparent; transition: color var(--dur-fast), border-color var(--dur-fast); }
.nav a:hover { color: var(--c-brand); border-color: var(--c-brand); }
.call-btn {
  display: inline-flex; align-items: center; gap: var(--s-xs); padding: var(--s-sm) var(--s-lg); border-radius: var(--r-sm);
  background: var(--c-call); color: var(--c-ink); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.02em;
  box-shadow: 0 1px 2px rgba(11, 22, 51, 0.25); transition: transform var(--dur-fast) var(--ease), background var(--dur-fast);
}
.call-btn:hover { transform: translateY(-1px); background: #ff7a2e; }
@media (max-width: ${mq}) { .nav, .header .call-btn { display: none; } }

/* ---------- Mobile call bar ---------- */
.callbar { display: none; }
@media (max-width: ${mq}) {
  .callbar {
    display: flex; align-items: center; justify-content: center; position: fixed; inset: auto 0 0 0; z-index: 60;
    min-height: calc(var(--callbar-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);
    background: var(--c-call); color: var(--c-ink); font-family: var(--f-display); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em;
  }
}

/* ---------- Hero (scroll-scrubbed frame sequence) ---------- */
.hero { position: relative; height: var(--hero-run); }
.hero__stick { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; background: var(--c-brand-dark) url(${frameUrl(1)}) center / cover no-repeat; }
.hero__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hero__missing { position: absolute; z-index: 5; inset: calc(var(--header-h) + var(--s-md)) var(--gutter) auto var(--gutter); padding: var(--s-md); border-radius: var(--r-md); background: var(--c-call); color: var(--c-ink); font-weight: 700; font-size: var(--t-sm); }
.hero__scrim { position: absolute; inset: 0; pointer-events: none; background:
  linear-gradient(90deg, var(--c-scrim) 0%, rgba(8, 17, 44, 0.35) 48%, rgba(8, 17, 44, 0.1) 100%),
  linear-gradient(0deg, rgba(8, 17, 44, 0.6) 0%, rgba(8, 17, 44, 0) 45%); }
.hero__layout {
  position: absolute; inset: 0; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.8fr); gap: var(--s-xl);
  align-items: end; padding: calc(var(--header-h) + var(--s-xl)) var(--gutter) var(--s-xxl);
  max-width: var(--max); margin-inline: auto; width: 100%; color: var(--c-on-dark);
}
.hero__copy { display: grid; gap: var(--s-md); align-self: end; }
.hero__copy .eyebrow { color: var(--c-on-dark-soft); }
.hero__title { font-family: var(--f-display); font-weight: 700; font-size: var(--t-mega); line-height: 0.95; letter-spacing: -0.03em; max-width: 13ch; }
.hero__word { display: inline-block; margin-right: 0.24em; }
.hero__phone { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); letter-spacing: -0.02em; line-height: 1; width: fit-content; border-bottom: 3px solid var(--c-call); padding-bottom: var(--s-xs); transition: color var(--dur-fast); }
.hero__phone:hover { color: var(--c-call); }
.hero__side { align-self: center; }

.glass {
  position: relative; background: linear-gradient(140deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.06));
  -webkit-backdrop-filter: blur(20px) saturate(1.5); backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--c-glass-edge); border-radius: var(--r-lg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(255, 255, 255, 0.1), 0 1px 2px rgba(8, 17, 44, 0.3);
}
.glass::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(120% 60% at 0% 0%, rgba(255, 255, 255, 0.28), transparent 55%); }

.form { padding: var(--s-lg); display: grid; gap: var(--s-md); }
.form__title { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; }
.form__sub { font-size: var(--t-sm); color: var(--c-on-dark-soft); margin-top: calc(var(--s-xs) * -0.5); }
.field { display: grid; gap: 0.35rem; position: relative; }
.field label { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-on-dark-soft); }
.field input, .field select {
  width: 100%; min-height: 46px; padding: 0 var(--s-md); border-radius: var(--r-md); border: 1px solid var(--c-glass-edge);
  background: rgba(8, 17, 44, 0.28); color: var(--c-on-dark); font-size: var(--t-md); transition: border-color var(--dur-fast), background var(--dur-fast);
}
.field input::placeholder { color: rgba(244, 248, 255, 0.5); }
.field input:focus, .field select:focus { outline: none; border-color: #fff; background: rgba(8, 17, 44, 0.45); }
.field select option { color: var(--c-ink); }
.field--pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-sm); }
.submit {
  min-height: 50px; border: 0; border-radius: var(--r-md); cursor: pointer; background: var(--c-call); color: var(--c-ink);
  font-weight: 700; font-size: var(--t-md); letter-spacing: 0.02em; transition: transform var(--dur-fast) var(--ease), background var(--dur-fast);
}
.submit:hover:not(:disabled) { transform: translateY(-1px); background: #ff7a2e; }
.submit:disabled { opacity: 0.7; cursor: progress; }
.form__note { font-size: var(--t-sm); color: var(--c-on-dark-soft); }
.form__note a { color: var(--c-on-dark); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.form__status { font-size: var(--t-sm); font-weight: 700; }

.meter { position: absolute; inset: auto var(--gutter) var(--s-lg) var(--gutter); max-width: var(--max); margin-inline: auto; display: grid; gap: var(--s-xs); color: var(--c-on-dark); pointer-events: none; }
.meter__row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-md); font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.meter__stage { font-variant-numeric: tabular-nums; }
.meter__hint { color: var(--c-on-dark-soft); }
.meter__track { height: 2px; background: rgba(255, 255, 255, 0.28); overflow: hidden; }
.meter__bar { height: 100%; background: var(--c-call); transform-origin: left center; }

@media (max-width: ${mq}) {
  .hero__scrim { background: linear-gradient(180deg, rgba(8, 17, 44, 0.72) 0%, rgba(8, 17, 44, 0.1) 38%, rgba(8, 17, 44, 0.1) 52%, rgba(8, 17, 44, 0.78) 100%); }
  .hero__layout { grid-template-columns: 1fr; align-content: space-between; align-items: start; gap: var(--s-md); padding: calc(var(--header-h) + var(--s-md)) var(--gutter) calc(var(--callbar-h) + var(--s-xl) + env(safe-area-inset-bottom)); }
  .hero__copy { gap: var(--s-xs); align-self: start; }
  .hero__title { max-width: 15ch; line-height: 1; }
  .hero__phone { display: none; }
  .hero__side { align-self: end; }
  .form { padding: var(--s-md); gap: var(--s-sm); }
  .form__sub, .form__note, .field label { display: none; }
  .field input, .field select { min-height: 44px; }
  .meter { inset: auto var(--gutter) calc(var(--callbar-h) + var(--s-sm) + env(safe-area-inset-bottom)) var(--gutter); }
  .meter__hint { display: none; }
}

/* ---------- Cards ---------- */
.card { background: var(--c-glass-light); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-radius: var(--r-md); box-shadow: var(--shadow-1); }

/* ---------- Stats strip ---------- */
.stats { border-block: 1px solid var(--c-line); background: var(--c-paper); }
.stats__row { display: grid; grid-template-columns: repeat(3, 1fr); }
.stat { padding: var(--s-lg) var(--s-md); display: grid; gap: 2px; }
.stat + .stat { border-left: 1px solid var(--c-line); }
.stat__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; color: var(--c-brand); font-variant-numeric: tabular-nums; }
.stat__l { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-ink-soft); }

/* ---------- Services (bento with cursor spotlight) ---------- */
.spot { position: relative; overflow: hidden; --mx: 50%; --my: 50%; }
.spot::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity var(--dur-base); background: radial-gradient(260px circle at var(--mx) var(--my), rgba(24, 46, 111, 0.16), transparent 70%); }
.spot:hover::after { opacity: 1; }
.services__head { display: grid; gap: var(--s-sm); max-width: 44rem; margin-bottom: var(--s-xl); }
.services__lede { color: var(--c-ink-soft); font-size: var(--t-lg); }
.services__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); list-style: none; }
.service { display: grid; grid-template-rows: auto 1fr; transition: transform var(--dur-base) var(--ease); }
.service:hover { transform: translateY(-3px); }
.service__media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: var(--c-bg-deep); }
.service__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 700ms var(--ease); }
.service:hover .service__media img { transform: scale(1.05); }
.service__art { width: 100%; height: 100%; display: grid; place-items: center; background: linear-gradient(140deg, var(--c-brand) 0%, #2a4aa3 100%); color: var(--c-on-dark); }
.service__art svg { width: 38%; height: auto; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.service__body { display: grid; gap: var(--s-sm); padding: var(--s-md) var(--s-lg) var(--s-lg); align-content: start; }
.service__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xs); color: var(--c-ink-soft); letter-spacing: 0.14em; }
.service__t { font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.15; color: var(--c-brand); }
@media (max-width: 1024px) { .services__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: ${mq}) {
  .services__grid { grid-template-columns: 1fr; gap: var(--s-sm); }
  .service { grid-template-rows: none; grid-template-columns: 96px 1fr; align-items: stretch; }
  .service__media { aspect-ratio: auto; min-height: 88px; }
  .service__body { padding: var(--s-sm) var(--s-md); align-content: center; gap: 2px; }
  .service:hover { transform: none; }
  .service:hover .service__media img { transform: none; }
  .spot::after { display: none; }
}

/* ---------- Badges + social ---------- */
.badges__grid { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); margin-top: var(--s-xl); }
.badge { display: grid; place-items: center; min-height: 128px; padding: var(--s-md); transition: transform var(--dur-base) var(--ease); }
.badge:hover { transform: translateY(-2px); }
.badge img { width: auto; max-width: 100%; max-height: 84px; object-fit: contain; }
.badge--wide img { max-height: 64px; }
.badges__social { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-md); margin-top: var(--s-xl); }
.badges__social p { font-weight: 500; color: var(--c-ink-soft); margin-right: var(--s-sm); }
.social { display: inline-flex; align-items: center; gap: var(--s-sm); padding: var(--s-sm) var(--s-lg) var(--s-sm) var(--s-md); border-radius: var(--r-md); background: var(--c-glass-light); box-shadow: var(--shadow-1); font-weight: 700; font-size: var(--t-sm); color: var(--c-brand); transition: transform var(--dur-fast) var(--ease); }
.social:hover { transform: translateY(-2px); }
.social svg { width: 22px; height: 22px; flex: none; }
.footer__social { display: flex; gap: var(--s-sm); margin-top: var(--s-md); }
.footer__social a { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.24); transition: background var(--dur-fast); }
.footer__social a:hover { background: rgba(255, 255, 255, 0.24); }
.footer__social svg { width: 18px; height: 18px; }
@media (max-width: 1024px) { .badges__grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: ${mq}) { .badges__grid { grid-template-columns: repeat(2, 1fr); gap: var(--s-sm); } .badge { min-height: 96px; } .badge img { max-height: 64px; } .badge:hover { transform: none; } }

/* ---------- Exit intent ---------- */
.exit { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: var(--s-lg); background: rgba(8, 17, 44, 0.62); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.exit__card { position: relative; width: min(520px, 100%); padding: var(--s-xxl) var(--s-xl) var(--s-xl); color: var(--c-on-dark); text-align: left; background: linear-gradient(150deg, rgba(24, 46, 111, 0.96), rgba(14, 29, 74, 0.96)); }
.exit__line { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.1; letter-spacing: -0.01em; }
.exit__call { display: block; margin-top: var(--s-lg); padding: var(--s-md) var(--s-lg); border-radius: var(--r-md); background: var(--c-call); color: var(--c-ink); text-align: center; white-space: nowrap; font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); letter-spacing: -0.01em; transition: transform var(--dur-fast) var(--ease); }
.exit__call:hover { transform: translateY(-2px); }
.exit__close { position: absolute; top: var(--s-sm); right: var(--s-sm); width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c-glass-edge); background: rgba(255, 255, 255, 0.1); cursor: pointer; color: var(--c-on-dark); font-size: var(--t-lg); line-height: 1; }
.exit__close:hover { background: rgba(255, 255, 255, 0.2); }

/* ---------- Process (video background section) ---------- */
.process { position: relative; isolation: isolate; overflow: hidden; display: grid; align-items: center; min-height: min(100vh, 880px); padding-block: var(--s-section); color: var(--c-on-dark); background: var(--c-brand-dark); }
.process__bg { position: absolute; inset: 0; z-index: -2; overflow: hidden; pointer-events: none; transform: scale(1.04); filter: saturate(0.5) brightness(0.78) blur(1.5px); background: var(--c-brand-dark) url(/video/section-poster.jpg) center / cover no-repeat; }
.process__bg wistia-player { position: absolute; top: 50%; left: 50%; width: var(--bgw, 100%); height: calc(var(--bgw, 100%) * 9 / 16); transform: translate(-50%, -50%); display: block; }
.process__bg wistia-player:not(:defined) { background: center / cover no-repeat url('https://fast.wistia.com/embed/medias/${T.business.wistia.mediaId}/swatch'); filter: blur(5px); }
.process__shade { position: absolute; inset: 0; z-index: -1; background:
  radial-gradient(120% 90% at 50% 50%, rgba(5, 10, 30, 0) 30%, rgba(5, 10, 30, 0.7) 100%),
  linear-gradient(100deg, rgba(5, 10, 30, 0.95) 0%, rgba(8, 17, 44, 0.84) 45%, rgba(8, 17, 44, 0.58) 100%),
  linear-gradient(0deg, rgba(5, 10, 30, 0.85) 0%, rgba(5, 10, 30, 0) 50%); }
.process .eyebrow { color: var(--c-on-dark-soft); }
.process__title { margin-top: var(--s-sm); max-width: 16ch; font-family: var(--f-display); font-weight: 700; font-size: var(--t-mega); line-height: 0.98; letter-spacing: -0.03em; }
.process__steps { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); margin-top: var(--s-xxl); }
.step { padding: var(--s-lg); display: grid; gap: var(--s-sm); align-content: start; min-height: 230px; }
.step__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; color: transparent; -webkit-text-stroke: 1.5px var(--c-call); }
.step__t { font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.15; }
.step__b { font-size: var(--t-sm); color: var(--c-on-dark-soft); }
.process__cta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-lg); margin-top: var(--s-xl); }
.process__facts { list-style: none; display: flex; flex-wrap: wrap; gap: var(--s-xs) var(--s-lg); font-size: var(--t-sm); }
.process__facts span { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-on-dark-soft); margin-right: var(--s-xs); }
@media (max-width: 1024px) { .process__steps { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: ${mq}) {
  .process { min-height: 0; }
  .process__shade { background: linear-gradient(180deg, rgba(8, 17, 44, 0.92) 0%, rgba(8, 17, 44, 0.8) 100%); }
  .process__steps { grid-template-columns: 1fr; gap: var(--s-sm); margin-top: var(--s-xl); }
  .step { min-height: 0; grid-template-columns: auto 1fr; column-gap: var(--s-md); padding: var(--s-md); }
  .step__n { grid-row: span 2; font-size: var(--t-xl); }
}

/* ---------- Triage ---------- */
.triage__grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: var(--s-lg); margin-top: var(--s-xl); align-items: stretch; }
.triage__list { list-style: none; display: grid; gap: var(--s-xs); align-content: start; }
.triage__btn { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--s-md); text-align: left; cursor: pointer; border: 0; padding: var(--s-md) var(--s-lg); min-height: 56px; border-radius: var(--r-md); background: var(--c-glass-light); box-shadow: var(--shadow-1); font-weight: 500; transition: background var(--dur-fast), color var(--dur-fast), transform var(--dur-fast) var(--ease); }
.triage__btn:hover { transform: translateX(3px); }
.triage__btn[aria-pressed="true"] { background: var(--c-brand); color: var(--c-on-dark); }
.triage__result { position: relative; display: grid; align-content: space-between; gap: var(--s-lg); padding: var(--s-xl); min-height: 320px; border-radius: var(--r-lg); background: var(--c-brand); color: var(--c-on-dark); overflow: hidden; box-shadow: var(--shadow-1); }
.triage__result::before { content: ""; position: absolute; inset: -40% -20% auto auto; width: 70%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 65%); pointer-events: none; }
.pill { width: fit-content; padding: 0.3rem 0.7rem; border-radius: 999px; font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; background: rgba(255, 255, 255, 0.16); border: 1px solid var(--c-glass-edge); }
.pill--now { background: var(--c-call); color: var(--c-ink); border-color: transparent; }
.triage__head { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; margin-top: var(--s-sm); }
.triage__advice { margin-top: var(--s-sm); font-size: var(--t-lg); color: var(--c-on-dark-soft); max-width: 34rem; }
@media (max-width: 1024px) { .triage__grid { grid-template-columns: 1fr; } }
@media (max-width: ${mq}) { .triage__result { padding: var(--s-lg); min-height: 0; } .triage__btn:hover { transform: none; } }

/* ---------- FAQ ---------- */
.faq__list { list-style: none; margin-top: var(--s-xl); border-top: 1px solid var(--c-line); max-width: 60rem; }
.faq__item { border-bottom: 1px solid var(--c-line); }
.faq__q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--s-lg); padding: var(--s-lg) 0; text-align: left; background: none; border: 0; cursor: pointer; font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.2; color: var(--c-brand); }
.faq__icon { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c-line); font-size: var(--t-lg); transition: transform var(--dur-base) var(--ease), background var(--dur-fast); }
.faq__q[aria-expanded="true"] .faq__icon { transform: rotate(45deg); background: var(--c-glass-light); }
.faq__a { overflow: hidden; }
.faq__a p { padding: 0 var(--s-xxl) var(--s-lg) 0; color: var(--c-ink-soft); font-size: var(--t-md); max-width: 46rem; }
@media (max-width: ${mq}) { .faq__a p { padding-right: 0; } }

/* ---------- Why us ---------- */
.why { background: var(--c-bg-deep); }
.why__head { margin-bottom: var(--s-xl); }
.why__stage { position: relative; width: min(100%, calc(1200px + var(--protrude) * 2)); margin-inline: auto; padding-inline: var(--protrude); }
.why__frame { position: relative; aspect-ratio: 4 / 3; }
.why__image { position: absolute; inset: 0; isolation: isolate; overflow: hidden; border-radius: var(--r-md); box-shadow: var(--shadow-1); background: var(--c-brand-dark); }
.why__image img { width: 100%; height: 100%; object-fit: cover; }
.why__spot { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px solid #fff; background: rgba(242, 107, 29, 0.85); box-shadow: 0 0 0 0 rgba(242, 107, 29, 0.55); animation: pulse 2s ease-out infinite; }
@keyframes pulse { to { box-shadow: 0 0 0 18px rgba(242, 107, 29, 0); } }
.why__caption { position: absolute; inset: auto var(--s-lg) var(--s-lg) var(--s-lg); max-width: 28rem; padding: var(--s-md) var(--s-lg); color: var(--c-on-dark); font-size: var(--t-md); }
.why__list { list-style: none; }
.why__list li { display: contents; }
.why__btn {
  position: absolute; width: min(320px, 34%); display: flex; align-items: center; justify-content: space-between; gap: var(--s-md); text-align: left; cursor: pointer;
  padding: var(--s-md) var(--s-lg); min-height: 76px; border-radius: var(--r-md); border: 1px solid var(--c-glass-edge);
  background: var(--c-glass-light); -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), var(--shadow-1); color: var(--c-brand);
  font-family: var(--f-display); font-weight: 700; font-size: var(--t-md); line-height: 1.1; letter-spacing: 0.02em; text-transform: uppercase;
  transition: transform var(--dur-base) var(--ease), background var(--dur-fast), color var(--dur-fast);
}
.why__btn:hover { transform: translateX(var(--nudge)); }
.why__btn[aria-pressed="true"] { background: var(--c-brand); color: var(--c-on-dark); border-color: var(--c-brand); }
.why__btn--l { left: calc(var(--protrude) * -1); --nudge: 8px; }
.why__btn--r { right: calc(var(--protrude) * -1); --nudge: -8px; }
.why__list li:nth-child(1) .why__btn { top: 8%; } .why__list li:nth-child(2) .why__btn { top: 30%; } .why__list li:nth-child(3) .why__btn { top: 54%; } .why__list li:nth-child(4) .why__btn { top: 76%; }
.why__idx { font-size: var(--t-xs); letter-spacing: 0.1em; opacity: 0.7; }
.why__detail { display: none; font-family: var(--f-body); font-weight: 400; text-transform: none; letter-spacing: 0; font-size: var(--t-sm); margin-top: var(--s-xs); opacity: 0.85; }
@media (max-width: ${mq}) {
  .why__stage { padding-inline: var(--gutter); }
  .why__frame { aspect-ratio: auto; }
  .why__image, .why__caption { display: none; }
  .why__list { display: grid; gap: var(--s-sm); }
  .why__btn { position: static; width: 100%; min-height: 0; align-items: flex-start; flex-direction: column; gap: 0; }
  .why__btn:hover { transform: none; }
  .why__detail { display: block; }
}

/* ---------- Job files (comparator + two-frame comparison) ---------- */
.jobs__stage { margin-top: var(--s-xl); }
.compare { position: relative; aspect-ratio: 16 / 9; border-radius: var(--r-md); overflow: hidden; background: var(--c-brand-dark); box-shadow: var(--shadow-1); touch-action: pan-y; user-select: none; }
.compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.photo-missing { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: var(--s-lg); text-align: center; background: var(--c-brand-dark); color: var(--c-on-dark-soft); font-size: var(--t-sm); }
.compare__tag { position: absolute; top: var(--s-md); padding: var(--s-xs) var(--s-sm); border-radius: var(--r-sm); font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-on-dark); background: rgba(8, 17, 44, 0.6); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.compare__tag--l { left: var(--s-md); } .compare__tag--r { right: var(--s-md); }
.compare__handle { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #fff; pointer-events: none; }
.compare__handle::after { content: "\\2194"; position: absolute; top: 50%; left: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; display: grid; place-items: center; border-radius: 50%; background: var(--c-glass-light); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: var(--c-brand); font-weight: 700; box-shadow: var(--shadow-1); }
.compare__range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }
.compare:focus-within { outline: 3px solid var(--c-call); outline-offset: 3px; }
.jobs__note { margin-top: var(--s-md); font-size: var(--t-sm); color: var(--c-ink-soft); }
@media (max-width: ${mq}) {
  .compare { aspect-ratio: 4 / 5; margin-inline: calc(var(--gutter) * -1); border-radius: 0; }
}

/* ---------- Areas ---------- */
.marquee { overflow: hidden; margin-top: var(--s-xl); -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.marquee__track { display: flex; width: max-content; animation: marquee 48s linear infinite; }
.marquee:hover .marquee__track { animation-play-state: paused; }
.marquee__list { list-style: none; display: flex; flex: none; font-family: var(--f-display); font-weight: 500; font-size: var(--t-xxl); line-height: 1.2; color: var(--c-brand); }
.marquee__list li { padding-right: var(--s-xl); white-space: nowrap; }
.marquee__list li::after { content: "\\2022"; margin-left: var(--s-xl); color: var(--c-call); }
@keyframes marquee { to { transform: translateX(-50%); } }
.areas__cta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-lg); margin-top: var(--s-xl); }
.areas__addr { color: var(--c-ink-soft); font-size: var(--t-sm); }

/* ---------- Footer ---------- */
.footer { background: var(--c-brand); color: var(--c-on-dark); padding-block: var(--s-xl) var(--s-lg); }
.footer__row { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--s-lg); }
.footer .logo { color: var(--c-on-dark); font-size: var(--t-xl); }
.footer__addr { margin-top: var(--s-xs); color: var(--c-on-dark-soft); font-size: var(--t-sm); }
.footer__phone { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); letter-spacing: -0.01em; }
.footer__phone:hover { color: var(--c-call); }
.footer__legal { margin-top: var(--s-xl); padding-top: var(--s-md); border-top: 1px solid rgba(255, 255, 255, 0.18); font-size: 11px; color: var(--c-on-dark-soft); }
`;

/* ==========================================================================
   LOGO (SVG placeholder wordmark in the brand colour; swap for the real asset)
   ========================================================================== */
function Logo({ onDark = false }: { onDark?: boolean }) {
  const [candidate, setCandidate] = useState<number>(0);
  const src = T.business.logoCandidates[candidate];
  return (
    <a className="logo" href="#top" aria-label={`${T.business.name} home`}>
      {src === undefined ? (
        <>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path fill="currentColor" d="M16 2C16 2 6 14 6 20a10 10 0 0 0 20 0C26 14 16 2 16 2z" />
          </svg>
          <span>{T.business.name}</span>
        </>
      ) : (
        <img
          className={`logo__img ${onDark ? "logo__img--light" : ""}`}
          src={src}
          alt={T.business.name}
          height={44}
          onError={() => setCandidate((n) => n + 1)}
        />
      )}
    </a>
  );
}

/* ==========================================================================
   VIDEO SCROLL ENGINE: preloads the frame sequence, scrubs it to scroll position.
   Owns the canvas ref, useScroll, and the derived spring / stage values.
   ========================================================================== */
type FramesStatus = "loading" | "ok" | "missing";
const FramesContext = createContext<FramesStatus>("loading");

interface EngineValues {
  progress: MotionValue<number>;
  stage: MotionValue<number>;
}

interface VideoScrollEngineProps {
  onStatus: (status: FramesStatus) => void;
  children: (values: EngineValues) => ReactNode;
}

function VideoScrollEngine({ onStatus, children }: VideoScrollEngineProps) {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastDrawn = useRef<number>(-1);
  const loadedFlags = useRef<boolean[]>([]);
  const [settled, setSettled] = useState<number>(0);
  const [failed, setFailed] = useState<number>(0);
  const ready = settled >= T.frames.count;

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, T.spring);
  const progressRef = useRef<MotionValue<number>>(progress);
  progressRef.current = progress;
  const stage = useTransform(progress, (v) => Math.min(STAGES.length - 1, Math.max(0, Math.floor(v * STAGES.length))));

  const indexFor = (v: number): number => Math.min(T.frames.count - 1, Math.max(0, Math.round(v * (T.frames.count - 1))));

  // "Cover" draw: fills the canvas at any aspect ratio, centred on the focal point.
  // While frames are still arriving it shows the nearest frame that has loaded, so there is never a blank screen.
  const draw = useCallback((target: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let index = -1;
    for (let d = 0; d < T.frames.count && index < 0; d += 1) {
      if (loadedFlags.current[target - d]) index = target - d;
      else if (loadedFlags.current[target + d]) index = target + d;
    }
    const image = imagesRef.current[index];
    if (!image || image.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, (canvas.width - w) * T.focal.x, (canvas.height - h) * T.focal.y, w, h);
    lastDrawn.current = target;
  }, []);

  // Load frames in the background. No loading screen: the first frame is also the CSS background, and scrolling is never blocked.
  useEffect(() => {
    let cancelled = false;
    const images = Array.from({ length: T.frames.count }, (_, i) => {
      const img = new Image();
      img.decoding = "async";
      if (i === 0) img.fetchPriority = "high";
      img.onload = () => {
        loadedFlags.current[i] = true;
        if (cancelled) return;
        setSettled((n) => n + 1);
        draw(indexFor(progressRef.current.get()));
      };
      img.onerror = () => {
        if (cancelled) return;
        setFailed((n) => n + 1);
        setSettled((n) => n + 1);
      };
      img.src = frameUrl(i + 1);
      return img;
    });
    imagesRef.current = images;
    return () => {
      cancelled = true;
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Keep the canvas pixel buffer matched to its CSS box (capped DPR for performance).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      draw(lastDrawn.current >= 0 ? lastDrawn.current : indexFor(progress.get()));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  useMotionValueEvent(progress, "change", (v) => {
    const index = indexFor(v);
    if (index !== lastDrawn.current) draw(index);
  });

  const framesMissing = ready && failed > T.frames.count / 2;
  useEffect(() => {
    if (!ready) return;
    if (framesMissing) {
      console.error(`Hero frames failed to load. Expected ${T.frames.dir}/${T.frames.prefix}001${T.frames.ext} to ${T.frames.count}.`);
      onStatus("missing");
    } else {
      onStatus("ok");
    }
  }, [ready, framesMissing, onStatus]);

  return (
    <>
      <section className="hero" ref={heroRef} id="top" aria-label="Plumbing connection, from disconnected to connected">
        <div className="hero__stick">
          <canvas className="hero__canvas" ref={canvasRef} aria-hidden="true" />
          <div className="hero__scrim" />
          {framesMissing && (
            <p className="hero__missing" role="alert">
              Hero frames did not load. Check that the folder public{T.frames.dir} was uploaded in full ({T.frames.count} files named {T.frames.prefix}001{T.frames.ext} to {T.frames.prefix}
              {T.frames.count}
              {T.frames.ext}).
            </p>
          )}
          {children({ progress, stage })}
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
   HERO
   ========================================================================== */
interface HeroSectionProps {
  progress: MotionValue<number>;
  stage: MotionValue<number>;
}

function StageReadout({ stage }: { stage: MotionValue<number> }) {
  const [index, setIndex] = useState<number>(stage.get());
  useMotionValueEvent(stage, "change", setIndex);
  const current = STAGES[index] ?? STAGES[0];
  return (
    <span className="meter__stage">
      {current ? `${current.time} · ${current.label}` : ""}
    </span>
  );
}

type FormStatus = "idle" | "sending" | "sent" | "error";

function LeadForm() {
  const [status, setStatus] = useState<FormStatus>("idle");

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      phone: String(data.get("phone") ?? ""),
      service: String(data.get("service") ?? ""),
    };
    setStatus("sending");
    try {
      const response = await fetch(T.business.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <form className="form glass" onSubmit={onSubmit}>
      <div>
        <h2 className="form__title">Get a call back fast</h2>
        <p className="form__sub">Tell us what is going on. We will call you.</p>
      </div>
      <div className="field--pair">
        <div className="field">
          <label htmlFor="lead-name">Name</label>
          <input id="lead-name" name="name" type="text" autoComplete="name" placeholder="Your name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="lead-phone">Phone</label>
          <input id="lead-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="817-000-0000" required pattern="[0-9+()\-\s.]{10,20}" maxLength={40} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="lead-service">Service</label>
        <select id="lead-service" name="service" defaultValue={SERVICES[0]} aria-label="Service needed">
          {SERVICES.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>
      </div>
      <button className="submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Request a call"}
      </button>
      <p className="form__status" role="status" aria-live="polite">
        {status === "sent" && "Received. We will call you shortly."}
        {status === "error" && `Could not send. Please call ${T.business.phoneDisplay}.`}
      </p>
      <p className="form__note">
        Emergency? Call <a href={T.business.phoneHref}>{T.business.phoneDisplay}</a>
      </p>
    </form>
  );
}

function HeroSection({ progress, stage }: HeroSectionProps) {
  const hintOpacity = useTransform(progress, [0, 0.05], [1, 0]);
  return (
    <>
      <div className="hero__layout">
        <div className="hero__copy">
          <p className="eyebrow">{T.business.name} · Fort Worth, TX</p>
          <h1 className="hero__title" aria-label={HERO_TITLE}>
            {HERO_TITLE.split(" ").map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="hero__word"
                aria-hidden="true"
                initial={{ opacity: 0, y: "0.4em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <a className="hero__phone" href={T.business.phoneHref}>
            {T.business.phoneDisplay}
          </a>
        </div>
        <div className="hero__side">
          <LeadForm />
        </div>
      </div>
      <div className="meter" aria-hidden="true">
        <div className="meter__row">
          <StageReadout stage={stage} />
          <motion.span className="meter__hint" style={{ opacity: hintOpacity }}>
            Scroll to connect
          </motion.span>
        </div>
        <div className="meter__track">
          <motion.div className="meter__bar" style={{ scaleX: progress }} />
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
   SERVICES
   ========================================================================== */
function useSpotlight<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const onPointerMove = (event: ReactPointerEvent<E>): void => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };
  return { ref, onPointerMove };
}

const ART_PATHS: readonly ReactNode[] = [
  // gas: flame
  <path key="gas" d="M32 6c2 10 14 16 14 30a14 14 0 0 1-28 0c0-7 4-10 7-14 1 5 4 7 6 8-1-8 0-16 1-24z" />,
  // water / sewer line: two pipes and a coupling
  <g key="line"><path d="M4 24h20v16H4z" /><path d="M40 24h20v16H40z" /><path d="M24 20h16v24H24z" /></g>,
  // repiping: elbows
  <g key="repipe"><path d="M8 10v20a8 8 0 0 0 8 8h12" /><path d="M20 10v16a4 4 0 0 0 4 4h8" /><path d="M36 38h20" /><path d="M32 30h24" /></g>,
  // slab leak: slab and drop
  <g key="slab"><path d="M4 46h56v10H4z" /><path d="M32 8c0 0-10 12-10 20a10 10 0 0 0 20 0c0-8-10-20-10-20z" /></g>,
  // drain: grate
  <g key="drain"><circle cx="32" cy="32" r="24" /><path d="M20 32h24M24 24h16M24 40h16" /></g>,
  // water heater: tank
  <g key="heater"><rect x="16" y="6" width="32" height="48" rx="8" /><path d="M24 54v6M40 54v6" /><path d="M32 24c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6" /></g>,
  // leak detection: magnifier with drop
  <g key="detect"><circle cx="27" cy="27" r="18" /><path d="M40 40l18 18" /><path d="M27 17c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" /></g>,
  // repairs: wrench
  <path key="repair" d="M46 6a14 14 0 0 0-12 19L8 51a5 5 0 0 0 7 7l26-26A14 14 0 0 0 58 18l-9 9-8-2-2-8 9-9z" />,
];

function ServiceCard({ index, title }: { index: number; title: string }) {
  const spotlight = useSpotlight<HTMLLIElement>();
  const slug = SERVICE_SLUGS[index];
  const [photoFailed, setPhotoFailed] = useState<boolean>(false);
  const photo = slug && !photoFailed ? `/services/${slug}.jpg` : undefined;
  return (
    <li className="service card spot" ref={spotlight.ref} onPointerMove={spotlight.onPointerMove}>
      <div className="service__media">
        {photo ? (
          <img src={photo} alt={title} width={640} height={480} loading="lazy" onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="service__art" aria-hidden="true">
            <svg viewBox="0 0 64 64">{ART_PATHS[index]}</svg>
          </div>
        )}
      </div>
      <div className="service__body">
        <span className="service__n">{String(index + 1).padStart(2, "0")}</span>
        <span className="service__t">{title}</span>
      </div>
    </li>
  );
}

function ServicesSection() {
  return (
    <section className="section" id="services">
      <div className="wrap">
        <div className="services__head">
          <p className="eyebrow">Services</p>
          <h2 className="h2">What we fix, find and replace.</h2>
          <p className="services__lede">Residential plumbing and gas line work across the Fort Worth area.</p>
        </div>
        <ul className="services__grid">
          {SERVICES.map((service, i) => (
            <ServiceCard key={service} index={i} title={service} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ==========================================================================
   STATS STRIP (only figures that come from the supplied business details)
   ========================================================================== */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const value = useMotionValue<number>(0);
  const [shown, setShown] = useState<number>(0);
  useMotionValueEvent(value, "change", (v) => setShown(Math.round(v)));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, value]);
  return <span ref={ref}>{shown}</span>;
}

function StatsStrip() {
  return (
    <div className="stats">
      <div className="wrap stats__row">
        <div className="stat">
          <span className="stat__n">24/7</span>
          <span className="stat__l">Emergency response</span>
        </div>
        <div className="stat">
          <span className="stat__n">
            <CountUp to={SERVICE_AREAS.length} />
          </span>
          <span className="stat__l">Cities served</span>
        </div>
        <div className="stat">
          <span className="stat__n">
            <CountUp to={SERVICES.length} />
          </span>
          <span className="stat__l">Core services</span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   TRIAGE: "Is it urgent?" interactive helper
   ========================================================================== */
const LEVEL_LABEL: Record<Triage["level"], string> = { now: "Act now", today: "Call today", soon: "Book a visit" };

function TriageSection() {
  const [active, setActive] = useState<number>(0);
  const item = TRIAGE[active] ?? TRIAGE[0];
  if (!item) return null;
  return (
    <section className="section" id="triage">
      <div className="wrap">
        <p className="eyebrow">Is it urgent?</p>
        <h2 className="h2">Pick what you are seeing.</h2>
        <div className="triage__grid">
          <ul className="triage__list">
            {TRIAGE.map((t, i) => (
              <li key={t.symptom}>
                <button type="button" className="triage__btn" aria-pressed={active === i} onClick={() => setActive(i)}>
                  <span>{t.symptom}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="triage__result" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={item.symptom}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <span className={`pill ${item.level === "now" ? "pill--now" : ""}`}>{LEVEL_LABEL[item.level]}</span>
                <h3 className="triage__head">{item.headline}</h3>
                <p className="triage__advice">{item.advice}</p>
              </motion.div>
            </AnimatePresence>
            <a className="call-btn" href={T.business.phoneHref}>
              Call {T.business.phoneDisplay}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FAQ
   ========================================================================== */
function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <p className="eyebrow">FAQ</p>
        <h2 className="h2">Straight answers.</h2>
        <ul className="faq__list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <li className="faq__item" key={f.q}>
                <button type="button" className="faq__q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span>{f.q}</span>
                  <span className="faq__icon" aria-hidden="true">+</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq__a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ==========================================================================
   WHY CHOOSE US: 1200x900 image (desktop only) with buttons protruding from its edges
   ========================================================================== */
function WhySection() {
  const [whySrc, setWhySrc] = useState<string>("/images/why-1200x900.jpg");
  const [active, setActive] = useState<number>(0);
  const reason = REASONS[active] ?? REASONS[0];
  if (!reason) return null;
  return (
    <section className="section why" id="why">
      <div className="wrap why__head">
        <p className="eyebrow">Why choose us</p>
        <h2 className="h2">Four reasons homeowners call us back.</h2>
      </div>
      <div className="why__stage">
        <div className="why__frame">
          <div className="why__image">
            {whySrc === "" ? (
              <p className="photo-missing">Image not found</p>
            ) : (
              <img
                src="/images/why-1200x900.jpg"
                alt="Completed pipe connection at a home foundation"
                width={1200}
                height={900}
                loading="lazy"
                onError={() => setWhySrc((current) => (current === frameUrl(T.frames.count) ? "" : frameUrl(T.frames.count)))}
              />
            )}
            <motion.span
              className="why__spot"
              initial={false}
              animate={{ left: reason.spotX, top: reason.spotY }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
            />
            <p className="why__caption glass" aria-live="polite">
              {reason.detail}
            </p>
          </div>
          <ul className="why__list">
            {REASONS.map((r, i) => (
              <li key={r.title}>
                <button
                  type="button"
                  className={`why__btn ${i % 2 === 0 ? "why__btn--l" : "why__btn--r"}`}
                  aria-pressed={active === i}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                >
                  <span>
                    {r.title}
                    <span className="why__detail">{r.detail}</span>
                  </span>
                  <span className="why__idx">{String(i + 1).padStart(2, "0")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   JOB FILES: before/after comparator + two-frame comparison
   ========================================================================== */
function JobsSection() {
  const framesStatus = useContext(FramesContext);
  const split = useMotionValue<number>(50);
  const clip = useTransform(split, (v) => `inset(0 ${100 - v}% 0 0)`);
  const handleLeft = useTransform(split, (v) => `${v}%`);
  const first = STAGES[0];
  const last = STAGES[STAGES.length - 1];
  if (!first || !last) return null;

  return (
    <section className="section" id="jobs">
      <div className="wrap">
        <p className="eyebrow">Job files</p>
        <h2 className="h2">From disconnected to connected.</h2>
        <div className="jobs__stage">
          <div className="compare">
            {framesStatus === "missing" && <p className="photo-missing">Images not found in {T.frames.dir}</p>}
            <img src={frameUrl(last.frame)} alt={`Pipe connection at ${last.time}: ${last.label}`} width={1280} height={720} loading="lazy" />
            <motion.img src={frameUrl(first.frame)} alt={`Pipe sections at ${first.time}: ${first.label}`} width={1280} height={720} loading="lazy" style={{ clipPath: clip }} />
            <span className="compare__tag compare__tag--l">Before</span>
            <span className="compare__tag compare__tag--r">After</span>
            <motion.span className="compare__handle" style={{ left: handleLeft }} />
            <input
              className="compare__range"
              type="range"
              min={0}
              max={100}
              step={1}
              defaultValue={50}
              aria-label="Drag to compare before and after"
              onChange={(e) => split.set(Number(e.currentTarget.value))}
            />
          </div>
          <p className="jobs__note">Drag the divider to compare.</p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   PROCESS: looping video background > gradient overlay > substance on top
   ========================================================================== */
function addScriptOnce(src: string, isModule: boolean): void {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement("script");
  el.src = src;
  el.async = true;
  if (isModule) el.type = "module";
  document.head.appendChild(el);
}

function ProcessSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WistiaPlayerElement>(null);
  const inView = useInView(sectionRef, { margin: "120px" });
  const reduceMotion = useReducedMotion();
  const facts = TRUST_FACTS.filter((f) => f.value.trim() !== "");

  // Load Wistia's player and this video's embed script once (same scripts as the Wistia embed code).
  useEffect(() => {
    if (reduceMotion) return;
    addScriptOnce(T.business.wistia.playerSrc, false);
    addScriptOnce(T.business.wistia.embedSrc, true);
  }, [reduceMotion]);

  // "Cover" sizing: scale the 16:9 player so it always fills the section, like object-fit: cover.
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const fit = (): void => {
      const width = Math.max(bg.clientWidth, (bg.clientHeight * 16) / 9);
      bg.style.setProperty("--bgw", `${Math.ceil(width)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(bg);
    return () => observer.disconnect();
  }, []);

  // Play only while on screen (saves battery and bandwidth).
  useEffect(() => {
    if (reduceMotion) return;
    void customElements.whenDefined("wistia-player").then(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        if (inView) void player.play?.();
        else player.pause?.();
      } catch {
        /* player not ready yet: autoplay handles the first start */
      }
    });
  }, [inView, reduceMotion]);

  return (
    <section className="process" id="process" ref={sectionRef} aria-labelledby="process-title">
      <div className="process__bg" ref={bgRef} aria-hidden="true">
        {!reduceMotion && (
          <wistia-player
            ref={playerRef}
            media-id={T.business.wistia.mediaId}
            aspect="1.7777777777777777"
            autoplay="true"
            muted="true"
            silent-autoplay="allow"
            end-video-behavior="loop"
            controls-visible-on-load="false"
            play-bar-control="false"
            play-pause-control="false"
            big-play-button="false"
            volume-control="false"
            fullscreen-control="false"
            settings-control="false"
          />
        )}
      </div>
      <div className="process__shade" />
      <div className="wrap process__inner">
        <p className="eyebrow">What happens when you call</p>
        <h2 className="process__title" id="process-title">
          No guessing. Here is the whole job, start to finish.
        </h2>
        <ol className="process__steps">
          {STEPS.map((step, i) => (
            <motion.li
              className="step glass"
              key={step.n}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="step__n">{step.n}</span>
              <h3 className="step__t">{step.title}</h3>
              <p className="step__b">{step.body}</p>
            </motion.li>
          ))}
        </ol>
        <div className="process__cta">
          <a className="call-btn" href={T.business.phoneHref}>
            Call {T.business.phoneDisplay}
          </a>
          {facts.length > 0 && (
            <ul className="process__facts">
              {facts.map((f) => (
                <li key={f.label}>
                  <span>{f.label}</span> {f.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   SERVICE AREAS
   ========================================================================== */
function AreasSection() {
  return (
    <section className="section why" id="areas">
      <div className="wrap">
        <p className="eyebrow">Service areas</p>
        <h2 className="h2">Serving Fort Worth and nearby.</h2>
        <div className="marquee">
          <div className="marquee__track">
            <ul className="marquee__list">
              {SERVICE_AREAS.map((city) => (
                <li key={city}>{city}, TX</li>
              ))}
            </ul>
            <ul className="marquee__list" aria-hidden="true">
              {SERVICE_AREAS.map((city) => (
                <li key={city}>{city}, TX</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="areas__cta">
          <a className="call-btn" href={T.business.phoneHref}>
            Call {T.business.phoneDisplay}
          </a>
          <p className="areas__addr">{T.business.address}</p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   SOCIAL ICONS, BADGES
   ========================================================================== */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.85v-8.38H7.1V12h3V9.36c0-3 1.8-4.67 4.54-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.51c-1.5 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function BadgesSection() {
  return (
    <section className="section why" id="badges">
      <div className="wrap">
        <p className="eyebrow">Recognition and partners</p>
        <h2 className="h2">Names homeowners already know.</h2>
        <ul className="badges__grid">
          {BADGES.map((badge) => (
            <li className={`badge card ${badge.width / badge.height > 2 ? "badge--wide" : ""}`} key={badge.name}>
              <img src={badge.src} alt={badge.name} width={badge.width} height={badge.height} loading="lazy" />
            </li>
          ))}
        </ul>
        <div className="badges__social">
          <p>Find and review us</p>
          <a className="social" href={T.business.google} target="_blank" rel="noopener noreferrer">
            <GoogleIcon />
            Google reviews
          </a>
          <a className="social" href={T.business.facebook} target="_blank" rel="noopener noreferrer">
            <FacebookIcon />
            Facebook
          </a>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   EXIT INTENT: cursor leaves through the top of the viewport. One line, the number.
   ========================================================================== */
const EXIT_STORAGE_KEY = "cofulent-exit-shown";
const EXIT_MIN_DWELL_MS = 4000;

function ExitIntentPopup() {
  const [open, setOpen] = useState<boolean>(false);
  const mountedAt = useRef<number>(Date.now());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(EXIT_STORAGE_KEY) === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;

    const onLeave = (event: MouseEvent): void => {
      if (event.clientY > 0 || event.relatedTarget !== null) return;
      if (Date.now() - mountedAt.current < EXIT_MIN_DWELL_MS) return;
      setOpen(true);
      try {
        sessionStorage.setItem(EXIT_STORAGE_KEY, "1");
      } catch {
        /* storage unavailable: popup may show again, which is acceptable */
      }
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="exit"
          role="dialog"
          aria-modal="true"
          aria-label="Call Cofulent Solutions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="exit__card glass"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="exit__close" ref={closeRef} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
            <p className="exit__line">Leak, gas smell or no hot water? Call before it gets worse.</p>
            <a className="exit__call" href={T.business.phoneHref}>
              {T.business.phoneDisplay}
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ==========================================================================
   FOOTER, HEADER, MOBILE CALL BAR
   ========================================================================== */
function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__row">
          <div>
            <Logo onDark />
            <p className="footer__addr">{T.business.address}</p>
            <div className="footer__social">
              <a href={T.business.facebook} target="_blank" rel="noopener noreferrer" aria-label="Cofulent Solutions on Facebook">
                <FacebookIcon />
              </a>
              <a href={T.business.google} target="_blank" rel="noopener noreferrer" aria-label="Cofulent Solutions on Google">
                <GoogleIcon />
              </a>
            </div>
          </div>
          <a className="footer__phone" href={T.business.phoneHref}>
            {T.business.phoneDisplay}
          </a>
        </div>
        <p className="footer__legal">© {new Date().getFullYear()} {T.business.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}

function MagneticCall() {
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (event: ReactPointerEvent<HTMLAnchorElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * 0.25);
    y.set((event.clientY - (rect.top + rect.height / 2)) * 0.35);
  };
  const onLeave = (): void => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.a className="call-btn" href={T.business.phoneHref} style={{ x, y }} onPointerMove={onMove} onPointerLeave={onLeave}>
      Call {T.business.phoneDisplay}
    </motion.a>
  );
}

function Header() {
  return (
    <header className="header">
      <div className="wrap header__row">
        <Logo />
        <nav className="nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <MagneticCall />
      </div>
    </header>
  );
}

function MobileCallBar() {
  return (
    <a className="callbar" href={T.business.phoneHref} aria-label={`Tap to call ${T.business.phoneDisplay}`}>
      TAP TO CALL — {T.business.phoneDisplay}
    </a>
  );
}

/* ==========================================================================
   APP
   ========================================================================== */
export default function App() {
  const [framesStatus, setFramesStatus] = useState<FramesStatus>("loading");
  return (
    <FramesContext.Provider value={framesStatus}>
      <style>{CSS}</style>
      <Header />
      <main>
        <VideoScrollEngine onStatus={setFramesStatus}>{({ progress, stage }) => <HeroSection progress={progress} stage={stage} />}</VideoScrollEngine>
        <StatsStrip />
        <ServicesSection />
        <ProcessSection />
        <TriageSection />
        <WhySection />
        <JobsSection />
        <BadgesSection />
        <FaqSection />
        <AreasSection />
      </main>
      <Footer />
      <MobileCallBar />
      <ExitIntentPopup />
    </FramesContext.Provider>
  );
}