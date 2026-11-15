"use client";
// Shared design-system primitives. See .claude/skills/trend-detective-design-system for the rules behind them.
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ElementType, type ReactNode } from "react";
import { motion } from "motion/react";

/** Hydration-safe reduced-motion flag: false on the server AND on the first client render, then the real preference after mount. (Motion's own useReducedMotion can differ between server and first client paint, which changes markup and breaks hydration.) */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

const EASE = [0.16, 1, 0.3, 1] as const; // ease-expo
const EASE_UI = [0.4, 0, 0.1, 1] as const;
const EASE_BACK = [0, 1.3, 1.1, 1] as const;

const TONE = {
  real: "border-accent bg-accent text-accent-ink",
  pass: "border-accent bg-accent text-accent-ink",
  maybe: "border-hairline bg-ground-raised text-ink-muted",
  na: "border-hairline bg-ground-raised text-ink-muted",
  none: "border-no-trend bg-ground-raised text-ink-muted",
  fail: "border-false-alarm/50 bg-false-alarm/10 text-false-alarm",
  alarm: "border-false-alarm/50 bg-false-alarm/10 text-false-alarm",
};

/** Mono uppercase verdict chip: real/pass = accent fill, maybe/na = muted, none = no-trend grey, fail/alarm = false-alarm magenta. */
export function Badge({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`hud inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 ${TONE[tone]}`}>{children}</span>;
}

/** Solid raised panel (`.glass`, radius 10) with default padding. Pass `className` to override padding or radius. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass p-6 ${className}`}>{children}</div>;
}

/** Tiny line of a series; `trend` = [start, end] values of the trend line, drawn on top. Colors default to tokens (series ink-dim, trend warming). */
export function Sparkline({ y, trend, color = "var(--warming)", label, className = "h-16 w-full", dashed = false }: { y: number[]; trend?: [number, number]; color?: string; label: string; className?: string; dashed?: boolean }) {
  const W = 300, H = 64;
  const lo = Math.min(...y, ...(trend ?? [])), hi = Math.max(...y, ...(trend ?? [])), span = hi - lo || 1;
  const X = (i: number) => (i / (y.length - 1)) * W;
  const Y = (v: number) => 4 + (hi - v) / span * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline fill="none" style={{ stroke: "var(--ink-dim)" }} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={y.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} />
      {trend && <line x1={0} y1={Y(trend[0])} x2={W} y2={Y(trend[1])} style={{ stroke: color }} strokeWidth={2.5} strokeDasharray={dashed ? "6 5" : undefined} opacity={dashed ? 0.75 : 1} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Mono uppercase micro-label (`.hud`). `as` picks the element (default span). */
export function Hud({ children, className = "", as: Tag = "span" }: { children: ReactNode; className?: string; as?: ElementType }) {
  return <Tag className={`hud ${className}`}>{children}</Tag>;
}

/** `• LABEL` section label: an accent dot, muted text. */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`hud ${className}`}>
      <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-[0.1em]" />{children}
    </p>
  );
}

/** RollLink label: nudges 6px right when the nearest parent link or button is hovered or focused (400ms ease-ui). No duplicate text; the current page (aria-current) doesn't nudge. */
export function RollText({ children }: { children: string }) {
  return <span className="nudge">{children}</span>;
}

/** Words that really change (Menu → Close): both stacked in one grid cell, the shown one rolls in. The hidden one is aria-hidden. */
export function SwapText({ a, b, showB }: { a: string; b: string; showB: boolean }) {
  return (
    <span className="roll">
      <span aria-hidden={showB || undefined} data-gone={showB || undefined}>{a}</span>
      <span aria-hidden={!showB || undefined} data-off={!showB || undefined}>{b}</span>
    </span>
  );
}

type ButtonProps = {
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "glass";
  children: string;
  /** Glyph in the arrow slot. Default "→"; pass `false` for none. */
  arrow?: string | false;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement> & ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "className" | "href">;

/** Pill button `[dot][label][arrow]`. primary = PillButton (dot flood, one per view), glass = ShiftButton (slate). Internal href = next/link, http(s)/mailto href = <a>, otherwise <button>. */
export function Button({ href, onClick, variant = "primary", children, arrow = "→", className = "", ...rest }: ButtonProps) {
  const cls = `btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`;
  const inner = (
    <>
      <span aria-hidden="true" className="btn-dot" />
      <span className="btn-label">{children}</span>
      {arrow !== false && <span aria-hidden="true" className="btn-arrow">{arrow}</span>}
    </>
  );
  if (href && /^(https?:|mailto:|tel:)/.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>;
  }
  if (href) return <Link href={href} onClick={onClick} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{inner}</button>;
}

/** Igloo-style `[ ]` corner brackets for the active option. Render inside a `relative` button: `{active && <Brackets layoutId="var-chips" />}`. Slides between options via Motion layoutId. */
export function Brackets({ layoutId, className = "" }: { layoutId: string; className?: string }) {
  const c = "absolute h-2 w-2 border-signal";
  return (
    <motion.span layoutId={layoutId} aria-hidden="true" transition={{ duration: 0.4, ease: EASE_UI }}
      className={`pointer-events-none absolute -inset-1 ${className}`}>
      <span className={`${c} left-0 top-0 border-l-[1.5px] border-t-[1.5px]`} />
      <span className={`${c} right-0 top-0 border-r-[1.5px] border-t-[1.5px]`} />
      <span className={`${c} bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]`} />
      <span className={`${c} bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]`} />
    </motion.span>
  );
}

// A failed check is shown muted like "not proven", never red.
const STAMP = {
  passed: { label: "Passed", cls: "border-accent bg-accent text-accent-ink" },
  "not-proven": { label: "Not proven", cls: "border-ink-muted text-ink-muted" },
  failed: { label: "Not proven", cls: "border-ink-muted text-ink-muted" },
} as const;

/** Pixel stamp that lands with scale 1.4 → 1 on ease-back (instant under reduced motion). Default text is PASSED / NOT PROVEN. Theme-aware through tokens, so it works on Paper chapters too. */
export function VerdictStamp({ verdict, children, className = "" }: { verdict: "passed" | "not-proven" | "failed"; children?: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const s = STAMP[verdict];
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, scale: 1.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE_BACK }}
      className={`pixel inline-flex origin-center items-center rounded-md border-[1.5px] px-3 py-1.5 ${s.cls} ${className}`}>
      {children ?? s.label}
    </motion.span>
  );
}

/** Four `+` registration marks at the corners of the parent (which must be `relative`). */
export function RegMarks({ className = "" }: { className?: string }) {
  const m = "absolute font-mono text-[14px] leading-none text-ink-faint";
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${m} left-0 top-0 -translate-x-1/2 -translate-y-1/2`}>+</span>
      <span className={`${m} right-0 top-0 translate-x-1/2 -translate-y-1/2`}>+</span>
      <span className={`${m} bottom-0 left-0 -translate-x-1/2 translate-y-1/2`}>+</span>
      <span className={`${m} bottom-0 right-0 translate-x-1/2 translate-y-1/2`}>+</span>
    </div>
  );
}

type Pt = [number, number];

/** SVG leader-line annotation for use INSIDE an <svg> (renders a <g>). A 1px line draws on (pathLength 0→1) from `from` (marked with a dot) to `to`, then the mono label lines fade in 40ms apart (first line `--ink`, rest `--ink-dim`). `align` is which side of `to` the text sits on: "left" = text starts at `to` and runs right, "right" = text ends at `to`. Coordinates are in the parent SVG's user units. */
export function HudCallout({ from, to, lines, align = "left", show = true }: { from: Pt; to: Pt; lines: string[]; align?: "left" | "right"; show?: boolean }) {
  const reduce = useReducedMotion();
  const right = align === "right";
  const tx = to[0] + (right ? -8 : 8);
  const mono = "var(--font-mono)";
  return (
    <g>
      <motion.path d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ stroke: "var(--ink-faint)" }}
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: show ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }} />
      <motion.circle cx={from[0]} cy={from[1]} r={2.5} style={{ fill: "var(--ink)" }}
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} transition={{ duration: 0.2 }} />
      {lines.map((ln, i) => (
        <motion.text key={i} x={tx} y={to[1] + 4 + i * 14} textAnchor={right ? "end" : "start"}
          style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.08em", fill: i === 0 ? "var(--ink)" : "var(--ink-dim)", paintOrder: "stroke", stroke: "var(--night)", strokeWidth: 4, strokeLinejoin: "round" }}
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: show ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: show ? 0.45 + i * 0.04 : 0 }}>
          {ln.toUpperCase()}
        </motion.text>
      ))}
    </g>
  );
}

/** Same as HudCallout with the line given as x1,y1 → x2,y2. Also renders a <g>, so use it inside an <svg>. */
export function LeaderLabel({ lines, x1, y1, x2, y2, align, show }: { lines: string[]; x1: number; y1: number; x2: number; y2: number; align?: "left" | "right"; show?: boolean }) {
  return <HudCallout from={[x1, y1]} to={[x2, y2]} lines={lines} align={align} show={show} />;
}

/** CaseCard title: on hover of the nearest `.group`, letters slide 34px right in a wave (later letters start first, 12ms apart, damped k=10) and an arrow chases ~100ms behind. Plain text with JS off; static under reduced motion or without a hovering pointer. */
export function WaveTitle({ text, className = "" }: { text: string; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const h = root.current, card = h?.closest<HTMLElement>(".group");
    if (!h || !card || reduce || !matchMedia("(hover: hover)").matches) return;
    const letters = [...h.querySelectorAll<HTMLElement>("[data-l]")], arrow = h.querySelector<HTMLElement>("[data-arrow]")!;
    const n = letters.length, x = new Float32Array(n + 1);
    let on = false, since = 0, raf = 0, last = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.064, (t - (last || t)) / 1000); last = t;
      const age = t - since;
      let moving = age < (n * 12 + 100); // keep running until every delay has passed
      for (let i = 0; i <= n; i++) {
        const delay = i < n ? (n - 1 - i) * 12 : 100; // index n is the arrow
        const target = on && age >= delay ? 34 : on ? x[i] : 0;
        x[i] += (target - x[i]) * (1 - Math.exp(-10 * dt));
        if (Math.abs(target - x[i]) > 0.1) moving = true;
      }
      letters.forEach((el, i) => (el.style.transform = `translateX(${x[i].toFixed(2)}px)`));
      arrow.style.transform = `translateX(${(x[n] - 34).toFixed(2)}px)`;
      arrow.style.opacity = String(x[n] / 34);
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const go = (v: boolean) => () => { on = v; since = performance.now(); last = 0; if (!raf) raf = requestAnimationFrame(tick); };
    const enter = go(true), leave = go(false);
    card.addEventListener("pointerenter", enter); card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", enter); card.addEventListener("focusout", leave);
    return () => { cancelAnimationFrame(raf); card.removeEventListener("pointerenter", enter); card.removeEventListener("pointerleave", leave); card.removeEventListener("focusin", enter); card.removeEventListener("focusout", leave); };
  }, [reduce]);
  const words = text.split(" ");
  return (
    <h3 ref={root} aria-label={text} className={`relative ${className}`}>
      <span data-arrow aria-hidden="true" className="absolute left-0 top-0 opacity-0">→</span>
      <span aria-hidden="true">
        {words.map((w, wi) => (
          <Fragment key={wi}>
            {wi > 0 && " "}
            <span className="inline-block whitespace-nowrap">
              {[...w].map((c, ci) => <span key={ci} data-l className="inline-block will-change-transform">{c}</span>)}
            </span>
          </Fragment>
        ))}
      </span>
    </h3>
  );
}
