"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// The /globe centrepiece: every grid square is a column on the sphere (one InstancedMesh). Heights and colours animate on
// the GPU between steps; false alarms break into particles on the way to the strict test; picking a place flies there.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import * as THREE from "three";
import type { Grid } from "@/lib/data";
import { coast, isSig, scaleOf, slopeOf, type Mode } from "./Globe";
import { R, addPolish, dirOf, flyTo, idleSpin, reducedMotion } from "./globeFx";

// Data colours as sRGB 0–1 (the shader writes them straight out). Same values as the CSS tokens.
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// Monochrome: rising = white, falling = cool grey; strength = "opacity" 0.35 → 1, mixed over the globe's surface so the
// solid columns need no transparency sorting. The accent (violet) is only for false alarms and the selected place.
const UP = hex("#f5f5f2"), DOWN = hex("#6b7280"), ALARM = hex("#c58ad6"), SURFACE = hex("#141415");
const over = (c: number[], a: number) => c.map((x, i) => SURFACE[i] + (x - SURFACE[i]) * a);
const alpha = (m: number) => 0.35 + 0.65 * Math.min(1, m);
const RISE_MS = 1200, DISSOLVE_MS = 1100, MAX_PARTICLES = 15000, PER_COLUMN = 20;
const H_MIN = 0.8, H_MAX = 9, H_ALARM = 4.5; // column heights in globe units (radius 100)
const STAGGER = 0.4;                       // share of the rise spent sweeping north → south

export type Target = { key: string; lat: number; lng: number; altitude?: number; lines: string[]; href?: string; linkLabel?: string };

const COLUMN_VS = `
attribute vec3 aDir; attribute vec2 aWid; attribute float aDelay; attribute float aH0; attribute float aH1; attribute vec3 aC0; attribute vec3 aC1;
uniform float uT; uniform float uS;
varying vec3 vC; varying float vL;
float ease(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
void main() {
  float e = ease(clamp((uT - aDelay * uS) / (1.0 - uS), 0.0, 1.0));
  float h = mix(aH0, aH1, e);
  if (h < 0.05) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vC = vec3(0.0); vL = 0.0; return; }
  vec3 up = aDir;
  vec3 east = normalize(cross(abs(up.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), up));
  vec3 north = cross(up, east);
  vec3 p = up * (${(R + 0.2).toFixed(1)} + position.z * h) + east * position.x * aWid.x + north * position.y * aWid.y;
  vec3 n = normalize(east * normal.x + north * normal.y + up * normal.z);
  vL = (0.5 + 0.5 * max(dot(n, normalize(cameraPosition - p)), 0.0)) * (0.75 + 0.25 * position.z);
  vC = mix(aC0, aC1, e);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const COLUMN_FS = `varying vec3 vC; varying float vL; void main() { gl_FragColor = vec4(vC * vL, 1.0); }`;
const DUST_VS = `
attribute vec3 aVel; attribute float aSize; uniform float uP; uniform float uScale; varying float vA;
void main() {
  vec3 p = position + aVel * (1.0 - pow(1.0 - uP, 2.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  vA = pow(1.0 - uP, 1.5);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FS = `uniform vec3 uColor; varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(uColor, vA); }`;

let baseTex: Promise<string> | null = null;
/** A plain dark sphere with ash coastlines: the columns carry the data. */
const baseTexture = () => (baseTex ??= coast().then((p) => {
  const c = document.createElement("canvas"), W = 2048, H = 1024;
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#141415"; ctx.fillRect(0, 0, W, H);
  if (p) { ctx.scale(W / 360, H / 180); ctx.strokeStyle = "rgba(236,235,232,0.55)"; ctx.lineWidth = 0.22; ctx.stroke(p); }
  return c.toDataURL("image/jpeg", 0.9);
}));

type Cols = { mesh: any; cells: number[]; h0: Float32Array; h1: Float32Array; c0: Float32Array; c1: Float32Array; delay: Float32Array; t0: number; ms: number; s: number };
/** One year of the T2M anomaly record (°C vs each square's own 1980–2025 mean), for the year scrubber. */
export type YearView = { a: Int8Array; idx: number; step: number; nodata: number; nCells: number };
const YEAR_MS = 280;

/** Height and colour of every column for one year: white = warmer than that square's average, grey = cooler. */
function yearTargets(y: YearView, cells: number[]) {
  const n = cells.length, h = new Float32Array(n), c = new Float32Array(n * 3);
  cells.forEach((k, i) => {
    const q = y.a[y.idx * y.nCells + k];
    if (q === y.nodata) return;
    const an = q * y.step, m = Math.min(1, Math.abs(an) / 3);
    h[i] = H_MIN + (H_MAX - H_MIN) * m;
    c.set(over(an >= 0 ? UP : DOWN, alpha(m)), i * 3);
  });
  return { h, c };
}

/** Target height and colour of every column for a step. */
function targets(grid: Grid, cells: number[], mode: Mode, enso: boolean) {
  const max = scaleOf(grid), n = cells.length;
  const h = new Float32Array(n), c = new Float32Array(n * 3);
  cells.forEach((k, i) => {
    const s = slopeOf(grid, k, mode === "real" ? "real" : "naive", enso) ?? 0;
    const height = H_MIN + (H_MAX - H_MIN) * Math.min(1, Math.abs(s) / max);
    const a = alpha(Math.abs(s) / max), dir = over(s >= 0 ? UP : DOWN, a); // rising = white, falling = grey, any variable
    let col = dir, hh = 0;
    if (mode === "naive") { if (isSig(grid, k, "naive", enso)) hh = height; }
    else if (mode === "noise") {
      if (grid.p_noise[k] < 0.05) { hh = H_ALARM; col = ALARM; }
      else if (isSig(grid, k, "naive", enso)) { hh = height; col = over(s >= 0 ? UP : DOWN, a * 0.3); }
    } else if (isSig(grid, k, "real", enso)) hh = height;
    h[i] = hh; c.set(col, i * 3);
  });
  return { h, c };
}

const ringCol = () => (t: number) => `rgba(197,138,214,${1 - t})`; // accent: the selected place
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export function ColumnGlobe({ grid, lat, lon, mode, enso, year = null, target, onPick, label, loading = "Loading…", loadingNote, onBuilt }: {
  grid: Grid | null; lat: number[]; lon: number[]; mode: Mode; enso: boolean; year?: YearView | null; target: Target | null;
  /** Shown until the first columns are on screen (the 3D engine and textures take a few seconds on a slow connection). */
  loading?: string;
  /** A second, smaller line under the loading status (e.g. "Starting the investigation…"). */
  loadingNote?: string;
  /** Called once, when the first frame with columns has been drawn. */
  onBuilt?: () => void;
  onPick: (p: { lat: number; lng: number }) => void; label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const [G, setG] = useState<any>(null);
  const [tex, setTex] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const [ready, setReady] = useState(false);
  const [built, setBuilt] = useState(false);
  const onBuiltRef = useRef(onBuilt);
  useEffect(() => { onBuiltRef.current = onBuilt; });
  const cols = useRef<Cols | null>(null);
  const uT = useRef({ value: 1 }), uS = useRef({ value: STAGGER });
  const prev = useRef<{ mode: Mode; enso: boolean; v: string; year: number | null } | null>(null);
  const targetRef = useRef<Target | null>(target);
  const spin = useRef<{ apply: () => void; cleanup: () => void } | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const [spot, setSpot] = useState<{ x: number; y: number; vis: boolean } | null>(null);

  useEffect(() => {
    import("react-globe.gl").then((m) => setG(() => m.default)).catch(() => {});
    baseTexture().then(setTex);
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Columns: rebuilt when the variable changes, retargeted when the step or El Niño changes.
  useEffect(() => {
    const g = globe.current;
    if (!ready || !g || !grid) return;
    const scene = g.scene();
    const key = { mode, enso, v: grid.var, year: year ? year.idx : null };
    let c = cols.current;
    const now = performance.now();
    // Where every column is right now (an interrupted rise continues from where it was).
    const progress = (i: number, cc: Cols) => easeIO(Math.min(1, Math.max(0, (Math.min(1, (now - cc.t0) / cc.ms) - cc.delay[i] * cc.s) / (1 - cc.s))));
    if (!c || prev.current?.v !== grid.var) {
      if (c) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); }
      const cells: number[] = [];
      grid.slope_decade.forEach((s: number | null, k: number) => { if (s != null) cells.push(k); });
      const n = cells.length, nx = grid.shape[1];
      const dir = new Float32Array(n * 3), wid = new Float32Array(n * 2), delay = new Float32Array(n);
      cells.forEach((k, i) => {
        const la = lat[Math.floor(k / nx)], lo = lon[k % nx], d = dirOf(la, lo);
        dir.set([d.x, d.y, d.z], i * 3);
        wid.set([Math.max(0.25, ((2 * Math.PI * R * 2.5) / 360) * Math.cos((la * Math.PI) / 180) * 0.55), ((2 * Math.PI * R * 2) / 360) * 0.55], i * 2);
        delay[i] = (90 - la) / 180;
      });
      const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
      const at = (name: string, arr: Float32Array, size: number) => geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
      at("aDir", dir, 3); at("aWid", wid, 2); at("aDelay", delay, 1);
      const zeroC = new Float32Array(n * 3);
      c = { mesh: null, cells, h0: new Float32Array(n), h1: new Float32Array(n), c0: zeroC, c1: new Float32Array(n * 3), delay, t0: now, ms: RISE_MS, s: STAGGER };
      at("aH0", c.h0, 1); at("aH1", c.h1, 1); at("aC0", c.c0, 3); at("aC1", c.c1, 3);
      const mat = new THREE.ShaderMaterial({ uniforms: { uT: uT.current, uS: uS.current }, vertexShader: COLUMN_VS, fragmentShader: COLUMN_FS });
      c.mesh = new THREE.InstancedMesh(geo, mat, n);
      c.mesh.frustumCulled = false;
      scene.add(c.mesh);
      cols.current = c;
      requestAnimationFrame(() => { setBuilt(true); onBuiltRef.current?.(); }); // the first frame with columns has been drawn
    } else {
      for (let i = 0; i < c.cells.length; i++) {
        const e = progress(i, c);
        c.h0[i] = c.h0[i] + (c.h1[i] - c.h0[i]) * e;
        for (let j = 0; j < 3; j++) c.c0[i * 3 + j] = c.c0[i * 3 + j] + (c.c1[i * 3 + j] - c.c0[i * 3 + j]) * e;
      }
    }
    // A year from the scrubber (T2M only) replaces the step picture; years change quickly and all at once.
    const useYear = !!year && grid.var === "T2M";
    const { h, c: col } = useYear ? yearTargets(year!, c.cells) : targets(grid, c.cells, mode, enso);
    const quick = useYear && prev.current?.year != null;
    c.ms = quick ? YEAR_MS : RISE_MS; c.s = quick ? 0 : STAGGER; uS.current.value = c.s;
    // Luck test → strict test: false alarms that don't survive vanish at once and become dust.
    const dissolve = !useYear && prev.current?.year == null && prev.current?.mode === "noise" && mode === "real" && prev.current.v === grid.var && !reducedMotion();
    const gone: number[] = [];
    if (dissolve) c.cells.forEach((k, i) => { if (grid.p_noise[k] < 0.05 && h[i] === 0) { gone.push(i); c!.h0[i] = 0; } });
    c.h1.set(h); c.c1.set(col);
    if (!prev.current || prev.current.v !== grid.var) c.c0.set(col); // a new variable rises in its own colours
    for (const a of ["aH0", "aH1", "aC0", "aC1"]) c.mesh.geometry.getAttribute(a).needsUpdate = true;
    prev.current = key;
    c.t0 = now;
    uT.current.value = reducedMotion() ? 1 : 0;
    let raf = 0;
    const tick = (t: number) => {
      uT.current.value = Math.min(1, (t - c!.t0) / c!.ms);
      if (uT.current.value < 1) raf = requestAnimationFrame(tick);
    };
    if (!reducedMotion()) raf = requestAnimationFrame(tick);

    let disposeDust = () => {};
    if (gone.length) {
      const per = Math.max(1, Math.min(PER_COLUMN, Math.floor(MAX_PARTICLES / gone.length))), m = gone.length * per;
      const pos = new Float32Array(m * 3), vel = new Float32Array(m * 3), sz = new Float32Array(m);
      const nx = grid.shape[1];
      let p = 0;
      for (const i of gone) {
        const k = c.cells[i], d = dirOf(lat[Math.floor(k / nx)], lon[k % nx]);
        for (let j = 0; j < per; j++, p++) {
          const r0 = R + 0.2 + Math.random() * H_ALARM, jitter = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.6);
          const at = d.clone().multiplyScalar(r0).add(jitter), out = d.clone().multiplyScalar(6 + Math.random() * 16).add(jitter.multiplyScalar(4));
          pos.set([at.x, at.y, at.z], p * 3); vel.set([out.x, out.y, out.z], p * 3); sz[p] = 0.7 + Math.random() * 0.7;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(sz, 1));
      const cam = g.camera(), pr = g.renderer().getPixelRatio();
      const mat = new THREE.ShaderMaterial({
        uniforms: { uP: { value: 0 }, uScale: { value: (sizeRef.current.h * pr) / (2 * Math.tan((cam.fov * Math.PI) / 360)) }, uColor: { value: new THREE.Vector3(...ALARM) } },
        vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false,
      });
      const dust = new THREE.Points(geo, mat);
      dust.frustumCulled = false;
      scene.add(dust);
      const t0 = performance.now();
      let draf = 0;
      const step = (t: number) => {
        mat.uniforms.uP.value = Math.min(1, (t - t0) / DISSOLVE_MS);
        if (mat.uniforms.uP.value < 1) draf = requestAnimationFrame(step); else disposeDust();
      };
      draf = requestAnimationFrame(step);
      disposeDust = () => { cancelAnimationFrame(draf); scene.remove(dust); geo.dispose(); mat.dispose(); disposeDust = () => {}; };
    }
    return () => { cancelAnimationFrame(raf); disposeDust(); };
  }, [ready, grid, mode, enso, lat, lon, year]);

  // Fly to the picked place, pulse a ring there, then draw the HUD leader line.
  useEffect(() => {
    targetRef.current = target;
    spin.current?.apply();
    const g = globe.current;
    if (!ready || !g || !target) return;
    const alt = target.altitude ?? Math.min(g.pointOfView().altitude, sizeRef.current.w < 640 ? 2.6 : 1.9); // phones stay further out
    return flyTo(g, { lat: target.lat, lng: target.lng, altitude: alt }, () => setArrived(target.key));
    // Fly only when the place changes; new label lines for the same place (e.g. another step) just redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, target?.key]);

  // Keep the leader line on the place while the globe turns or zooms.
  const on = !!target && arrived === target.key;
  const tLat = target?.lat, tLng = target?.lng;
  useEffect(() => {
    if (!on || tLat == null || tLng == null) return;
    let raf = 0, last = { x: -1e9, y: -1e9, vis: false };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const g = globe.current;
      if (!g || document.hidden) return;
      const { x, y } = g.getScreenCoords(tLat, tLng, 0);
      const cam = g.camera().position, d = dirOf(tLat, tLng);
      const vis = d.dot(cam.clone().normalize()) > R / cam.length() + 0.02; // in front of the horizon
      if (Math.abs(x - last.x) > 0.5 || Math.abs(y - last.y) > 0.5 || vis !== last.vis) setSpot((last = { x, y, vis }));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [on, tLat, tLng]);

  // Give everything back on unmount: our objects, then the WebGL context (browsers allow only a few).
  useEffect(() => () => {
    spin.current?.cleanup();
    const c = cols.current, g = globe.current;
    if (c) { g?.scene().remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); }
    (g as any)?.__disposePolish?.();
    g?.renderer().forceContextLoss?.();
  }, []);

  const rings = useMemo(() => (on && tLat != null && tLng != null ? [{ lat: tLat, lng: tLng }] : []), [on, tLat, tLng]);
  const onReady = () => {
    const g = globe.current;
    if (!g) return;
    g.renderer().setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    g.pointOfView({ lat: 28, lng: -20, altitude: size.w < 640 ? 2.9 : 2.2 }, 0);
    const ctl = g.controls();
    ctl.enableZoom = true; ctl.minDistance = 140; ctl.maxDistance = 700;
    (g as any).__disposePolish = addPolish(g.scene());
    spin.current = idleSpin(g, () => !targetRef.current);
    setReady(true);
  };

  const label2 = (() => {
    if (!on || !target || !spot || !size.w) return null;
    const W = Math.min(260, size.w - 24), right = spot.x > size.w * 0.55;
    const x = Math.max(12, Math.min(size.w - W - 12, right ? spot.x - W - 56 : spot.x + 56));
    const y = Math.max(84, Math.min(size.h - 150, spot.y - 90));
    const ax = right ? x + W : x, ay = y + 14;
    return (
      <div aria-live="polite" className="pointer-events-none absolute inset-0" style={{ opacity: spot.vis ? 1 : 0, transition: "opacity 200ms" }}>
        <svg aria-hidden="true" width={size.w} height={size.h} className="absolute inset-0 overflow-visible">
          <motion.path key={target.key} d={`M${spot.x} ${spot.y} L${ax} ${ay}`} fill="none" stroke="var(--ink-muted)" strokeWidth={1}
            initial={reducedMotion() ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} />
          <circle cx={spot.x} cy={spot.y} r={3} fill="var(--false-alarm)" />
        </svg>
        <motion.div key={target.key} initial={reducedMotion() ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.3 }}
          className="pointer-events-auto absolute flex flex-col gap-1 rounded-[var(--radius-sm)] border border-hairline bg-[color-mix(in_srgb,var(--ground)_90%,transparent)] px-3 py-2.5" style={{ left: x, top: y, width: W }}>
          {target.lines.map((ln, i) => <span key={i} className={`hud ${i === 0 ? "!text-[var(--ink)]" : ""}`}>{ln}</span>)}
          {target.href && <Link href={target.href} className="hud ulink mt-1 self-start !text-[var(--ink)] no-underline">▸ {target.linkLabel ?? "Open case"}</Link>}
        </motion.div>
      </div>
    );
  })();

  return (
    <div ref={wrap} className="absolute inset-0" role="img" aria-label={label}>
      {(!G || !tex) && <div className="absolute left-1/2 top-1/2 aspect-square w-[min(70vh,80vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ground-raised)] motion-safe:animate-pulse" />}
      {G && tex && size.w > 0 && (
        <G ref={globe} width={size.w} height={size.h} backgroundColor="rgba(0,0,0,0)" globeImageUrl={tex} showAtmosphere={false}
          ringsData={rings} ringColor={ringCol} ringMaxRadius={5} ringPropagationSpeed={4} ringRepeatPeriod={1000}
          onGlobeClick={onPick} onGlobeReady={onReady} animateIn={false} />
      )}
      {label2}
      {!built && (
        <div role="status" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="hud nav-glass flex items-center gap-2 rounded-full px-4 py-2 !text-[var(--ink)]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--ink)] motion-safe:animate-pulse" />{loading}</p>
          {loadingNote && <p className="hud !text-[11px]">{loadingNote}</p>}
        </div>
      )}
    </div>
  );
}
