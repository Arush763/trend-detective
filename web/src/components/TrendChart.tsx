"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
  /** Extra yearly series drawn on top, e.g. ground-station observations: [year, value] pairs (gaps allowed). */
  overlays?: { label: string; color: string; points: [number, number][] }[];
};

const R = 18, T = 40, B = 34;

// Nice round axis ticks between lo and hi.
function ticks(lo: number, hi: number, n = 5) {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function TrendChart({ years, y, perYear, slope, ci, intercept, split, units, title, overlays = [] }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real on-screen width, so the 12px labels stay 12px on a phone instead of shrinking with a fixed viewBox.
  const box = useRef<HTMLElement>(null);
  const [w, setW] = useState(1040);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || 1040));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(300, w), H = Math.round(Math.min(320, Math.max(220, W * 0.42))), L = W < 640 ? 48 : 60, narrow = W < 640;
  const n = y.length;
  const t = (i: number) => i / perYear;                       // years since start
  const span = (n - 1) / perYear;
  // Trend line: pipeline intercept in the yearly view, otherwise anchored on the median (Sen's method).
  const b = intercept ?? median(y.map((v, i) => v - slope * t(i)));
  const mid = span / 2, ym = b + slope * mid;
  const band = ci && [[0, ym - ci[1] * mid], [span, ym + ci[1] * mid], [span, ym + ci[0] * mid], [0, ym - ci[0] * mid]];
  const all = [...y, b, b + slope * span, ...(band ? band.map((p) => p[1]) : []), ...overlays.flatMap((o) => o.points.map((p) => p[1]))];
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
    <figure ref={box} className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none rounded-lg" role="img" tabIndex={0}
        aria-label={`${title}, ${years[0]} to ${years.at(-1)}. Trend ${slope > 0 ? "+" : ""}${fmt(slope * 10, 3)} ${units} per decade${ci ? `, 95% range ${fmt(ci[0] * 10, 3)} to ${fmt(ci[1] * 10, 3)}` : ""}. Use the arrow keys to read each value.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(n - 1, (h ?? -1) + (e.key === "ArrowRight" ? 1 : -1))));
        }}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(159,180,255,0.12)" />
            <text x={L - 10} y={Y(v) + 4} textAnchor="end" fontSize={12} fill="#8fa0c4">{fmt(v, 3)}</text>
          </g>
        ))}
        {decades.map((yr) => <text key={yr} x={X(yr - years[0])} y={H - 10} textAnchor="middle" fontSize={12} fill="#8fa0c4">{yr}</text>)}
        <text x={L} y={16} fontSize={12} fontWeight={600} fill="#8fa0c4">{units}</text>
        {sx != null && (
          <g>
            <rect x={sx} y={T - 8} width={W - R - sx} height={H - T - B + 8} fill="rgba(94,234,212,0.04)" />
            <line x1={sx} x2={sx} y1={T - 8} y2={H - B} stroke="rgba(94,234,212,0.5)" strokeDasharray="4 4" />
            <text x={L + 8} y={T + 6} fontSize={12} fill="#8fa0c4">{narrow ? "trend found" : `${years[0]}–${split! - 1}: trend found here`}</text>
            <text x={sx + 8} y={T + 6} fontSize={12} fill="#5eead4">{narrow ? "kept going?" : `${split}–${years.at(-1)}: did it keep going?`}</text>
          </g>
        )}
        {band && <path d={`M${band.map(([a, v]) => `${X(a)},${Y(v)}`).join(" L")} Z`} fill="rgba(249,115,22,0.18)" />}
        <motion.polyline key={pts} points={pts} fill="none" stroke="#c7d2fe" strokeWidth={perYear === 1 ? 1.6 : 0.9} strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        {perYear === 1 && y.map((v, i) => <circle key={i} cx={X(t(i))} cy={Y(v)} r={2.4} fill="#c7d2fe" />)}
        <line x1={X(0)} y1={Y(b)} x2={X(span)} y2={Y(b + slope * span)} stroke="#f97316" strokeWidth={3} strokeLinecap="round" />
        {overlays.map((o) => (
          <g key={o.label}>
            {/* Join only consecutive years, so a missing year shows as a gap instead of a made-up line. */}
            {o.points.slice(1).map(([yr, v], i) => o.points[i][0] === yr - 1 && (
              <line key={yr} x1={X(o.points[i][0] - years[0])} y1={Y(o.points[i][1])} x2={X(yr - years[0])} y2={Y(v)} stroke={o.color} strokeWidth={1.6} strokeDasharray="5 3" />
            ))}
            {o.points.map(([yr, v]) => <rect key={yr} x={X(yr - years[0]) - 3.5} y={Y(v) - 3.5} width={7} height={7} fill={o.color} transform={`rotate(45 ${X(yr - years[0])} ${Y(v)})`} />)}
          </g>
        ))}
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
      <p className="sr-only" aria-live="polite">{hover != null ? `${month}${hy}: ${fmt(y[hover], 3)} ${units}` : ""}</p>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[#c7d2fe]" />{perYear === 1 ? "Each year's average" : "Each month, compared with a normal month"}</span>
        <span className="flex items-center gap-2"><span className="h-[3px] w-5 bg-[#f97316]" />Trend line</span>
        {band && <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-[#f97316]/30" />Steepest and gentlest trend lines that fit (95% range of the slope)</span>}
        {overlays.map((o) => <span key={o.label} className="flex items-center gap-2"><span className="h-2 w-2 rotate-45" style={{ background: o.color }} />{o.label}</span>)}
        <span className="ml-auto text-[12px] italic">Hover, touch, or focus the chart and use arrow keys to read a value.</span>
      </figcaption>
    </figure>
  );
}
