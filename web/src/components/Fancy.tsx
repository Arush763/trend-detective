"use client";
// Atmosphere: light leaks, particle dust, plus the warming stripes (which are data).
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./ui";
import { get } from "@/lib/data";

/** Soft colored light leaking in from the corners (navy accent, 20-35%). Parent must be `relative`; keep it away from numbers. */
export function LightLeaks({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute -left-[12%] -top-[22%] h-[70%] min-h-[240px] w-[55%] min-w-[320px] rounded-full opacity-[0.2]" style={{ background: "radial-gradient(closest-side, var(--accent), transparent)", filter: "blur(40px)" }} />
      <div className="absolute -bottom-[26%] -right-[12%] h-[75%] min-h-[260px] w-[55%] min-w-[340px] rounded-full opacity-[0.22]" style={{ background: "radial-gradient(closest-side, var(--accent), transparent)", filter: "blur(48px)" }} />
    </div>
  );
}

// Seeded so every render is identical.
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Ambient particle dust: tiny 1-2px ink specks drifting slowly on one small canvas. Pauses when the tab is hidden or the canvas is off-screen; renders nothing under reduced motion. Parent must be `relative`. */
export function Dust({ className = "", count = 110 }: { className?: string; count?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, host = canvas?.parentElement;
    if (reduce || !canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const n = Math.min(count, window.innerWidth < 768 ? 60 : 400);
    const r = rng(11);
    const dots = Array.from({ length: n }, () => ({ x: r(), y: r(), s: 0.5 + r() * 0.75, a: 0.15 + r() * 0.3, vx: (r() - 0.5) * 0.004, vy: -0.002 - r() * 0.006 }));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0, last = 0, visible = true;
    const size = () => { w = host.clientWidth; h = host.clientHeight; canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); };
    const draw = (t: number) => {
      raf = 0;
      const dt = Math.min(64, t - last || 16); last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ecebe8";
      for (const d of dots) {
        d.x += d.vx * dt * 0.06; d.y += d.vy * dt * 0.06;
        if (d.x < 0) d.x += 1; else if (d.x > 1) d.x -= 1;
        if (d.y < 0) d.y += 1;
        ctx.globalAlpha = d.a;
        ctx.beginPath(); ctx.arc(d.x * w, d.y * h, d.s, 0, 6.2832); ctx.fill();
      }
      schedule();
    };
    function schedule() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; };
    const onVis = () => (document.hidden ? stop() : schedule());
    size();
    const ro = new ResizeObserver(size); ro.observe(host);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) schedule(); else stop(); });
    io.observe(host);
    document.addEventListener("visibilitychange", onVis);
    schedule();
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [reduce, count]);
  if (reduce) return null;
  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}

/** @deprecated Use Dust. Kept so unmigrated scenes still compile. */
export const Stars = Dust;
/** @deprecated Use LightLeaks. Kept so unmigrated scenes still compile. */
export const Aurora = LightLeaks;

// Warming stripes in the site's diverging data colours: blue for cooler years → orange for warmer years.
function stripe(t: number) {
  const stops = [[22, 40, 96], [45, 90, 190], [91, 147, 255], [150, 170, 210], [200, 175, 150], [255, 170, 110], [255, 138, 61], [190, 80, 20]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return `rgb(${stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f)).join(",")})`;
}

/** One stripe per year of NASA MERRA-2 global air temperature, coldest blue to warmest red. */
export function WarmingStripes({ className = "" }: { className?: string }) {
  const [y, setY] = useState<number[] | null>(null);
  useEffect(() => { get("regions/global.json").then((r) => setY(r.variables.T2M.annual)).catch(() => {}); }, []);
  if (!y) return <div className={className} />;
  const lo = Math.min(...y), hi = Math.max(...y);
  return (
    <div className={`flex ${className}`} role="img" aria-label={`Warming stripes: global average air temperature each year from 1980 (left) to 2025 (right), from NASA MERRA-2. Blue is cooler, orange is warmer.`}>
      {y.map((v, i) => <div key={i} className="h-full flex-1" style={{ background: stripe((v - lo) / (hi - lo)) }} />)}
    </div>
  );
}
