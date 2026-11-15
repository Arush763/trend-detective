"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Grid } from "@/lib/data";

export type Mode = "naive" | "noise" | "real";
export const FLAT = [78, 86, 104];       // tested, but no trend passed this test (neutral grey)
export const NODATA = [13, 20, 40];      // not measured here, e.g. ocean for land-only variables
export const LUCK = [251, 191, 36];      // a false alarm on shuffled data (its direction means nothing)
// Ramps run dim → bright. Heat-like variables: orange up, blue down. Water variables: teal wetter, brown drier.
const WARM = [[90, 52, 30], [249, 115, 22], [254, 215, 170]];
const COOL = [[30, 50, 100], [59, 130, 246], [191, 219, 254]];
const WET = [[18, 70, 72], [20, 184, 166], [153, 246, 228]];
const DRY = [[80, 50, 20], [180, 110, 40], [245, 205, 145]];
const WATER = new Set(["TQV", "PRECTOTCORR", "EVAP", "GWETROOT", "SNOMAS", "RUNOFF"]);
const ramps = (v: string) => (WATER.has(v) ? { up: WET, down: DRY } : { up: WARM, down: COOL });
const T0 = 0.4; // dimmest shade a coloured square gets, so weak trends still stand out from grey
const lerp = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const ramp = (stops: number[][], t: number) => (t < 0.5 ? lerp(stops[0], stops[1], t * 2) : lerp(stops[1], stops[2], (t - 0.5) * 2));
export const rgb = (c: number[]) => `rgb(${c.join(",")})`;
/** The colour for a rising (+1) or falling (−1) trend of this variable, at full strength. */
export const trendColor = (v: string, sign: number) => (sign === 0 ? "var(--soft)" : rgb(ramp(sign > 0 ? ramps(v).up : ramps(v).down, 0.6)));
const rampCss = (stops: number[][]) => `linear-gradient(90deg, ${[T0, (T0 + 1) / 2, 1].map((t) => rgb(ramp(stops, t))).join(",")})`;

let coastPromise: Promise<Path2D | null> | null = null;
/** Natural Earth coastlines as a Path2D in (lon + 180, 90 − lat) degrees, or null if they failed to load. */
export const coast = () => (coastPromise ??= fetch("/coastline.txt").then((r) => (r.ok ? r.text() : "")).then((t) => (t ? new Path2D(t) : null)).catch(() => null));

export const isSig = (grid: Grid, k: number, mode: Mode, enso: boolean) =>
  mode === "naive" ? grid.p_naive[k] < 0.05 : mode === "noise" ? grid.p_noise[k] < 0.05 : (enso ? grid.q_enso[k] : grid.q[k]) < 0.05;
export const slopeOf = (grid: Grid, k: number, mode: Mode, enso: boolean) =>
  enso && mode === "real" ? grid.slope_enso_decade[k] : grid.slope_decade[k];

/**
 * Colour scale: |trend| at the 95th percentile of the squares that pass the strict test maps to the
 * brightest colour (all squares if too few pass). One scale per variable, the same in every mode.
 */
const scales = new WeakMap<object, number>();
export function scaleOf(grid: Grid) {
  if (!scales.has(grid)) {
    const all = (grid.slope_decade as (number | null)[]).map((x, k) => [x, grid.q[k]] as const).filter(([x]) => x != null);
    const sig = all.filter(([, q]) => q != null && q < 0.05);
    const a = (sig.length >= 50 ? sig : all).map(([x]) => Math.abs(x as number)).sort((p, q) => p - q);
    scales.set(grid, a[Math.floor(a.length * 0.95)] || 1);
  }
  return scales.get(grid)!;
}
export function colorOf(grid: Grid, k: number, mode: Mode, enso: boolean, max: number) {
  const s = slopeOf(grid, k, mode, enso);
  if (s == null) return NODATA;
  if (!isSig(grid, k, mode, enso)) return FLAT;
  if (mode === "noise") return LUCK;
  const r = ramps(grid.var);
  return ramp(s > 0 ? r.up : r.down, T0 + (1 - T0) * Math.min(1, Math.abs(s) / max));
}

/**
 * Equirectangular texture (x = lon + 180, y = 90 − lat). One pixel per grid square, then scaled up
 * with smoothing and a light blur so the squares melt into smooth zones; coastlines are drawn crisp on top.
 * Cached per variable/mode/El Niño, since repainting takes a noticeable moment.
 */
const textures = new Map<string, string>();
function paint(grid: Grid, mode: Mode, enso: boolean, coastP: Path2D | null) {
  const key = `${grid.var}|${mode}|${enso}|${coastP ? 1 : 0}`;
  const hit = textures.get(key);
  if (hit) return hit;
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

  const W = 2048, H = 1024, sx = W / nx;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = rgb(FLAT); // the blur pulls in transparency at the poles; blend it into grey instead
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `blur(${Math.round(sx * 0.3)}px)`; // ignored where unsupported; smoothing alone still softens edges
  // MERRA-2 cells are centred 0.3125° west and 0.25° north of an even 2.5° × 2° tiling from (−180, −90).
  ctx.drawImage(small, -W - (0.3125 / 360) * W, -(0.25 / 180) * H, W * 3, H);
  ctx.filter = "none";
  if (coastP) {
    ctx.save();
    ctx.scale(W / 360, H / 180);
    ctx.strokeStyle = "rgba(232,238,252,0.8)";
    ctx.lineWidth = 0.25;
    ctx.stroke(coastP);
    ctx.restore();
  }
  const url = c.toDataURL("image/jpeg", 0.9);
  textures.set(key, url);
  return url;
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

// Stable accessors, so the globe doesn't rebuild its layers on every render.
const ptLat = (p: number[]) => p[0], ptLng = (p: number[]) => p[1], pathCol = () => "#5eead4";
const ringCol = () => (t: number) => `rgba(255,255,255,${1 - t})`;

export function Globe({ grid, mode, enso = false, spin = false, zoom = true, label, focus, box, onPick, pick }: {
  grid: Grid | null; mode: Mode; enso?: boolean; spin?: boolean; zoom?: boolean; label: string;
  focus?: { lat: number; lng: number; altitude: number }; box?: number[];
  onPick?: (p: { lat: number; lng: number }) => void; pick?: Pick | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const renderer = useRef<any>(null);
  const [G, setG] = useState<any>(null);
  const [size, setSize] = useState(0);
  const [coastP, setCoastP] = useState<Path2D | null | undefined>(undefined);

  useEffect(() => {
    import("react-globe.gl").then((m) => setG(() => m.default)).catch(() => {});
    coast().then(setCoastP);
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)));
    ro.observe(el);
    // Stop rendering while the globe is scrolled out of view.
    const io = new IntersectionObserver(([e]) => {
      const g = globe.current;
      if (g) { if (e.isIntersecting) g.resumeAnimation(); else g.pauseAnimation(); }
    });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);
  // Give the WebGL context back on unmount; browsers only allow a handful at once.
  useEffect(() => () => renderer.current?.forceContextLoss?.(), []);
  useEffect(() => { if (focus && globe.current) globe.current.pointOfView(focus, 1200); }, [focus]);

  const texture = useMemo(() => (grid && coastP !== undefined ? paint(grid, mode, enso, coastP) : null), [grid, mode, enso, coastP]);
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
    renderer.current = g.renderer();
    if (spin) renderer.current.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1)); // the big hero globe: fewer pixels
    g.pointOfView(focus ?? { lat: 42, lng: -25, altitude: size < 500 ? 1.75 : 2.1 }, 0);
    const c = g.controls();
    c.autoRotate = spin && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    c.autoRotateSpeed = 0.5;
    c.enableZoom = zoom;
    c.minDistance = 130;
  };

  return (
    <div ref={wrap} className="relative aspect-square w-full" role="img" aria-label={label}>
      {(!G || !texture) && <div className="absolute inset-[6%] rounded-full bg-gradient-to-br from-[#1b2a52] to-[#070c1f] motion-safe:animate-pulse" />}
      {G && texture && size > 0 && (
        <G ref={globe} width={size} height={size} backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={texture} showAtmosphere atmosphereColor="#5eead4" atmosphereAltitude={0.16}
          pathsData={paths} pathPoints="pts" pathPointLat={ptLat} pathPointLng={ptLng}
          pathColor={pathCol} pathStroke={2} pathTransitionDuration={0}
          ringsData={rings} ringColor={ringCol} ringMaxRadius={4} ringPropagationSpeed={3} ringRepeatPeriod={900}
          onGlobeClick={onPick} onGlobeReady={ready} animateIn={false} />
      )}
    </div>
  );
}

/** Colour key with real numbers, used under every globe. */
export function GlobeScale({ grid, units, mode, enso = false }: { grid: Grid | null; units: string; mode: Mode; enso?: boolean }) {
  if (!grid) return null;
  const sw = (c: number[], extra = "") => <span className={`inline-block h-2.5 w-2.5 rounded-sm align-middle ${extra}`} style={{ background: rgb(c), border: "1px solid rgba(255,255,255,.3)" }} />;
  const greyNote = <>{sw(FLAT)} = tested, no trend passed · {sw(NODATA)} = not measured here.</>;
  if (mode === "noise") {
    return (
      <div className="flex w-full max-w-[560px] flex-col gap-2 text-center text-[13px] text-[var(--dim)]">
        <p><span className="mr-1.5 inline-block h-3 w-6 rounded-full align-middle" style={{ background: rgb(LUCK) }} />False alarm: shuffled data with no real trend still passed the simple test here.</p>
        <p className="text-[12px] text-[var(--muted)]">{greyNote}</p>
      </div>
    );
  }
  const max = +scaleOf(grid).toPrecision(2), r = ramps(grid.var), water = WATER.has(grid.var);
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2 text-[13px] text-[var(--dim)]">
      <div className="flex items-center gap-3">
        <span className="w-20 text-right">{water ? "drier / less" : "falling"}</span>
        <div className="flex h-3 flex-1 overflow-hidden rounded-full" aria-hidden="true">
          <div className="h-full flex-1" style={{ background: rampCss(r.down), transform: "scaleX(-1)" }} />
          <div className="h-full w-6" style={{ background: rgb(FLAT) }} />
          <div className="h-full flex-1" style={{ background: rampCss(r.up) }} />
        </div>
        <span className="w-20">{water ? "wetter / more" : "rising"}</span>
      </div>
      <div className="flex justify-between px-[92px] text-[12px]">
        <span>≤ −{max}</span><span>no trend passed</span><span>≥ +{max}</span>
      </div>
      <p className="text-center text-[12px] text-[var(--muted)]">
        {units} per decade{enso && mode === "real" ? ", El Niño removed" : ""}. Brighter = bigger change. Only squares that pass {mode === "real" ? "the strict test" : "the simple test"} are colored.
        {" "}{greyNote}
      </p>
    </div>
  );
}
