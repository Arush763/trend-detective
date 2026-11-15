"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fmt } from "@/lib/data";
import { HudCallout } from "@/components/ui";

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
  /** HUD leader-line callouts at the first value, the last value and the most extreme year. Default true. */
  annotate?: boolean;
  /** CSS color of the trend line and its range band. Default: --warming if rising, --cooling if falling. */
  trendColor?: string;
};

const R = 18, T = 40, B = 34;
const MONO = "var(--font-jetbrains), ui-monospace, monospace";
const axis = { fontFamily: MONO, fontSize: 11, fill: "var(--ink-dim)", fontVariantNumeric: "tabular-nums" } as const;

// Nice round axis ticks between lo and hi.
function ticks(lo: number, hi: number, n = 5) {
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const median = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function TrendChart({ years, y, perYear, slope, ci, intercept, split, units, title, overlays = [], annotate = true, trendColor }: Props) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real on-screen width, so the labels keep their size on a phone instead of shrinking with a fixed viewBox.
  const box = useRef<HTMLElement>(null);
  const [w, setW] = useState(1040);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || 1040));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The figure is wider than the plot panel (panel padding), so draw slightly narrower.
  const W = Math.max(280, w - 24), H = Math.round(Math.min(320, Math.max(220, W * 0.42))), L = W < 640 ? 48 : 60, narrow = W < 640;
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
  const tc = trendColor ?? (slope >= 0 ? "var(--warming)" : "var(--cooling)");

  // HUD callouts, computed from the data: first value, last value, and the year farthest from the trend line.
  const mname = (i: number) => (perYear === 12 ? new Date(2000, i % 12).toLocaleString("en", { month: "short" }) + " " : "");
  const callout = (i: number, side: "left" | "right" | "auto", tag: string) => {
    const px = X(t(i)), py = Y(y[i]);
    const align: "left" | "right" = side === "auto" ? (px < (L + W - R) / 2 ? "left" : "right") : side;
    // Put the label block clear of the series: above it when the nearby data sits in the lower half of the plot, otherwise below.
    // Window = ±3 years around the point; keep ~18px between the block and the nearest point in that window.
    const win = 3 * perYear, near = y.slice(Math.max(0, i - win), Math.min(n, i + win + 1)).map(Y);
    const nTop = Math.min(py, ...near), nBot = Math.max(py, ...near);
    const above = (nTop + nBot) / 2 > (T + H - B) / 2;
    const tx = Math.max(L + 10, Math.min(W - R - 10, px + (align === "left" ? 24 : -24)));
    const lo2 = split != null ? T + 26 : T - 4, hi2 = H - B - 22;
    const ty = Math.max(lo2, Math.min(hi2, above ? nTop - 18 - 18 : nBot + 18 + 10));
    return {
      key: `${i}${tag}`, from: [px, py] as [number, number], to: [tx, ty] as [number, number], align,
      lines: [`${mname(i)}${years[0] + Math.floor(i / perYear)} · ${tag}`, `${perYear === 12 && y[i] > 0 ? "+" : ""}${fmt(y[i], 3)} ${units}`],
    };
  };
  const notes = (() => {
    if (!annotate || n < 3) return [];
    let ex = 0, best = -1;
    y.forEach((v, i) => { const dv = Math.abs(v - (b + slope * t(i))); if (dv > best) { best = dv; ex = i; } });
    const out = [callout(0, "left", "START"), callout(n - 1, "right", "LATEST")];
    // Skip the extreme one when it would sit on top of the start or end label.
    const xe = X(t(ex));
    if (ex > 0 && ex < n - 1 && Math.abs(xe - X(0)) > 150 && Math.abs(xe - X(span)) > 150) {
      out.push(callout(ex, "auto", y[ex] >= b + slope * t(ex) ? "PEAK" : "LOW"));
    }
    return out;
  })();

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const yr = (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * span;
    setHover(Math.max(0, Math.min(n - 1, Math.round(yr * perYear))));
  };
  const hy = hover != null ? years[0] + Math.floor(hover / perYear) : null;
  const month = hover != null && perYear === 12 ? new Date(2000, hover % 12).toLocaleString("en", { month: "short" }) + " " : "";

  return (
    <figure ref={box} className="m-0">
      {/* Opaque night panel: no blur, grain or glow behind the plot. */}
      <div className="rounded-2xl border border-white/10 bg-[var(--night)] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y select-none" role="img" tabIndex={0}
        aria-label={`${title}, ${years[0]} to ${years.at(-1)}. Trend ${slope > 0 ? "+" : ""}${fmt(slope * 10, 3)} ${units} per decade${ci ? `, 95% range ${fmt(ci[0] * 10, 3)} to ${fmt(ci[1] * 10, 3)}` : ""}. Use the arrow keys to read each value.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(n - 1, (h ?? -1) + (e.key === "ArrowRight" ? 1 : -1))));
        }}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} style={{ stroke: "var(--ink)", strokeOpacity: 0.08 }} />
            <text x={L - 10} y={Y(v) + 4} textAnchor="end" style={axis}>{fmt(v, 3)}</text>
          </g>
        ))}
        {decades.map((yr) => <text key={yr} x={X(yr - years[0])} y={H - 10} textAnchor="middle" style={axis}>{yr}</text>)}
        <text x={L} y={16} style={{ ...axis, letterSpacing: "0.08em", textTransform: "uppercase" }}>{units}</text>
        {sx != null && (
          <g>
            <rect x={sx} y={T - 8} width={W - R - sx} height={H - T - B + 8} style={{ fill: "var(--signal)", fillOpacity: 0.05 }} />
            <line x1={sx} x2={sx} y1={T - 8} y2={H - B} strokeDasharray="4 4" style={{ stroke: "var(--signal)", strokeOpacity: 0.6 }} />
            <text x={L + 8} y={T + 6} style={axis}>{narrow ? "trend found" : `${years[0]}–${split! - 1}: trend found here`}</text>
            <text x={sx + 8} y={T + 6} style={{ ...axis, fill: "var(--signal)" }}>{narrow ? "kept going?" : `${split}–${years.at(-1)}: did it keep going?`}</text>
          </g>
        )}
        {band && <path d={`M${band.map(([a, v]) => `${X(a)},${Y(v)}`).join(" L")} Z`} style={{ fill: tc, fillOpacity: 0.16 }} />}
        <motion.polyline key={pts} points={pts} fill="none" style={{ stroke: "var(--ink-dim)" }} strokeWidth={perYear === 1 ? 1.6 : 0.9} strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        {perYear === 1 && y.map((v, i) => <circle key={i} cx={X(t(i))} cy={Y(v)} r={2.4} style={{ fill: "var(--ink)" }} />)}
        <motion.line key={`trend${W}`} x1={X(0)} y1={Y(b)} x2={X(span)} y2={Y(b + slope * span)} style={{ stroke: tc }} strokeWidth={3} strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut", delay: reduce ? 0 : 0.15 }} />
        {overlays.map((o) => (
          <g key={o.label}>
            {/* Join only consecutive years, so a missing year shows as a gap instead of a made-up line. */}
            {o.points.slice(1).map(([yr, v], i) => o.points[i][0] === yr - 1 && (
              <line key={yr} x1={X(o.points[i][0] - years[0])} y1={Y(o.points[i][1])} x2={X(yr - years[0])} y2={Y(v)} stroke={o.color} strokeWidth={1.6} strokeDasharray="5 3" />
            ))}
            {o.points.map(([yr, v]) => <rect key={yr} x={X(yr - years[0]) - 3.5} y={Y(v) - 3.5} width={7} height={7} fill={o.color} transform={`rotate(45 ${X(yr - years[0])} ${Y(v)})`} />)}
          </g>
        ))}
        {notes.map((c) => <HudCallout key={`${c.key}-${W}`} from={c.from} to={c.to} lines={c.lines} align={c.align} />)}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={X(t(hover))} x2={X(t(hover))} y1={T - 8} y2={H - B} style={{ stroke: "var(--ink)", strokeOpacity: 0.35 }} />
            <circle cx={X(t(hover))} cy={Y(y[hover])} r={5} style={{ fill: "var(--ink)" }} />
            <g transform={`translate(${Math.min(X(t(hover)) + 10, W - 190)},${Math.max(Y(y[hover]) - 44, 4)})`}>
              <rect width={178} height={38} rx={8} style={{ fill: "var(--void)", stroke: "var(--glass-stroke)" }} />
              <text x={10} y={16} style={axis}>{month}{hy}</text>
              <text x={10} y={31} style={{ ...axis, fontSize: 12, fill: "var(--ink)" }}>{perYear === 12 && y[hover] > 0 ? "+" : ""}{fmt(y[hover], 3)} {units}</text>
            </g>
          </g>
        )}
      </svg>
      </div>
      <p className="sr-only" aria-live="polite">{hover != null ? `${month}${hy}: ${fmt(y[hover], 3)} ${units}` : ""}</p>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--ink-dim)]">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[var(--ink-dim)]" />{perYear === 1 ? "Each year's average" : "Each month, compared with a normal month"}</span>
        <span className="flex items-center gap-2"><span className="h-[3px] w-5" style={{ background: tc }} />Trend line</span>
        {band && <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm" style={{ background: tc, opacity: 0.3 }} />Steepest and gentlest trend lines that fit (95% range of the slope)</span>}
        {overlays.map((o) => <span key={o.label} className="flex items-center gap-2"><span className="h-2 w-2 rotate-45" style={{ background: o.color }} />{o.label}</span>)}
        <span className="hud ml-auto !normal-case">Hover, touch, or focus the chart and use arrow keys to read a value.</span>
      </figcaption>
    </figure>
  );
}
