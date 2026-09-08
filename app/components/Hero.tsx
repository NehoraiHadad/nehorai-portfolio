'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight, FileText, Brain, Network, Database, Cpu, Sparkles } from 'lucide-react';
import { OpenAILogo, AnthropicLogo, GeminiLogo, N8nLogo, MetaLogo, PythonLogo, VercelLogo, DockerLogo, HuggingFaceLogo } from './TechLogos';
import { InteractiveAgent } from './InteractiveAgent';
import { useDictionary, useDirection } from '@/lib/i18n/provider';
import { EASE_OUT } from '@/lib/motion';
import { TIMELINE } from '@/lib/choreography';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const LATIN_SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!<>-_\\/[]{}cxz=+*^?#';
const HEBREW_SCRAMBLE_CHARS = 'אבגדהוזחטיכלמנסעפצקרשת0123456789!?@#$%';
const HEBREW_CHAR_PATTERN = /[\u0590-\u05FF]/;

const getScrambleChars = (word: string) =>
  HEBREW_CHAR_PATTERN.test(word) ? HEBREW_SCRAMBLE_CHARS : LATIN_SCRAMBLE_CHARS;

// Max full cycles before the scramble & rotator go quiet (2.4)
const MAX_CYCLES = 3;

const ScrambleText = ({ words, isRtl, stopped }: { words: string[]; isRtl: boolean; stopped: boolean }) => {
  const prefersReduced = usePrefersReducedMotion();
  const finalWord = words[words.length - 1] ?? words[0] ?? '';
  const initialWord = words[0] ?? '';
  const [text, setText] = useState(initialWord);
  const [targetWord, setTargetWord] = useState(initialWord);

  useEffect(() => {
    // 2.1 + 2.4: render final state immediately when reduced motion or stopped
    if (prefersReduced || stopped) {
      setText(finalWord);
      setTargetWord(finalWord);
      return;
    }

    if (words.length === 0) {
      return;
    }

    let currentIndex = 0;
    let cycleCount = 0;
    let scrambleInterval: NodeJS.Timeout;
    let cycleInterval: NodeJS.Timeout;
    // 4.8: defer scramble start to requestIdleCallback (fallback: 200ms setTimeout)
    // so it doesn't compete with first-paint work.
    const ricHandle = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(() => { startCycle(); }, { timeout: 2000 })
      : setTimeout(() => { startCycle(); }, 200);

    function startCycle() {
    cycleInterval = setInterval(() => {
      if (cycleCount >= MAX_CYCLES * words.length) {
        clearInterval(cycleInterval);
        clearInterval(scrambleInterval);
        setText(finalWord);
        setTargetWord(finalWord);
        return;
      }

      currentIndex = (currentIndex + 1) % words.length;
      cycleCount++;
      const nextWord = words[currentIndex];
      setTargetWord(nextWord);
      let iteration = 0;

      clearInterval(scrambleInterval);
      const scrambleChars = getScrambleChars(nextWord);

      scrambleInterval = setInterval(() => {
        setText(nextWord.split('').map((char, index) => {
          if (index < Math.floor(iteration)) {
            return nextWord[index];
          }
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }).join(''));

        if (iteration >= nextWord.length) {
          clearInterval(scrambleInterval);
          setText(nextWord);
        }

        iteration += 1 / 3;
      }, 30);

    }, 4000);
    } // end startCycle

    return () => {
      if (typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(ricHandle as number);
      } else {
        clearTimeout(ricHandle as NodeJS.Timeout);
      }
      clearInterval(cycleInterval);
      clearInterval(scrambleInterval);
    };
  }, [words, prefersReduced, stopped, finalWord]);

  return (
    <span className="relative inline-block whitespace-nowrap" aria-hidden="true">
      {/* Invisible target word dictates the container width, preventing layout shifts */}
      <span className="invisible">{targetWord}</span>
      {/* Absolutely positioned scrambling text doesn't affect document flow */}
      <span
        className="absolute top-0 text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-pale)] to-[var(--accent-ice)]"
        style={{ insetInlineStart: 0, textAlign: isRtl ? 'right' : 'left' }}
      >
        {text}
      </span>
    </span>
  );
};

const HeroStatusLabel = ({ labels, stopped }: { labels: string[]; stopped: boolean }) => {
  const prefersReduced = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const longestLabel = labels.reduce((longest, label) => (
    label.length > longest.length ? label : longest
  ), labels[0] ?? '');

  useEffect(() => {
    // 2.1 + 2.4: no rotation when reduced motion or after attention budget exhausted
    if (prefersReduced || stopped || labels.length < 2) {
      return;
    }

    let count = 0;
    let rotationTimer: NodeJS.Timeout;
    // 4.8: defer status rotator start to requestIdleCallback (fallback: 200ms setTimeout)
    const ricHandle = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(() => { startRotation(); }, { timeout: 2000 })
      : setTimeout(() => { startRotation(); }, 200);

    function startRotation() {
      // 2.4: ~6s interval — synced to the 4s scramble + 2s buffer so only one
      // attention event fires at a time.
      rotationTimer = setInterval(() => {
        count++;
        if (count >= MAX_CYCLES * labels.length) {
          clearInterval(rotationTimer);
          return;
        }
        setActiveIndex((currentIndex) => (currentIndex + 1) % labels.length);
      }, 6000);
    }

    return () => {
      if (typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(ricHandle as number);
      } else {
        clearTimeout(ricHandle as NodeJS.Timeout);
      }
      clearInterval(rotationTimer);
    };
  }, [labels, prefersReduced, stopped]);

  const activeLabel = labels[activeIndex % labels.length] ?? longestLabel;

  return (
    <span className="relative inline-grid items-center whitespace-nowrap">
      {/* sr-only static phrase for screen readers (WCAG 2.2.2) */}
      <span className="sr-only">{labels[0]}</span>
      {/* Invisible sizer — keeps container width stable */}
      <span className="invisible col-start-1 row-start-1" aria-hidden="true">{longestLabel}</span>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={activeLabel}
          initial={{ opacity: 0, y: 2, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -2, filter: 'blur(4px)' }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="col-start-1 row-start-1"
          aria-hidden="true"
        >
          {activeLabel}
        </m.span>
      </AnimatePresence>
    </span>
  );
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
};

// 2.2: Removed filter:blur(8px) from entrance variants — paint-heavy during hydration.
// item: non-title blocks still start at opacity:0 (fine — not LCP content).
const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_OUT }
  }
};

// 2.2: Title chars animate FROM visible (opacity:1, y:0) and only add subtle lift.
// The "hidden" state has opacity:1 so SSR HTML is readable with JS disabled.
// On hydration, motion picks up from the already-visible state and the slight
// upward shift gives visual feedback that the page is alive — no flash-of-invisible.
const wordVariants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.2 }
  }
};

const charVariants = {
  hidden: { opacity: 1, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT }
  }
};

// ============================================================
// RECESSED SYMBOLS — carved into the dark surface
// Invisible in darkness. Beam touches them → luminescent glow.
// Beam moves on → glow fades. That's the whole event.
// ============================================================

// How far the beam's glow reaches (in viewport-% distance units) and how sharply
// it falls off. A tighter radius + steeper exponent keeps the spotlight focused
// on the target and its immediate neighbours instead of lighting a wide cluster.
const ILLUMINATION_RADIUS = 19;
const ILLUMINATION_FALLOFF = 2.6;

// ============================================================
// CANVAS BEAM DRAW — volumetric light shaft on Canvas2D
// Drawn additively (globalCompositeOperation = 'lighter') so
// overlapping cones bloom naturally, like real light.
// ============================================================

/** Resolved accent color, shared between canvas draw calls. */
interface AccentCache {
  raw: string;    // e.g. "#2563EB" or "37 99 235"
  r: number; g: number; b: number;
}

/** Parse any CSS color format into r,g,b 0-255 components. */
function parseAccentColor(raw: string): { r: number; g: number; b: number } {
  // Handles "#RRGGBB", "rgb(r,g,b)", "r g b" (CSS custom property resolved form)
  const hex = raw.trim();
  if (hex.startsWith('#')) {
    const n = parseInt(hex.slice(1), 16);
    if (hex.length === 7) return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
    if (hex.length === 4) {
      const r = ((n >> 8) & 0xf) * 17, g = ((n >> 4) & 0xf) * 17, b = (n & 0xf) * 17;
      return { r, g, b };
    }
  }
  const rgb = hex.match(/\d+(\.\d+)?/g)?.map(Number) ?? [37, 99, 235];
  return { r: rgb[0] ?? 37, g: rgb[1] ?? 99, b: rgb[2] ?? 235 };
}

/** Resolve current --accent from computed styles. */
function resolveAccent(): AccentCache {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const { r, g, b } = parseAccentColor(raw);
  return { raw, r, g, b };
}

/** Dust mote — tiny particle drifting inside the cone. */
interface Mote {
  /** Position as fraction along cone length (0=origin, 1=tip) */
  t: number;
  /** Lateral offset within the half-width at that t (signed, -1..1) */
  s: number;
  /** Drift speeds */
  dt: number;
  ds: number;
  /** Base opacity */
  alpha: number;
  /** Phase for opacity flicker */
  phase: number;
}

const MAX_MOTES_DESKTOP = 38;
const MAX_MOTES_MOBILE  = 10;

/** Seed particles once on mount (client only — never called at module scope). */
function seedMotes(count: number): Mote[] {
  return Array.from({ length: count }, () => ({
    t: Math.random(),
    s: (Math.random() - 0.5) * 2,
    dt: (Math.random() * 0.00008 + 0.00003) * (Math.random() < 0.5 ? 1 : -1),
    ds: (Math.random() * 0.0003 + 0.0001) * (Math.random() < 0.5 ? 1 : -1),
    alpha: Math.random() * 0.18 + 0.04,
    phase: Math.random() * Math.PI * 2,
  }));
}

/**
 * Draw one frame of the volumetric light effect onto the canvas.
 * Called from inside the existing rAF loop — zero extra loops.
 *
 * @param ctx      - 2D canvas context (already DPR-scaled)
 * @param w        - canvas CSS width
 * @param h        - canvas CSS height
 * @param ox       - beam origin x (logo dot centre, viewport coords)
 * @param oy       - beam origin y (logo dot centre, viewport coords)
 * @param targetX  - beam landing x (active symbol centre, viewport coords)
 * @param targetY  - beam landing y (active symbol centre, viewport coords)
 * @param beamStage  - 0 = off, 1 = needle, 2 = sweeping
 * @param isMoving   - true while beam is sweeping between targets
 * @param justSettled - true in the ~600ms bloom after beam arrives
 * @param accent     - resolved accent color cache
 * @param motes      - particle array (mutated in-place each frame)
 * @param frameCount - monotonically increasing frame counter for animation
 * @param isMobile   - true when viewport < lg breakpoint
 */
function drawBeamFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ox: number,
  oy: number,
  targetX: number,
  targetY: number,
  beamStage: number,
  isMoving: boolean,
  justSettled: boolean,
  accent: AccentCache,
  motes: Mote[],
  frameCount: number,
  isMobile: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  if (beamStage < 1) return;

  const { r: ar, g: ag, b: ab } = accent;
  // Clamp to a valid 0–255 channel — bright accents (e.g. blue b=235) would
  // otherwise overflow when we add a white-hot bias, and canvas would clamp
  // silently. Do it explicitly so the hot tint stays correct in every theme.
  const cc = (v: number) => (v > 255 ? 255 : v < 0 ? 0 : v);
  const accentRGB = `${ar},${ag},${ab}`;
  const hotRGB = `${cc(ar + 70)},${cc(ag + 70)},${cc(ab + 50)}`;

  // Direction from origin to target
  const dx = targetX - ox;
  const dy = targetY - oy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const tx = dx / dist, ty = dy / dist;   // unit tangent along beam
  const nx = -ty, ny = tx;                // unit normal (perpendicular)

  // Beam terminates AT the landing point — the cone fades to nothing right where
  // the socket is, so the shaft never washes over (and hides) the recess. The
  // socket lights itself from within; the beam just points the way in.
  const shaftLen = dist * 1.0;

  // In stage 1 (needle) the half-width starts very small and grows to full.
  // Kept focused — a tight searchlight, not a wide floodlight fan.
  const halfWidthFull   = isMobile ? 40 : 60;
  const halfWidthNeedle = isMobile ? 8  : 12;
  const halfWidth = beamStage === 1 ? halfWidthNeedle : halfWidthFull;

  // Overall opacity: dim while moving, bloom on settle, steady otherwise.
  // Kept bold — this is a showpiece, and the canvas blur eats some peak.
  const op = isMoving ? 0.6 : justSettled ? 1.15 : 0.92;

  // Everything is additive light — overlaps brighten instead of stacking.
  // The canvas itself carries a CSS blur, so these polygon edges read as soft
  // atmospheric light rather than hard geometric triangles.
  ctx.globalCompositeOperation = 'lighter';

  // ── Source lamp: a radial bloom right at the logo dot (the projector lens) ──
  // Sells the illusion that the light EMANATES from the dot.
  {
    const R = (isMobile ? 30 : 50) * (beamStage === 1 ? 0.45 : 1);
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
    g.addColorStop(0,    `rgba(255,255,255,${(0.78 * op).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(${hotRGB},${(0.4 * op).toFixed(3)})`);
    g.addColorStop(1,    `rgba(${accentRGB},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, R, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Volumetric cone ──
  // Three nested widths only (soft halo → bright body → hot white core) — kept
  // few and tight so the beam reads as one focused shaft, not a fanned stack of
  // layers. The canvas blur feathers the polygon sides into atmosphere.
  const CONE_LAYERS = [
    { wMul: 1.3,  a: 0.16, white: false }, // soft outer halo
    { wMul: 0.6,  a: 0.40, white: false }, // bright body
    { wMul: 0.12, a: 1.00, white: true  }, // hot core
  ];
  for (const L of CONE_LAYERS) {
    // Needle stage shows only the tight inner layers
    if (beamStage === 1 && L.wMul > 0.5) continue;
    const hw = halfWidth * L.wMul;
    const bx = ox + tx * shaftLen;
    const by = oy + ty * shaftLen;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(bx + nx * hw, by + ny * hw);
    ctx.lineTo(bx - nx * hw, by - ny * hw);
    ctx.closePath();

    const head = L.white ? '255,255,255' : hotRGB;
    const mid  = L.white ? hotRGB : accentRGB;
    const g = ctx.createLinearGradient(ox, oy, bx, by);
    g.addColorStop(0,    `rgba(${head},${(L.a * op).toFixed(3)})`);
    g.addColorStop(0.3,  `rgba(${mid},${(L.a * 0.5 * op).toFixed(3)})`);
    g.addColorStop(0.75, `rgba(${accentRGB},${(L.a * 0.16 * op).toFixed(3)})`);
    g.addColorStop(1,    `rgba(${accentRGB},0)`);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // ── Drifting dust motes (soft radial glints, not hard dots) ──
  if (beamStage >= 2 && motes.length > 0) {
    const time = frameCount * 0.016;
    const rad = isMobile ? 2.5 : 3.5;
    for (const m of motes) {
      m.t += m.dt;
      m.s += m.ds;
      // Bounce at boundaries
      if (m.t > 1 || m.t < 0.04) m.dt = -m.dt;
      if (Math.abs(m.s) > 0.8) m.ds = -m.ds;
      m.t = Math.max(0.04, Math.min(1, m.t));
      m.s = Math.max(-0.8, Math.min(0.8, m.s));

      const along = m.t * shaftLen;
      const off   = halfWidth * m.t * m.s;
      const mx = ox + tx * along + nx * off;
      const my = oy + ty * along + ny * off;

      const flicker = Math.sin(time * 1.5 + m.phase) * 0.5 + 0.5;
      const a = m.alpha * flicker * (isMoving ? 0.5 : 1) * op;
      if (a < 0.01) continue;

      const g = ctx.createRadialGradient(mx, my, 0, mx, my, rad);
      g.addColorStop(0, `rgba(${cc(ar + 90)},${cc(ag + 90)},${cc(ab + 70)},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${accentRGB},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // NOTE: no landing pool/ring is drawn on the canvas. Any canvas light at the
  // landing sits ABOVE the socket (z-60) and reads as glare covering the recess.
  // Instead the socket lights its OWN interior from within (see RecessedSymbol) —
  // the beam just points the way in, and the pit ignites naturally.
}

// ============================================================
// DISCHARGE — click an illuminated socket to release an energy
// burst: a hot flash, an expanding shock ring, crackling arcs
// around the socket, and lightning that chains to the OTHER
// currently-lit sockets. Pure canvas (additive), layered onto
// the same light field right after the beam each frame.
// ============================================================

/** One active discharge event, stored in viewport px (converted at draw time). */
interface Discharge {
  ox: number;            // origin socket centre x (viewport px)
  oy: number;            // origin socket centre y (viewport px)
  links: { x: number; y: number }[]; // other lit sockets to chain to (viewport px)
  start: number;         // frameCount when spawned
  seed: number;          // per-burst random seed for stable-ish jitter
}

const DISCHARGE_LIFE = 36; // frames (~0.6s @60fps)

/** Cheap deterministic pseudo-random in [0,1) from two numeric inputs. */
function hashNoise(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Draw a jagged lightning bolt from (x1,y1) to (x2,y2): a polyline whose
 * interior vertices are pushed off the straight line by perpendicular jitter,
 * re-rolled each frame so the bolt crackles. Stroked twice — a wide soft accent
 * glow under a thin white-hot core. Assumes additive composite is already set.
 */
function drawBolt(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  amp: number, seed: number, frame: number,
  accentRGB: string, alpha: number,
) {
  if (alpha <= 0.01) return;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;          // perpendicular unit
  const segs = Math.max(3, Math.round(len / 22));
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    let off = 0;
    if (i > 0 && i < segs) {
      const taper = Math.sin(t * Math.PI);       // 0 at ends, 1 in middle
      off = (hashNoise(seed + i * 7.13, frame) - 0.5) * 2 * amp * taper;
    }
    pts.push([x1 + dx * t + px * off, y1 + dy * t + py * off]);
  }
  const stroke = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${accentRGB},${(alpha * 0.5).toFixed(3)})`;
  ctx.lineWidth = 3.5;
  stroke();
  ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  ctx.lineWidth = 1.2;
  stroke();
}

/**
 * Render all active discharges and prune expired ones (mutates `list`).
 * Coords are stored in viewport px; (crLeft,crTop) maps them to canvas-local.
 */
function drawDischarges(
  ctx: CanvasRenderingContext2D,
  list: Discharge[],
  frame: number,
  accent: AccentCache,
  crLeft: number,
  crTop: number,
  isMobile: boolean,
) {
  if (list.length === 0) return;
  const cc = (v: number) => (v > 255 ? 255 : v < 0 ? 0 : v);
  const { r: ar, g: ag, b: ab } = accent;
  const accentRGB = `${ar},${ag},${ab}`;
  const hotRGB = `${cc(ar + 80)},${cc(ag + 80)},${cc(ab + 60)}`;

  ctx.globalCompositeOperation = 'lighter';

  for (let k = list.length - 1; k >= 0; k--) {
    const d = list[k];
    const age = frame - d.start;
    if (age < 0 || age >= DISCHARGE_LIFE) { list.splice(k, 1); continue; }
    const p = age / DISCHARGE_LIFE;   // 0..1
    const fade = 1 - p;
    const ox = d.ox - crLeft, oy = d.oy - crTop;

    // ── Central flash — bright at impact, gone fast ──
    const fa = Math.max(0, 1 - p * 2.2);
    if (fa > 0.01) {
      const R = isMobile ? 22 : 32;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
      g.addColorStop(0,   `rgba(255,255,255,${(0.9 * fa).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(${hotRGB},${(0.5 * fa).toFixed(3)})`);
      g.addColorStop(1,   `rgba(${accentRGB},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Shock ring — expanding circle ──
    const ringA = fade * 0.55;
    if (ringA > 0.01) {
      const R = 6 + p * (isMobile ? 52 : 78);
      ctx.strokeStyle = `rgba(${hotRGB},${ringA.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, 2.6 * fade);
      ctx.beginPath();
      ctx.arc(ox, oy, R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Crackle arcs radiating around the socket (early only) ──
    if (p < 0.6) {
      const ca = (1 - p / 0.6) * 0.85;
      const N = isMobile ? 4 : 6;
      const baseLen = isMobile ? 26 : 38;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2 + d.seed + frame * 0.05;
        const ln = baseLen * (0.5 + hashNoise(d.seed + i, frame) * 0.7);
        drawBolt(ctx, ox, oy, ox + Math.cos(ang) * ln, oy + Math.sin(ang) * ln,
          isMobile ? 5 : 8, d.seed + i * 3.7, frame, accentRGB, ca);
      }
    }

    // ── Chain bolts to the other lit sockets (early-mid life) ──
    if (p < 0.72) {
      const la = 1 - p / 0.72;
      for (let i = 0; i < d.links.length; i++) {
        const lx = d.links[i].x - crLeft, ly = d.links[i].y - crTop;
        drawBolt(ctx, ox, oy, lx, ly, isMobile ? 8 : 13,
          d.seed + 100 + i * 9.1, frame, accentRGB, la);
        // small flash at the receiving socket
        const R = isMobile ? 14 : 20;
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
        g.addColorStop(0, `rgba(${hotRGB},${(0.7 * la * 0.8).toFixed(3)})`);
        g.addColorStop(1, `rgba(${accentRGB},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, R, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

interface StageElementDef {
  id: number;
  content: string;
  icon?: React.ComponentType<{ className?: string }>;
  left: number;   // desktop position %
  top: number;
  size: number;
  depth: number;
  // Mobile overrides — on mobile (<lg) the chat is hidden so the full viewport is open.
  // If provided, these positions replace left/top on mobile.
  // If mobileHidden is true, the element is hidden on mobile entirely.
  mobileLeft?: number;
  mobileTop?: number;
  mobileHidden?: boolean;
}

// BEAM PHYSICS: The beam originates from the logo dot (top-left, ~8% left, ~4% top).
// It sweeps ~280° downward — reaching everywhere below and to the sides.
//
// Layout philosophy (P2 retune):
//   Arc: the beam fans from top-left across a roughly 0°→160° arc (clockwise from up-right).
//   That creates three natural bands the beam sweeps through:
//     Band A — upper-right quadrant (top: 5-30%, left: 45-95%) — far/high targets
//     Band B — horizontal sweep (top: 30-65%, left: 15-95%) — the richest zone
//     Band C — lower sweep (top: 65-92%, left: 8-92%) — distant low targets
//
// DESKTOP (lg+): 2-column grid.
//   - Left column (0-48%): hero text — symbols OK here since text is transparent
//   - Right column (52-95%): InteractiveAgent panel opaque ~18-82% top → place symbols
//     ABOVE (top < 16%), BELOW (top > 84%), or in the narrow GAPS at panel edges.
//   - A cluster near 48% left (column gap) sweeps naturally through centre.
//
// MOBILE (<lg): single column, no chat panel — full width available.
//   - Spread across all 4 quadrants, avoid the headline text (top 8-30%, left 0-65%).
//   - mobileHidden=true for any symbol that would collide with headline copy.
//
// Anti-clump rule: min ~10% left/top distance between any two neighbours.
const STAGE_ELEMENTS: StageElementDef[] = [
  // ── Deep engravings — prominent, beam visits these often ──────────────────
  // id 0: "LLM" — upper-left of hero text, on the sweep arc early
  { id: 0,  content: 'LLM',  left: 27, top: 26, size: 22, depth: 0.9,
    mobileLeft: 72, mobileTop: 28 },
  // id 1: "AI" — centre of page, peak beam target
  { id: 1,  content: 'AI',   left: 44, top: 62, size: 28, depth: 1.0,
    mobileLeft: 58, mobileTop: 55 },
  // id 2: Brain icon — upper-right, clear of the nav bar
  { id: 2,  content: '',      icon: Brain, left: 67, top: 19, size: 24, depth: 0.95,
    mobileLeft: 82, mobileTop: 22 },

  // ── Medium engravings — along beam sweep arc ──────────────────────────────
  // id 3: "RAG" — far bottom-right, below panel
  { id: 3,  content: 'RAG',       left: 90, top: 87, size: 15, depth: 0.65,
    mobileLeft: 18, mobileTop: 84 },
  // id 4: OpenAI — mid-left, below hero text block
  { id: 4,  content: '',  icon: OpenAILogo,    left: 46, top: 80, size: 18, depth: 0.7,
    mobileLeft: 52, mobileTop: 79 },
  // id 5: Anthropic — left edge, mid height
  { id: 5,  content: '',  icon: AnthropicLogo, left: 12, top: 58, size: 16, depth: 0.55,
    mobileLeft: 10, mobileTop: 63 },
  // id 6: "Agents" — right edge, mid height (gap beside panel)
  { id: 6,  content: 'Agents',    left: 93, top: 44, size: 14, depth: 0.6,
    mobileLeft: 80, mobileTop: 43 },
  // id 7: Network icon — left side, mid sweep
  { id: 7,  content: '',  icon: Network,       left: 20, top: 42, size: 18, depth: 0.55,
    mobileLeft: 14, mobileTop: 45 },
  // id 8: Docker — upper right, clear of the nav, alongside Brain
  { id: 8,  content: '',  icon: DockerLogo,    left: 82, top: 18, size: 16, depth: 0.6,
    mobileLeft: 54, mobileTop: 16 },
  // id 9: Gemini — upper centre, along arc Band A (below the nav)
  { id: 9,  content: '',  icon: GeminiLogo,    left: 52, top: 23, size: 16, depth: 0.5,
    mobileLeft: 34, mobileTop: 18 },

  // ── Shallow engravings — whisper-level, fill the gaps ─────────────────────
  // id 10: "GPT" — centre, slightly above mid
  { id: 10, content: 'GPT',       left: 48, top: 32, size: 11, depth: 0.35,
    mobileLeft: 68, mobileTop: 36 },
  // id 11: Python — far bottom-left
  { id: 11, content: '',  icon: PythonLogo,    left: 7,  top: 82, size: 14, depth: 0.4,
    mobileLeft: 8,  mobileTop: 76 },
  // id 12: "NLP" — bottom centre-right
  { id: 12, content: 'NLP',       left: 64, top: 90, size: 10, depth: 0.3,
    mobileLeft: 44, mobileTop: 89 },
  // id 13: Meta — left, Band B entry
  { id: 13, content: '',  icon: MetaLogo,      left: 8,  top: 33, size: 14, depth: 0.35,
    mobileLeft: 88, mobileTop: 36 },
  // id 14: Vercel — centre-left, between text and column gap
  { id: 14, content: '',  icon: VercelLogo,    left: 36, top: 45, size: 12, depth: 0.35,
    mobileLeft: 40, mobileTop: 47 },
  // id 15: Database — far-right, Band B
  { id: 15, content: '',  icon: Database,      left: 94, top: 62, size: 14, depth: 0.4,
    mobileLeft: 76, mobileTop: 64 },
  // id 16: HuggingFace — left-centre, Band C entry
  { id: 16, content: '',  icon: HuggingFaceLogo, left: 28, top: 72, size: 14, depth: 0.35,
    mobileLeft: 28, mobileTop: 71 },
  // id 17: "ML" — upper left, near LLM but well-separated
  { id: 17, content: 'ML',        left: 14, top: 18, size: 11, depth: 0.4,
    mobileLeft: 50, mobileTop: 31 },
  // id 18: N8n — lower right, below panel
  { id: 18, content: '',  icon: N8nLogo,       left: 80, top: 88, size: 14, depth: 0.35,
    mobileLeft: 68, mobileTop: 87 },
  // id 19: Cpu — bottom centre
  { id: 19, content: '',  icon: Cpu,           left: 54, top: 92, size: 12, depth: 0.3,
    mobileLeft: 86, mobileTop: 81 },
  // id 20: Sparkles — upper-right panel gap
  { id: 20, content: '',  icon: Sparkles,      left: 92, top: 22, size: 12, depth: 0.3,
    mobileLeft: 92, mobileTop: 57 },
  // id 21: "API" — upper far right, Band A tip (clear of the nav)
  { id: 21, content: 'API',       left: 86, top: 25, size: 11, depth: 0.35,
    mobileLeft: 16, mobileTop: 92 },
  // id 22: HuggingFace 2nd — lower left, Band C
  { id: 22, content: '',  icon: HuggingFaceLogo, left: 34, top: 88, size: 13, depth: 0.3,
    mobileHidden: true },
];

// Proximity — quadratic falloff from beam target
// Uses mobile positions when applicable
const computeProximity = (elIdx: number, targetIdx: number, mobile: boolean): number => {
  if (elIdx === targetIdx) return 1;
  const el = STAGE_ELEMENTS[elIdx];
  const tgt = STAGE_ELEMENTS[targetIdx];
  const elLeft = mobile && el.mobileLeft != null ? el.mobileLeft : el.left;
  const elTop = mobile && el.mobileTop != null ? el.mobileTop : el.top;
  const tgtLeft = mobile && tgt.mobileLeft != null ? tgt.mobileLeft : tgt.left;
  const tgtTop = mobile && tgt.mobileTop != null ? tgt.mobileTop : tgt.top;
  const dist = Math.sqrt((elLeft - tgtLeft) ** 2 + (elTop - tgtTop) ** 2);
  return Math.max(0, 1 - (dist / ILLUMINATION_RADIUS) ** ILLUMINATION_FALLOFF);
};

// Fisher-Yates shuffle
const shuffleArray = (arr: number[]): number[] => {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
};

// A single engraved symbol.
// The LETTERS THEMSELVES are carved into the surface — no container.
// text-shadow creates the groove illusion (dark top edge + light bottom lip).
// When beam touches: phosphorescent glow fills the groove + symbol lifts
// toward the light in pseudo-3D (scale + translateY + cast shadow beneath).
const RecessedSymbol = React.memo(({ el, brightness, isMobile, clickable, onDischarge }: {
  el: StageElementDef;
  brightness: number;
  isMobile: boolean;
  clickable: boolean;
  onDischarge: (id: number) => void;
}) => {
  const Icon = el.icon;
  const eff = Math.min(el.depth, brightness * el.depth);
  const dur = eff > 0.1 ? '0.75s' : '1.8s'; // fast ignition, slow decay

  // Reveal is driven purely by how close the beam is (brightness). At rest the
  // socket is fully transparent, so nothing shows through in either theme — the
  // carved recesses only surface where the beam actually fills them.
  const reveal = Math.min(1, Math.max(0, brightness) * (0.9 + el.depth * 0.3));

  // Use mobile positions when on small screens
  const posLeft = isMobile && el.mobileLeft != null ? el.mobileLeft : el.left;
  const posTop = isMobile && el.mobileTop != null ? el.mobileTop : el.top;

  // ── Beam direction for THIS socket ──
  // The beam always emanates from the logo dot (top-left). Each socket is hit
  // from its own angle, so the lighting inside the pit must follow that angle:
  // the wall the beam reaches lights up, the near lip casts the shadow. We use
  // the dot→socket vector (in viewport %) as the light-travel direction.
  const DOT_X = 10, DOT_Y = 2; // approx logo-dot position in viewport %
  const dvx = posLeft - DOT_X;
  const dvy = posTop - DOT_Y;
  const dvlen = Math.hypot(dvx, dvy) || 1;
  const lx = dvx / dvlen; // unit light-travel direction (dot → socket)
  const ly = dvy / dvlen;

  // ── Bloom — the engraving swells faintly as the beam fills it (no rise; an
  // engraving is flush with the surface, it doesn't float up like a chip). ──
  const liftScale = 1 + eff * 0.05;

  const wrapperStyle: React.CSSProperties = {
    left: `${posLeft}%`,
    top: `${posTop}%`,
    transform: `translate(-50%, -50%) scale(${liftScale.toFixed(3)})`,
    opacity: reveal,
    transition: `opacity ${dur} var(--ease-out), transform ${dur} var(--ease-out)`,
    willChange: 'opacity, transform',
  };

  // ── THE ENGRAVING — frameless. No box/chip; the GLYPH itself is carved into
  // the surface. Three theme-aware layers via the --socket-* vars:
  //   • a bright bottom lip (--socket-lip-a) + a carved top shadow
  //     (--socket-shade) = the letterpress edge that reads as depth,
  //   • the glyph fills toward --socket-hot (white-hot on dark / rich ink on
  //     light) as it lights,
  //   • a soft radial pool of accent light lands on the surface around it,
  //     offset toward the beam's incoming side (lx,ly), fading to nothing so
  //     there's never a rectangle.
  const pad = Math.round(el.size * 0.5);
  const padX = pad + Math.round(el.size * 0.18);
  const lit = eff > 0.04;

  // Soft light pool on the surface — no edges, just shading.
  const poolBg = lit
    ? `radial-gradient(ellipse 66% 66% at ${(50 + lx * 14).toFixed(0)}% ${(50 + ly * 14).toFixed(0)}%, color-mix(in oklab, var(--accent) ${Math.round(eff * 22)}%, transparent) 0%, transparent 72%)`
    : 'transparent';

  const spanStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${pad}px ${padX}px`,
    background: poolBg,
    transition: `background ${dur} ease-out`,
    // Only the currently-lit glyphs accept the pointer (the field is otherwise
    // pointer-events:none). Clicking one fires an energy discharge.
    pointerEvents: clickable ? 'auto' : 'none',
    cursor: clickable ? 'pointer' : 'default',
  };

  // The carved glyph itself — colour fills toward the theme's "hot" target.
  const glyphColor = lit
    ? `color-mix(in oklab, var(--socket-hot) ${Math.round(eff * 55)}%, var(--accent))`
    : 'color-mix(in oklab, var(--accent) 10%, transparent)';

  // Letterpress for the text glyph: bright lip below + carved shadow above +
  // phosphor glow. Theme-aware through --socket-lip-a / --socket-shade.
  const glyphShadow = lit
    ? [
        `0 1px 0 rgba(255,255,255, calc(var(--socket-lip-a) * ${(0.45 + eff * 0.55).toFixed(2)}))`,
        `0 -1px 1.5px rgba(var(--socket-shade), calc(${(0.35 + eff * 0.25).toFixed(2)} * var(--socket-shade-mul)))`,
        `0 0 ${(eff * 9).toFixed(1)}px color-mix(in oklab, var(--accent) ${Math.round(eff * 50)}%, transparent)`,
      ].join(', ')
    : 'none';

  // Same letterpress + glow for icon glyphs, expressed as stacked drop-shadows.
  const iconFilter = lit
    ? `drop-shadow(0 1px 0 rgba(255,255,255, calc(var(--socket-lip-a) * 0.7))) drop-shadow(0 -1px 1px rgba(var(--socket-shade), calc(0.4 * var(--socket-shade-mul)))) drop-shadow(0 0 ${(eff * 6).toFixed(1)}px color-mix(in oklab, var(--accent) ${Math.round(eff * 50)}%, transparent))`
    : 'none';

  return (
    <div
      id={`target-${el.id}`}
      className={`absolute select-none${el.mobileHidden ? ' hidden lg:block' : ''}`}
      style={wrapperStyle}
    >
      <span
        className="inline-flex"
        style={spanStyle}
        onClick={clickable ? () => onDischarge(el.id) : undefined}
        aria-hidden="true"
      >
        {Icon ? (
          <span
            style={{
              width: el.size,
              height: el.size,
              display: 'inline-flex',
              color: glyphColor,
              filter: iconFilter,
              transition: `color ${dur} ease-out, filter ${dur} ease-out`,
            }}
          >
            <Icon className="w-full h-full" />
          </span>
        ) : (
          <span
            className="font-mono font-extrabold tracking-wider whitespace-nowrap"
            style={{
              fontSize: el.size,
              lineHeight: 1,
              color: glyphColor,
              textShadow: glyphShadow,
              transition: `color ${dur} ease-out, text-shadow ${dur} ease-out`,
            }}
          >
            {el.content}
          </span>
        )}
      </span>
    </div>
  );
});
RecessedSymbol.displayName = 'RecessedSymbol';

// Select a random subset of elements per page load for variety
// 23 total elements; always show all deep ones + a random selection of the rest
const VISIBLE_COUNT = 21;

const IlluminationBackground = () => {
  const prefersReduced = usePrefersReducedMotion();
  const [beamStage, setBeamStage] = useState(0);
  const [activeTarget, setActiveTarget] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [justSettled, setJustSettled] = useState(false);
  // Canvas reads geometry directly from canvasBeamRef — no setState lag needed for drawing.
  // We still track a ready flag so the component knows when geometry is first available.
  const [isMobile, setIsMobile] = useState(false);
  // Mounted gate for the body portal — createPortal(document.body) is client-only.
  // One-shot flip after hydration; intentional setState-in-effect (SSR portal guard).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // 4.8: ref to the wrapper div for IO + direct style.opacity writes (no setState per scroll)
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 4.8: heroVisible tracks whether the hero section is in the viewport
  const heroVisibleRef = useRef(true);
  // 4.8: cached logo-dot rect — read once on mount + on resize, not every rAF frame
  const dotRectRef = useRef<{ x: number; y: number } | null>(null);

  // Canvas ref — the volumetric light layer
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas geometry and state refs (read by the rAF loop each frame — no setState lag)
  const canvasBeamRef = useRef({
    ox: 0, oy: 0,       // beam origin (logo-dot centre, canvas-local coords)
    tx: 0, ty: 0,       // beam target — the symbol the beam is heading toward
    aimX: 0, aimY: 0,   // smoothed aim that eases toward (tx,ty) — the drawn direction
    aimInit: false,     // false until aim has been snapped to the first target
    beamStage: 0,
    isMoving: false,
    justSettled: false,
    isMobile: false,
  });
  // Accent color cache — re-read on resize + MutationObserver; NOT per frame
  const accentRef = useRef<AccentCache>({ raw: '#2563EB', r: 37, g: 99, b: 235 });
  // Dust motes — seeded once on mount (client-only, no SSR)
  const motesRef = useRef<Mote[]>([]);
  const motesSeeded = useRef(false);
  // Monotonically increasing frame counter for banding animation
  const frameCountRef = useRef(0);
  // DPR tracking
  const dprRef = useRef(1);
  // Active click-discharge bursts — drawn additively after the beam each frame.
  const dischargesRef = useRef<Discharge[]>([]);

  // Keep the beam-state refs in sync with React state so the canvas loop
  // always reads the freshest values without waiting for a render cycle.
  // We update these imperatively to avoid a second rAF loop.
  const beamStageRef = useRef(0);
  const isMovingRef  = useRef(false);
  const justSettledRef = useRef(false);
  const isMobileRef   = useRef(false);

  // Detect mobile (below lg breakpoint = 1024px)
  useEffect(() => {
    // Measure the logo-dot's viewport centre into the cache the rAF loop reads.
    // Guards out degenerate rects: pre-ignition the dot is `opacity-0 scale-0`
    // (collapsed 0×0), and at first paint the nav is still spring-animating in
    // from y:-100 with fonts unsettled — measuring then would freeze a wrong
    // origin until a resize. Only a real, laid-out dot updates the cache.
    const measureDot = () => {
      const dot = document.getElementById('logo-dot');
      if (!dot) return;
      const r = dot.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        dotRectRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    };

    const check = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      isMobileRef.current = mobile;
      canvasBeamRef.current.isMobile = mobile;

      measureDot();

      // Resize canvas to match new viewport + DPR
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        dprRef.current = dpr;
        canvas.width  = canvas.clientWidth  * dpr;
        canvas.height = canvas.clientHeight * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        // Re-read accent on resize (theme may have flipped via media query)
        accentRef.current = resolveAccent();
      }
    };
    check();
    window.addEventListener('resize', check, { passive: true });

    // Re-measure the dot as layout settles: next frame, after fonts load, and at
    // each choreography milestone (the dot only becomes measurable once it
    // ignites at dotIgnite). The last valid measurement wins, so by the time the
    // beam first draws (beamStage1) the origin is correct without a resize.
    const raf1 = requestAnimationFrame(measureDot);
    const settleTimers = [
      TIMELINE.dotIgnite,
      TIMELINE.beamStage1,
      TIMELINE.beamStage2,
    ].map((t) => setTimeout(measureDot, t + 60));
    let fontsCancelled = false;
    document.fonts?.ready?.then(() => { if (!fontsCancelled) measureDot(); });

    return () => {
      window.removeEventListener('resize', check);
      cancelAnimationFrame(raf1);
      settleTimers.forEach(clearTimeout);
      fontsCancelled = true;
    };
  }, []);

  // MutationObserver on documentElement — re-read accent when data-theme / class changes.
  // This catches manual theme toggles (ThemeToggle sets data-theme on <html>).
  useEffect(() => {
    const obs = new MutationObserver(() => {
      accentRef.current = resolveAccent();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  // Seed dust motes once, client-side only
  useEffect(() => {
    if (motesSeeded.current) return;
    motesSeeded.current = true;
    const count = isMobileRef.current ? MAX_MOTES_MOBILE : MAX_MOTES_DESKTOP;
    motesRef.current = seedMotes(count);
  }, []);

  // Random subset per page load — always include deep elements (depth >= 0.9)
  // Uses state + useEffect to avoid hydration mismatch (Math.random differs server vs client)
  const [visibleElements, setVisibleElements] = useState(STAGE_ELEMENTS);
  const hasRandomized = useRef(false);

  useEffect(() => {
    if (hasRandomized.current) return;
    hasRandomized.current = true;
    const must = STAGE_ELEMENTS.filter(e => e.depth >= 0.9);
    const rest = shuffleArray(
      STAGE_ELEMENTS.filter(e => e.depth < 0.9).map(e => e.id)
    ).slice(0, VISIBLE_COUNT - must.length);
    const ids = new Set([...must.map(e => e.id), ...rest]);
    // Client-only randomization, guarded to run once — keeps SSR markup stable
    // and avoids a hydration mismatch from Math.random differing server/client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleElements(STAGE_ELEMENTS.filter(e => ids.has(e.id)));
  }, []);

  // Randomized visit order — only visit visible elements
  const visitOrder = useRef(shuffleArray(visibleElements.map((_, i) => i)));
  const visitIndex = useRef(0);

  const getNextTarget = useCallback(() => {
    visitIndex.current = (visitIndex.current + 1) % visitOrder.current.length;
    if (visitIndex.current === 0) {
      const last = visitOrder.current[visitOrder.current.length - 1];
      do {
        visitOrder.current = shuffleArray(visibleElements.map((_, i) => i));
      } while (visitOrder.current[0] === last);
    }
    return visitOrder.current[visitIndex.current];
  }, [visibleElements]);

  // Sequence timing — 2.1: skip beam entirely for reduced motion users
  useEffect(() => {
    if (prefersReduced) {
      // Settle immediately at stage 2 so symbols are at rest (brightness 0 = invisible)
      beamStageRef.current = 2;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBeamStage(2);
      canvasBeamRef.current.beamStage = 2;
      return;
    }
    // Synced with logo-dot flashlight ignition:
    // Dot ignites at 3800ms, flash settles ~4400ms, then beam extends
    const t1 = setTimeout(() => {
      beamStageRef.current = 1;
      setBeamStage(1);
      canvasBeamRef.current.beamStage = 1;
    }, TIMELINE.beamStage1);
    const t2 = setTimeout(() => {
      beamStageRef.current = 2;
      setBeamStage(2);
      canvasBeamRef.current.beamStage = 2;
    }, TIMELINE.beamStage2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [prefersReduced]);

  // Randomized target cycling — recursive setTimeout for varied dwell
  useEffect(() => {
    if (beamStage < 2) return;
    let timeoutId: NodeJS.Timeout;

    const scheduleNext = () => {
      // Longer dwell gives the glow time to fully bloom and be appreciated
      const dwell = 4500 + Math.random() * 2000;
      timeoutId = setTimeout(() => {
        isMovingRef.current = true;
        justSettledRef.current = false;
        canvasBeamRef.current.isMoving = true;
        canvasBeamRef.current.justSettled = false;
        setIsMoving(true);
        setJustSettled(false);
        setActiveTarget(getNextTarget());
        // Gentle, unhurried travel — the beam is searching, not rushing
        const travel = 1500 + Math.random() * 800;
        setTimeout(() => {
          isMovingRef.current = false;
          canvasBeamRef.current.isMoving = false;
          setIsMoving(false);
          // Brief bloom when beam arrives — brightness overshoot then relax
          justSettledRef.current = true;
          canvasBeamRef.current.justSettled = true;
          setJustSettled(true);
          setTimeout(() => {
            justSettledRef.current = false;
            canvasBeamRef.current.justSettled = false;
            setJustSettled(false);
          }, 600);
        }, travel);
        scheduleNext();
      }, dwell);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [beamStage, getNextTarget]);

  // 4.8: IntersectionObserver to track hero visibility — rAF pauses when off-screen
  useEffect(() => {
    const el = wrapperRef.current?.closest('section');
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { heroVisibleRef.current = entries[0]?.isIntersecting ?? true; },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── MAIN rAF loop ─────────────────────────────────────────────────────
  // Merged: beam-geometry tracking + canvas draw. One loop only.
  //
  // Gating (same rules as before):
  //   • beamStage >= 1  (beam is live)
  //   • heroVisibleRef  (hero in viewport)
  //   • !document.hidden (tab active)
  //   • !prefersReduced (accessibility)
  //
  // When prefersReduced is true the canvas loop is skipped entirely —
  // the canvas simply stays blank (transparent) and the symbols show at
  // rest (brightness 0 = invisible), which is the reduced-motion contract.
  useEffect(() => {
    if (prefersReduced) return;
    if (beamStage < 1) return;

    let raf: number;

    const handleVisibilityChange = () => {
      // No-op: the track loop already checks document.hidden each frame
    };
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });

    const track = () => {
      frameCountRef.current++;

      // Pause the loop when hero is off-screen or tab is hidden (no draw needed)
      if (!heroVisibleRef.current || document.hidden) {
        raf = requestAnimationFrame(track);
        return;
      }

      // ── Resolve beam geometry ───────────────────────────────────────
      // 4.8: use cached dot rect; fall back to live getBCR only if cache is empty
      let ox: number, oy: number;
      if (dotRectRef.current) {
        ox = dotRectRef.current.x;
        oy = dotRectRef.current.y;
      } else {
        // No valid cache yet — read live, but only trust (cache) it once the dot
        // is actually laid out. Pre-ignition it's `scale-0` (collapsed 0×0) and
        // the nav may still be spring-animating in; caching that would freeze a
        // wrong origin forever. Skip the frame until we get a real measurement —
        // the beam isn't visible before ignition anyway, so this is invisible.
        const dot = document.getElementById('logo-dot');
        if (!dot) { raf = requestAnimationFrame(track); return; }
        const dr = dot.getBoundingClientRect();
        if (dr.width === 0 || dr.height === 0) { raf = requestAnimationFrame(track); return; }
        ox = dr.left + dr.width / 2;
        oy = dr.top + dr.height / 2;
        dotRectRef.current = { x: ox, y: oy };
      }

      // Active target position (live — target DOM element moves with scroll/resize)
      const targetEl = visibleElements[activeTarget];
      const tEl = targetEl ? document.getElementById(`target-${targetEl.id}`) : null;
      let targetX = ox, targetY = oy;  // fallback: straight down
      if (tEl) {
        const er = tEl.getBoundingClientRect();
        targetX = er.left + er.width  / 2;
        targetY = er.top  + er.height / 2;
      }

      // ── Canvas draw ─────────────────────────────────────────────────
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Lazy DPR sizing — the canvas is portaled to <body> and may mount
          // after the resize effect ran, so size it here whenever the backing
          // store doesn't match the current CSS size. Re-applies the DPR scale
          // (setting canvas.width resets the transform).
          const dpr = window.devicePixelRatio || 1;
          const cw = canvas.clientWidth, ch = canvas.clientHeight;
          if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
            canvas.width = Math.round(cw * dpr);
            canvas.height = Math.round(ch * dpr);
            ctx.scale(dpr, dpr);
          }

          // The canvas is fixed at the viewport origin, so its rect top-left is
          // (0,0) and viewport coords map directly. Subtracting the rect is a
          // harmless no-op here but keeps the math correct if that ever changes.
          const cr = canvas.getBoundingClientRect();
          const lox = ox - cr.left, loy = oy - cr.top;
          const ltx = targetX - cr.left, lty = targetY - cr.top;

          const cb = canvasBeamRef.current;
          cb.ox = lox; cb.oy = loy;
          cb.tx = ltx; cb.ty = lty;

          // Smooth aim — ease the drawn direction toward the real target so the
          // beam SWEEPS between symbols instead of snapping. (The old motion DOM
          // beam had a spring; the canvas needs its own interpolation.)
          if (!cb.aimInit) {
            cb.aimX = ltx; cb.aimY = lty; cb.aimInit = true;
          } else {
            // Faster while actively travelling, gentle drift otherwise.
            const k = cb.isMoving ? 0.045 : 0.12;
            cb.aimX += (ltx - cb.aimX) * k;
            cb.aimY += (lty - cb.aimY) * k;
          }

          drawBeamFrame(
            ctx,
            canvas.clientWidth,
            canvas.clientHeight,
            cb.ox, cb.oy,
            cb.aimX, cb.aimY,
            cb.beamStage,
            cb.isMoving,
            cb.justSettled,
            accentRef.current,
            motesRef.current,
            frameCountRef.current,
            cb.isMobile,
          );

          // Click-discharge bursts layer on top of the beam (additive). Viewport
          // coords → canvas-local via the same rect used for the beam geometry.
          drawDischarges(
            ctx,
            dischargesRef.current,
            frameCountRef.current,
            accentRef.current,
            cr.left, cr.top,
            cb.isMobile,
          );

          // Keep the assistant panel ABOVE the beam: clear the additive light
          // out of its EXACT rect so the shaft never washes over the chat UI.
          // Clearing exactly the panel box (no expansion) avoids a dark moat/gap
          // around it — the panel sits flush in the hole; the canvas's CSS blur
          // only feathers a hair onto the very edge. Desktop only (hidden < lg).
          if (!cb.isMobile) {
            const chat = document.getElementById('hero-chat-panel');
            if (chat) {
              const chr = chat.getBoundingClientRect();
              if (chr.width > 0) {
                ctx.clearRect(chr.left - cr.left, chr.top - cr.top, chr.width, chr.height);
              }
            }
          }
        }
      }

      raf = requestAnimationFrame(track);
    };

    // Seed motes now if not yet seeded (handles the case where mount effect runs
    // after this effect — defensive, order is correct in React 18 but safe either way)
    if (!motesSeeded.current) {
      motesSeeded.current = true;
      motesRef.current = seedMotes(isMobileRef.current ? MAX_MOTES_MOBILE : MAX_MOTES_DESKTOP);
    }

    // Initialise canvas backing store (DPR-aware)
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      accentRef.current = resolveAccent();
    }

    // Capture canvas ref to a local variable for use in the cleanup closure.
    // React's lint rule warns that .current may change by cleanup time if we
    // read canvasRef.current directly inside the return function.
    const capturedCanvas = canvasRef.current;

    track();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clear canvas on unmount so there's no ghost frame if the component re-mounts
      if (capturedCanvas) {
        const ctx = capturedCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, capturedCanvas.clientWidth, capturedCanvas.clientHeight);
      }
    };
  }, [activeTarget, visibleElements, prefersReduced, beamStage]);

  // 4.8: Scroll fade — direct style mutation, no setState per scroll event (avoids re-renders).
  // Fades both the symbol field (wrapper) and the portaled beam canvas together so the
  // whole hero light retreats as you scroll into the page.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const opacity = Math.max(0, 1 - window.scrollY / 400);
        if (wrapper) wrapper.style.opacity = String(opacity);
        if (canvasRef.current) canvasRef.current.style.opacity = String(opacity);
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click an illuminated socket → release an energy discharge that crackles
  // around it and chains lightning to the OTHER currently-lit sockets. The
  // chain naturally stays sparse because only a few sockets are lit at once.
  // Skipped under reduced motion (the canvas loop is off there) — those users
  // still get the brief CSS brightness pop on the socket itself.
  const handleDischarge = useCallback((id: number) => {
    const flare = (node: HTMLElement | null) => {
      if (!node) return;
      node.classList.remove('socket-zap');
      void node.offsetWidth;              // reflow → restart on rapid re-clicks
      node.classList.add('socket-zap');
      window.setTimeout(() => node.classList.remove('socket-zap'), 600);
    };

    const originEl = document.getElementById(`target-${id}`);
    if (!originEl) return;
    flare(originEl);
    if (prefersReduced) return;           // no canvas → CSS pop only

    const or = originEl.getBoundingClientRect();
    const ox = or.left + or.width / 2;
    const oy = or.top + or.height / 2;

    // Which other sockets are lit right now? Use the same proximity-to-active-
    // target signal that drives the glow; chain to the closest few.
    const targetEl = visibleElements[activeTarget];
    const lit: { x: number; y: number; node: HTMLElement; d: number }[] = [];
    if (targetEl) {
      for (const el of visibleElements) {
        if (el.id === id) continue;
        if (computeProximity(el.id, targetEl.id, isMobileRef.current) < 0.28) continue;
        const node = document.getElementById(`target-${el.id}`);
        if (!node) continue;
        const r = node.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        lit.push({ x, y, node, d: Math.hypot(x - ox, y - oy) });
      }
    }
    lit.sort((a, b) => a.d - b.d);
    const picked = lit.slice(0, 3);
    picked.forEach((l) => flare(l.node));

    dischargesRef.current.push({
      ox, oy,
      links: picked.map((l) => ({ x: l.x, y: l.y })),
      start: frameCountRef.current,
      seed: Math.random() * 1000,
    });
    if (dischargesRef.current.length > 6) dischargesRef.current.shift();
  }, [visibleElements, activeTarget, prefersReduced]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Canvas volumetric light layer — additive blending. Portaled to <body>
          and fixed above the nav (z-60) so the beam ORIGINATES from the logo dot
          itself (which sits inside the fixed nav bar) instead of being clipped
          behind it. Pointer-events:none so it never blocks the nav/content.
          DPR-sized lazily in the rAF loop; viewport-sized via fixed inset-0.
          GPU blur feathers the additive polygons into soft atmospheric light. */}
      {mounted && createPortal(
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-screen h-screen pointer-events-none"
          style={{ zIndex: 60, filter: isMobile ? 'blur(3px)' : 'blur(5px)' }}
          aria-hidden="true"
        />,
        document.body,
      )}

      {/* Recessed symbols — carved into the dark surface */}
      {/* z-index 2: rendered above the canvas so symbols always glow on top of the light. */}
      {/* symbol-field adds CSS perspective so the pseudo-3D lift reads as depth. */}
      {/* No max-width constraint here: right-column elements (left: 55–95%) must
          reach their viewport positions without being clipped by the content frame. */}
      <div className="absolute inset-0 symbol-field" style={{ zIndex: 2 }}>
        {visibleElements.map((element) => {
          const isActive = beamStage === 2;
          // Proximity uses actual element positions (not array index) via STAGE_ELEMENTS lookup
          const targetEl = visibleElements[activeTarget];
          const raw = isActive && targetEl
            ? computeProximity(element.id, targetEl.id, isMobile)
            : 0;
          // Dim during movement, brief bloom on settle, normal otherwise
          const brightness = isMoving
            ? raw * 0.3
            : justSettled
              ? Math.min(1, raw * 1.4)   // stronger bloom overshoot on settle
              : raw;

          return (
            <RecessedSymbol
              key={element.id}
              el={element}
              brightness={brightness}
              isMobile={isMobile}
              clickable={brightness > 0.25}
              onDischarge={handleDischarge}
            />
          );
        })}
      </div>
    </div>
  );
};

export const Hero = () => {
  const { hero, dossier } = useDictionary();
  // hero.name is used for the eyebrow identity line (5.2)
  const direction = useDirection();
  const isRtl = direction === 'rtl';
  const CtaArrow = isRtl ? ArrowLeft : ArrowRight;
  // 2.4: Stop scramble + rotator after first user interaction
  const [animStopped, setAnimStopped] = useState(false);

  useEffect(() => {
    const stop = () => setAnimStopped(true);
    window.addEventListener('pointerdown', stop, { once: true, passive: true });
    window.addEventListener('keydown', stop, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', stop);
      window.removeEventListener('keydown', stop);
    };
  }, []);

  return (
    <section className="pt-32 pb-24 px-6 max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10 min-h-[90vh]">
      <IlluminationBackground />
      {/* Text Content */}
      <m.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-start"
        style={{ textAlign: 'start' }}
      >
        {/* 5.2: Name eyebrow — renders before the title so a 30-sec scan yields name + role */}
        <m.p
          variants={item}
          className="font-mono text-[11px] text-fg-2 uppercase tracking-[0.22em] mb-3 bidi-ltr"
          dir="ltr"
        >
          {hero.name}
        </m.p>

        <m.div variants={item} className="status-badge mb-6">
          <span className="status-dot" />
          <span className="text-accent">
            <HeroStatusLabel labels={hero.statusLabels} stopped={animStopped} />
          </span>
        </m.div>

        <h1 className="display text-5xl md:text-7xl text-fg-0 mb-6 leading-tight">
          <m.div variants={wordVariants} initial="hidden" animate="show" className="inline-block overflow-hidden pb-2">
            {hero.titlePrefix.split('').map((char, i) => (
              <m.span key={i} variants={charVariants} className="inline-block">
                {char}
              </m.span>
            ))}
          </m.div>
          <br />
          {/* 2.4: sr-only span gives screen readers the static first word */}
          <span className="sr-only">{hero.rotatingWords[0]}</span>
          <m.div variants={item} className="inline-block overflow-hidden pb-2" aria-hidden="true">
            <ScrambleText words={hero.rotatingWords} isRtl={isRtl} stopped={animStopped} />
          </m.div>
        </h1>

        <m.p variants={item} className="lead text-xl md:text-2xl text-fg-1 mb-6 font-normal leading-relaxed">
          {hero.subtitle}
        </m.p>

        <m.div
          variants={item}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <a
            href="#showcase"
            className="btn btn-primary w-full sm:w-auto px-8 py-3.5 hover:scale-[1.05] active:scale-[0.95] transition-transform duration-[var(--dur-1)]"
          >
            {hero.primaryCta} <CtaArrow className="w-4 h-4" strokeWidth={1.5} />
          </a>
          <a
            href={dossier.resumeOptions[0].file}
            download={dossier.resumeOptions[0].downloadName}
            className="btn btn-secondary w-full sm:w-auto px-8 py-3.5 hover:scale-[1.05] active:scale-[0.95] transition-transform duration-[var(--dur-1)]"
          >
            <FileText className="w-4 h-4" strokeWidth={1.5} />
            {hero.secondaryCta}
          </a>
        </m.div>
      </m.div>

      {/* Interactive Agent Visual */}
      {/* id lets the beam canvas clear its additive light out of this rect each
          frame, so the assistant panel always reads as ABOVE the beam (the
          canvas is portaled above the nav at z-60 and can't be out-stacked from
          inside this section, so we cut the light instead of fighting z-index). */}
      <m.div
        id="hero-chat-panel"
        initial={{ opacity: 0, x: isRtl ? -40 : 40, filter: 'blur(10px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1, delay: 0.4, ease: EASE_OUT }}
        className="relative hidden lg:block"
      >
        <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
        <InteractiveAgent />
      </m.div>
    </section>
  );
};
