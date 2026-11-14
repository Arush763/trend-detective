"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { fmt } from "@/lib/data";

type Props = {
  years: number[];
  y: number[];            // one value per point (yearly values, or monthly anomalies)
  perYear: number;        // points per year: 1 = yearly, 12 = monthly
  slope: number;          // trend, units per year
  ci?: [number, number];  // 95% range of the slope, units per year
  intercept?: number;     // trend value at the first year (yearly view)
  split?: number;         // first year of the "checked here" half
  units: string;
  title: string;
};

const W = 1040, H = 320, L = 60, R = 18, T = 40, B = 34;

// Nice round axis ticks between lo and hi.
function ticks(lo: number, hi: number, n = 5) {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function TrendChart({ years, y, perYear, slope, ci, intercept, split, units, title }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = y.length;
  const t = (i: number) => i / perYear;                       // years since start
  const span = (n - 1) / perYear;
  // Trend line: pipeline intercept in the yearly view, otherwise anchored on the median (Sen's method).
  const b = intercept ?? median(y.map((v, i) => v - slope * t(i)));
  const mid = span / 2, ym = b + slope * mid;
  const band = ci && [[0, ym - ci[1] * mid], [span, ym + ci[1] * mid], [span, ym + ci[0] * mid], [0, ym - ci[0] * mid]];
  const all = [...y, b, b + slope * span, ...(band ? band.map((p) => p[1]) : [])];
  const pad = (Math.max(...all) - Math.min(...all)) * 0.06 || 1;
  const lo = Math.min(...all) - pad, hi = Math.max(...all) + pad;
  const X = (yr: number) => L + (yr / span) * (W - L - R);
  const Y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const yt = useMemo(() => ticks(lo, hi), [lo, hi]);
  const decades = years.filter((yr) => yr % 10 === 0);
  const pts = y.map((v, i) => `${X(t(i)).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const sx = split != null ? X(split - years[0]) : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const yr = (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * span;
    setHover(Math.max(0, Math.min(n - 1, Math.round(yr * perYear))));
  };
  const hy = hover != null ? years[0] + Math.floor(hover / perYear) : null;
  const month = hover != null && perYear === 12 ? new Date(2000, hover % 12).toLocaleString("en", { month: "short" }) + " " : "";

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img"
        aria-label={`${title}, ${years[0]} to ${years.at(-1)}, with trend line`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(159,180,255,0.12)" />
            <text x={L - 10} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="#8fa0c4">{fmt(v, 3)}</text>
          </g>
        ))}
        {decades.map((yr) => <text key={yr} x={X(yr - years[0])} y={H - 10} textAnchor="middle" fontSize={12} fill="#8fa0c4">{yr}</text>)}
        <text x={L} y={16} fontSize={12} fill="#8fa0c4">{units}</text>
        {sx != null && (
          <g>
            <rect x={sx} y={T - 8} width={W - R - sx} height={H - T - B + 8} fill="rgba(94,234,212,0.04)" />
            <line x1={sx} x2={sx} y1={T - 8} y2={H - B} stroke="rgba(94,234,212,0.5)" strokeDasharray="4 4" />
            <text x={L + 8} y={T + 6} fontSize={12} fill="#8fa0c4">{years[0]}–{split! - 1}: trend found here</text>
            <text x={sx + 8} y={T + 6} fontSize={12} fill="#5eead4">{split}–{years.at(-1)}: did it keep going?</text>
          </g>
        )}
        {band && <path d={`M${band.map(([a, v]) => `${X(a)},${Y(v)}`).join(" L")} Z`} fill="rgba(249,115,22,0.18)" />}
        <motion.polyline key={pts} points={pts} fill="none" stroke="#c7d2fe" strokeWidth={perYear === 1 ? 1.6 : 0.9} strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        {perYear === 1 && y.map((v, i) => <circle key={i} cx={X(t(i))} cy={Y(v)} r={2.4} fill="#c7d2fe" />)}
        <line x1={X(0)} y1={Y(b)} x2={X(span)} y2={Y(b + slope * span)} stroke="#f97316" strokeWidth={3} strokeLinecap="round" />
        {hover != null && (
          <g pointerEvents="none">
            <line x1={X(t(hover))} x2={X(t(hover))} y1={T - 8} y2={H - B} stroke="rgba(232,238,252,0.35)" />
            <circle cx={X(t(hover))} cy={Y(y[hover])} r={5} fill="#e8eefc" />
            <g transform={`translate(${Math.min(X(t(hover)) + 10, W - 190)},${Math.max(Y(y[hover]) - 44, 4)})`}>
              <rect width={178} height={38} rx={8} fill="#0f1730" stroke="rgba(159,180,255,0.35)" />
              <text x={10} y={16} fontSize={12} fill="#8fa0c4">{month}{hy}</text>
              <text x={10} y={31} fontSize={13} fill="#e8eefc" fontWeight={600}>{perYear === 12 && y[hover] > 0 ? "+" : ""}{fmt(y[hover], 3)} {units}</text>
            </g>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[#c7d2fe]" />{perYear === 1 ? "Each year's average" : "Each month, compared with a normal month"}</span>
        <span className="flex items-center gap-2"><span className="h-[3px] w-5 bg-[#f97316]" />Trend line</span>
        {band && <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-[#f97316]/30" />Range the trend could be in (95% sure)</span>}
        <span>Hover or touch the chart to read a value.</span>
      </figcaption>
    </figure>
  );
}
