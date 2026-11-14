"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Grid } from "@/lib/data";

export type Mode = "naive" | "noise" | "real";
export const FLAT = [38, 50, 79];        // no trend found
export const NODATA = [13, 20, 40];      // e.g. ocean for land-only variables
const UP = [[90, 52, 30], [249, 115, 22], [254, 215, 170]];   // dark → orange → pale (bigger rise)
const DOWN = [[30, 50, 100], [59, 130, 246], [191, 219, 254]];
const lerp = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const ramp = (stops: number[][], t: number) => (t < 0.5 ? lerp(stops[0], stops[1], t * 2) : lerp(stops[1], stops[2], (t - 0.5) * 2));
export const rgb = (c: number[]) => `rgb(${c.join(",")})`;
export const rampCss = (dir: "up" | "down") => `linear-gradient(90deg, ${(dir === "up" ? UP : DOWN).map(rgb).join(",")})`;

let coastPromise: Promise<string> | null = null;
const coast = () => (coastPromise ??= fetch("/coastline.txt").then((r) => r.text()));

export const isSig = (grid: Grid, k: number, mode: Mode, enso: boolean) =>
  mode === "naive" ? grid.p_naive[k] < 0.05 : mode === "noise" ? grid.p_noise[k] < 0.05 : (enso ? grid.q_enso[k] : grid.q[k]) < 0.05;
export const slopeOf = (grid: Grid, k: number, mode: Mode, enso: boolean) =>
  enso && mode === "real" ? grid.slope_enso_decade[k] : grid.slope_decade[k];

/** Colour scale: |trend| at the 95th percentile of all cells maps to the palest colour. */
export function scaleOf(grid: Grid) {
  const a = (grid.slope_decade as (number | null)[]).filter((x): x is number => x != null).map(Math.abs).sort((p, q) => p - q);
  return a[Math.floor(a.length * 0.95)] || 1;
}
export function colorOf(grid: Grid, k: number, mode: Mode, enso: boolean, max: number) {
  const s = slopeOf(grid, k, mode, enso);
  if (s == null) return NODATA;
  if (!isSig(grid, k, mode, enso)) return FLAT;
  const t = 0.25 + 0.75 * Math.min(1, Math.abs(s) / max);
  return ramp(s > 0 ? UP : DOWN, t);
}

/**
 * Equirectangular texture (x = lon + 180, y = 90 − lat). One pixel per grid square, then scaled up
 * with smoothing and a soft blur so the squares melt into smooth zones; coastlines are drawn crisp on top.
 */
function paint(grid: Grid, mode: Mode, enso: boolean, coastD: string) {
  const [ny, nx] = grid.shape, max = scaleOf(grid);
  const small = document.createElement("canvas");
  small.width = nx * 3; small.height = ny; // three copies side by side so the blur wraps across the date line
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(nx, ny);
  for (let r = 0; r < ny; r++) for (let x = 0; x < nx; x++) {
    const k = r * nx + x, o = ((ny - 1 - r) * nx + x) * 4; // row 0 is the south pole
    img.data.set([...colorOf(grid, k, mode, enso, max), 255], o);
  }
  for (let i = 0; i < 3; i++) sctx.putImageData(img, i * nx, 0);

  const W = 4096, H = 2048, sx = W / nx;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = rgb(FLAT); // the blur pulls in transparency at the poles; blend it into "no trend" instead
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `blur(${Math.round(sx * 0.45)}px)`; // ignored where unsupported; smoothing alone still softens edges
  ctx.drawImage(small, -W, 0, W * 3, H);
  ctx.filter = "none";
  ctx.save();
  ctx.scale(W / 360, H / 180);
  ctx.strokeStyle = "rgba(232,238,252,0.8)";
  ctx.lineWidth = 0.18;
  ctx.stroke(new Path2D(coastD));
  ctx.restore();
  return c.toDataURL("image/jpeg", 0.9);
}

/** Nearest grid square to a clicked point. */
export function cellAt(grid: Grid, lat: number[], lon: number[], p: { lat: number; lng: number }) {
  const near = (arr: number[], v: number, wrap = 0) => arr.reduce((b, x, i) => {
    let d = Math.abs(x - v); if (wrap) d = Math.min(d, wrap - d);
    return d < b.d ? { i, d } : b;
  }, { i: 0, d: Infinity }).i;
  const r = near(lat, p.lat), x = near(lon, p.lng, 360);
  return { k: r * grid.shape[1] + x, lat: lat[r], lon: lon[x] };
}

export type Pick = { k: number; lat: number; lon: number };

export function Globe({ grid, mode, enso = false, spin = false, zoom = true, label, focus, box, onPick, pick }: {
  grid: Grid | null; mode: Mode; enso?: boolean; spin?: boolean; zoom?: boolean; label: string;
  focus?: { lat: number; lng: number; altitude: number }; box?: number[];
  onPick?: (p: { lat: number; lng: number }) => void; pick?: Pick | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const [G, setG] = useState<any>(null);
  const [size, setSize] = useState(0);
  const [coastD, setCoastD] = useState("");

  useEffect(() => { import("react-globe.gl").then((m) => setG(() => m.default)); coast().then(setCoastD); }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (focus && globe.current) globe.current.pointOfView(focus, 1200); }, [focus]);

  const texture = useMemo(() => (grid && coastD ? paint(grid, mode, enso, coastD) : null), [grid, mode, enso, coastD]);
  // Region outline: the box's four edges, densified so they follow the curve of the globe.
  const paths = useMemo(() => {
    if (!box) return [];
    const [a, b, c, d] = box, n = 40;
    const edge = (f: (t: number) => number[]) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    // A box that wraps all the way round (the Arctic) is a ring: draw its circles of latitude only.
    if (d - c >= 359) return [a, b].filter((lat) => Math.abs(lat) < 89).map((lat) => ({ pts: edge((t) => [lat, -180 + 360 * t]) }));
    return [{ pts: [...edge((t) => [a, c + (d - c) * t]), ...edge((t) => [a + (b - a) * t, d]), ...edge((t) => [b, d - (d - c) * t]), ...edge((t) => [b - (b - a) * t, c])] }];
  }, [box]);
  const rings = useMemo(() => (pick ? [{ lat: pick.lat, lng: pick.lon }] : []), [pick]);

  const ready = () => {
    const g = globe.current;
    if (!g) return;
    g.pointOfView(focus ?? { lat: 42, lng: -25, altitude: 2.1 }, 0);
    const c = g.controls();
    c.autoRotate = spin;
    c.autoRotateSpeed = 0.5;
    c.enableZoom = zoom;
    c.minDistance = 130;
  };

  return (
    <div ref={wrap} className="relative aspect-square w-full" role="img" aria-label={label}>
      {(!G || !texture) && <div className="absolute inset-[6%] animate-pulse rounded-full bg-gradient-to-br from-[#1b2a52] to-[#070c1f]" />}
      {G && texture && size > 0 && (
        <G ref={globe} width={size} height={size} backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={texture} showAtmosphere atmosphereColor="#5eead4" atmosphereAltitude={0.16}
          pathsData={paths} pathPoints="pts" pathPointLat={(p: number[]) => p[0]} pathPointLng={(p: number[]) => p[1]}
          pathColor={() => "#5eead4"} pathStroke={2} pathTransitionDuration={0}
          ringsData={rings} ringColor={() => (t: number) => `rgba(255,255,255,${1 - t})`} ringMaxRadius={4} ringPropagationSpeed={3} ringRepeatPeriod={900}
          onGlobeClick={onPick} onGlobeReady={ready} animateIn={false} />
      )}
    </div>
  );
}

/** Colour scale bar with real numbers, used under every globe. */
export function GlobeScale({ grid, units, mode }: { grid: Grid | null; units: string; mode: Mode }) {
  if (!grid) return null;
  const max = scaleOf(grid);
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2 text-[13px] text-[#a9b6d3]">
      <div className="flex items-center gap-3">
        <span className="w-20 text-right">falling</span>
        <div className="flex h-3 flex-1 overflow-hidden rounded-full">
          <div className="h-full flex-1" style={{ background: rampCss("down"), transform: "scaleX(-1)" }} />
          <div className="h-full w-6" style={{ background: rgb(FLAT) }} />
          <div className="h-full flex-1" style={{ background: rampCss("up") }} />
        </div>
        <span className="w-20">rising</span>
      </div>
      <div className="flex justify-between px-[92px] text-[12px]">
        <span>−{+max.toPrecision(2)}</span><span>no trend</span><span>+{+max.toPrecision(2)}</span>
      </div>
      <p className="text-center text-[12px] text-[var(--muted)]">
        {units} per decade. Brighter = bigger change. Only squares that pass {mode === "real" ? "the strict test" : mode === "noise" ? "the simple test on shuffled data" : "the simple test"} are coloured.
        {" "}<span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: rgb(NODATA), border: "1px solid rgba(255,255,255,.3)" }} /> = no data.
        {" "}Click anywhere for that spot&apos;s numbers.
      </p>
    </div>
  );
}
