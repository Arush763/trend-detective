"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Grid } from "@/lib/data";

export type Mode = "naive" | "noise" | "real";
export const COLORS = { up: "#f97316", down: "#3b82f6", flat: "#26324f", none: "#0d1428" };

let coastPromise: Promise<string> | null = null;
const coast = () => (coastPromise ??= fetch("/coastline.txt").then((r) => r.text()));

/** Paint the grid as an equirectangular texture (x = lon + 180, y = 90 − lat), coastlines on top. */
function paint(grid: Grid, mode: Mode, enso: boolean, coastD: string) {
  const [ny, nx] = grid.shape, cw = 10, ch = 8;
  const c = document.createElement("canvas");
  c.width = nx * cw; c.height = ny * ch;
  const ctx = c.getContext("2d")!;
  for (let r = 0; r < ny; r++) for (let x = 0; x < nx; x++) {
    const k = r * nx + x;
    const s = enso && mode === "real" ? grid.slope_enso_decade[k] : grid.slope_decade[k];
    const sig = mode === "naive" ? grid.p_naive[k] < 0.05
      : mode === "noise" ? grid.p_noise[k] < 0.05
      : (enso ? grid.q_enso[k] : grid.q[k]) < 0.05;
    ctx.fillStyle = s == null ? COLORS.none : !sig ? COLORS.flat : s > 0 ? COLORS.up : COLORS.down;
    ctx.fillRect(x * cw, (ny - 1 - r) * ch, cw + 0.5, ch + 0.5); // row 0 is the south pole
  }
  ctx.save();
  ctx.scale(c.width / 360, c.height / 180);
  ctx.strokeStyle = "rgba(232,238,252,0.85)";
  ctx.lineWidth = 0.35;
  ctx.stroke(new Path2D(coastD));
  ctx.restore();
  return c.toDataURL("image/png");
}

export function Globe({ grid, mode, enso = false, spin = false, zoom = true, label }: {
  grid: Grid | null; mode: Mode; enso?: boolean; spin?: boolean; zoom?: boolean; label: string;
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

  const texture = useMemo(() => (grid && coastD ? paint(grid, mode, enso, coastD) : null), [grid, mode, enso, coastD]);

  const ready = () => {
    const g = globe.current;
    if (!g) return;
    g.pointOfView({ lat: 42, lng: -25, altitude: 2.1 }, 0);
    const c = g.controls();
    c.autoRotate = spin;
    c.autoRotateSpeed = 0.5;
    c.enableZoom = zoom;
  };

  return (
    <div ref={wrap} className="relative aspect-square w-full" role="img" aria-label={label}>
      {(!G || !texture) && <div className="absolute inset-[6%] animate-pulse rounded-full bg-gradient-to-br from-[#1b2a52] to-[#070c1f]" />}
      {G && texture && size > 0 && (
        <G ref={globe} width={size} height={size} backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={texture} showAtmosphere atmosphereColor="#5eead4" atmosphereAltitude={0.16}
          onGlobeReady={ready} animateIn={false} />
      )}
    </div>
  );
}
