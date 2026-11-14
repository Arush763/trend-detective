"use client";
// Decorative pieces: twinkling stars, aurora glows, warming stripes.
import { useEffect, useState } from "react";
import { get } from "@/lib/data";

// Seeded random so server and client place the stars identically (no hydration mismatch).
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const STARS = (() => { const r = rng(7); return Array.from({ length: 70 }, () => ({ x: r() * 100, y: r() * 100, s: 6 + r() * 10, d: r() * 4, warm: r() > 0.35 })); })();

export function Stars({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {STARS.map((st, i) => (
        <svg key={i} viewBox="0 0 10 10" width={st.s} height={st.s} className="twinkle absolute"
          style={{ left: `${st.x}%`, top: `${st.y}%`, animationDelay: `${st.d}s`, color: st.warm ? "#fbbf24" : "#c7d2fe" }}>
          <path d="M5 0 L5.9 4.1 L10 5 L5.9 5.9 L5 10 L4.1 5.9 L0 5 L4.1 4.1 Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

/** Big soft glowing blobs behind a section. */
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-[70%] overflow-hidden ${className}`}>
      <div className="absolute -bottom-1/3 left-[-10%] h-[90%] w-[60%] rounded-full bg-[#2dd4bf] opacity-50 blur-[110px]" />
      <div className="absolute -bottom-1/3 left-[30%] h-[80%] w-[50%] rounded-full bg-[#8b5cf6] opacity-50 blur-[120px]" />
      <div className="absolute -bottom-1/3 right-[-10%] h-[90%] w-[50%] rounded-full bg-[#f97316] opacity-45 blur-[120px]" />
    </div>
  );
}

// Diverging blue → white → red, the classic "warming stripes" palette.
function stripe(t: number) {
  const stops = [[8, 48, 107], [33, 113, 181], [107, 174, 214], [198, 219, 239], [252, 187, 161], [251, 106, 74], [203, 24, 29], [103, 0, 13]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return `rgb(${stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f)).join(",")})`;
}

/** One stripe per year of NASA MERRA-2 global air temperature, coldest blue to warmest red. */
export function WarmingStripes({ className = "" }: { className?: string }) {
  const [y, setY] = useState<number[] | null>(null);
  useEffect(() => { get("regions/global.json").then((r) => setY(r.variables.T2M.annual)); }, []);
  if (!y) return <div className={className} />;
  const lo = Math.min(...y), hi = Math.max(...y);
  return (
    <div className={`flex ${className}`} role="img" aria-label={`Warming stripes: global average air temperature each year from 1980 (left) to 2025 (right), from NASA MERRA-2. Blue is cooler, red is warmer.`}>
      {y.map((v, i) => <div key={i} className="h-full flex-1" style={{ background: stripe((v - lo) / (hi - lo)) }} />)}
    </div>
  );
}
