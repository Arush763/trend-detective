"use client";
// Shared design-system primitives. See the trend-detective-design skill for the rules behind them.
import Link from "next/link";
import { useEffect, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ElementType, type ReactNode } from "react";
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

const EASE = [0.16, 1, 0.3, 1] as const;

const TONE = {
  real: "border-signal/45 bg-signal/10 text-signal",
  pass: "border-signal/45 bg-signal/10 text-signal",
  maybe: "border-white/20 bg-white/[0.05] text-ink-dim",
  na: "border-white/20 bg-white/[0.05] text-ink-dim",
  none: "border-noise/60 bg-noise/10 text-[#aab1bd]",
  fail: "border-false-alarm/50 bg-false-alarm/10 text-false-alarm",
  alarm: "border-false-alarm/50 bg-false-alarm/10 text-false-alarm",
};

/** Mono uppercase verdict chip: real/pass = signal, maybe/na = dim, none = noise grey, fail/alarm = false-alarm magenta. */
export function Badge({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`hud inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 backdrop-blur-sm ${TONE[tone]}`}>{children}</span>;
}

/** Glass surface (`.glass`) with default padding. Pass `className` to override padding or radius. */
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

/** `////// LABEL` section label: faint slashes, dim text. */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`hud ${className}`}>
      <span aria-hidden="true" className="mr-2 text-ink-faint">{"//////"}</span>{children}
    </p>
  );
}

/** Rolling-text hover: two stacked copies, the label slides up and the twin rolls in (260ms ease-out). Triggered by hovering/focusing the nearest parent link or button. Static under reduced motion. */
export function RollText({ children }: { children: string }) {
  return (
    <span className="roll">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
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

/** Pill button, mono uppercase, arrow slot and rolling-text hover. Internal href = next/link, http(s)/mailto href = <a>, otherwise <button>. */
export function Button({ href, onClick, variant = "primary", children, arrow = "→", className = "", ...rest }: ButtonProps) {
  const cls = `btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} ${className}`;
  const inner = (
    <>
      <RollText>{children}</RollText>
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
    <motion.span layoutId={layoutId} aria-hidden="true" transition={{ duration: 0.35, ease: EASE }}
      className={`pointer-events-none absolute -inset-1 ${className}`}>
      <span className={`${c} left-0 top-0 border-l-[1.5px] border-t-[1.5px]`} />
      <span className={`${c} right-0 top-0 border-r-[1.5px] border-t-[1.5px]`} />
      <span className={`${c} bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]`} />
      <span className={`${c} bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]`} />
    </motion.span>
  );
}

const STAMP = {
  passed: { label: "Passed", dark: "border-signal text-signal", paper: "border-signal-ink text-signal-ink" },
  "not-proven": { label: "Not proven", dark: "border-white/35 text-ink-dim", paper: "border-ink-paper-dim text-ink-paper-dim" },
  failed: { label: "Failed", dark: "border-false-alarm text-false-alarm", paper: "border-[#a21caf] text-[#a21caf]" },
} as const;

/** Mono stamp that lands with scale 1.15 → 1 and a 6px → 0 blur (instant under reduced motion). Default text is PASSED / NOT PROVEN / FAILED; `paper` switches colors for light chapters. */
export function VerdictStamp({ verdict, children, paper = false, className = "" }: { verdict: "passed" | "not-proven" | "failed"; children?: ReactNode; paper?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const s = STAMP[verdict];
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, scale: 1.15, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: EASE }}
      className={`hud inline-flex origin-center items-center rounded-md border-[1.5px] px-3 py-1.5 tracking-[0.14em] ${paper ? s.paper : s.dark} ${className}`}>
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
  const mono = "var(--font-jetbrains), ui-monospace, monospace";
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
