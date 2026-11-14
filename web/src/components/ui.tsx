import type { ReactNode } from "react";

const TONE = {
  real: "bg-teal-300/15 text-teal-200 border-teal-300/40",
  maybe: "bg-amber-300/15 text-amber-200 border-amber-300/40",
  none: "bg-slate-300/15 text-slate-200 border-slate-300/30",
  pass: "bg-teal-300/15 text-teal-200 border-teal-300/40",
  fail: "bg-amber-300/15 text-amber-200 border-amber-300/40",
  na: "bg-slate-300/15 text-slate-300 border-slate-300/30",
};
export function Badge({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-[var(--line)] bg-white/[0.04] p-6 ${className}`}>{children}</div>;
}

/** Tiny line of a series; `trend` = [start, end] values of the trend line, drawn on top. */
export function Sparkline({ y, trend, color = "#f97316", label }: { y: number[]; trend?: [number, number]; color?: string; label: string }) {
  const W = 300, H = 64;
  const lo = Math.min(...y, ...(trend ?? [])), hi = Math.max(...y, ...(trend ?? [])), span = hi - lo || 1;
  const X = (i: number) => (i / (y.length - 1)) * W;
  const Y = (v: number) => 4 + (hi - v) / span * (H - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={label}>
      <polyline fill="none" stroke="#c7d2fe" strokeWidth={1.5} strokeLinejoin="round" points={y.map((v, i) => `${X(i)},${Y(v)}`).join(" ")} />
      {trend && <line x1={0} y1={Y(trend[0])} x2={W} y2={Y(trend[1])} stroke={color} strokeWidth={2.5} />}
    </svg>
  );
}
