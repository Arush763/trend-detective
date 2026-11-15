/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared 3D pieces for react-globe.gl globes: fly-to, idle spin, fresnel rim, starfield. Globe radius is 100 units.
import * as THREE from "three";

export const R = 100;
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** three-globe's polar2Cartesian, as a unit vector. */
export const dirOf = (lat: number, lng: number) => {
  const phi = ((90 - lat) * Math.PI) / 180, theta = ((90 - lng) * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
};
const latLngOf = (v: any) => ({ lat: 90 - (Math.acos(Math.max(-1, Math.min(1, v.y))) * 180) / Math.PI, lng: 90 - (Math.atan2(v.z, v.x) * 180) / Math.PI });

/** cubic-bezier(x1, y1, x2, y2) as an easing function (Newton's method on x, as browsers do). */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const B = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const dB = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0 || x >= 1) return Math.min(1, Math.max(0, x));
    let t = x;
    for (let i = 0; i < 6; i++) { const d = dB(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (B(t, x1, x2) - x) / d; }
    return B(Math.min(1, Math.max(0, t)), y1, y2);
  };
}
export const easeFly = bezier(0.65, 0, 0.35, 1);

/** Rotate the camera along the great circle to a place (slerp, 1.1 s, cubic-bezier(.65,0,.35,1)). Returns a cancel function. */
export function flyTo(g: any, to: { lat: number; lng: number; altitude: number }, onDone?: () => void, ms = 1100) {
  const from = g.pointOfView();
  if (reducedMotion()) { g.pointOfView(to, 0); onDone?.(); return () => {}; }
  const a = dirOf(from.lat, from.lng), b = dirOf(to.lat, to.lng), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion().setFromUnitVectors(a, b);
  const t0 = performance.now(), q = new THREE.Quaternion();
  let raf = 0;
  const tick = (now: number) => {
    const e = easeFly(Math.min(1, (now - t0) / ms));
    q.slerpQuaternions(q0, q1, e);
    g.pointOfView({ ...latLngOf(a.clone().applyQuaternion(q)), altitude: from.altitude + (to.altitude - from.altitude) * e }, 0);
    if (e < 1) raf = requestAnimationFrame(tick); else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** Slow idle spin that stops while someone drags and comes back 4 s after they let go. Returns a cleanup function. */
export function idleSpin(g: any, on: () => boolean) {
  const c = g.controls();
  let timer = 0;
  const apply = () => { c.autoRotate = on() && !document.hidden && !reducedMotion(); };
  const start = () => { window.clearTimeout(timer); c.autoRotate = false; };
  const end = () => { window.clearTimeout(timer); timer = window.setTimeout(apply, 4000); };
  c.autoRotateSpeed = 0.35;
  c.addEventListener("start", start);
  c.addEventListener("end", end);
  document.addEventListener("visibilitychange", apply);
  apply();
  return { apply, cleanup: () => { window.clearTimeout(timer); c.removeEventListener("start", start); c.removeEventListener("end", end); document.removeEventListener("visibilitychange", apply); } };
}

/** Fresnel atmosphere rim (bright at the edge of the disc, clear in the middle) and a faint starfield. Returns a dispose function. */
export function addPolish(scene: any, rimColor = "#3b5cc4") {
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.13, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(rimColor) } },
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      // Seen from outside, |dot| is 0 at the rim sphere's outer edge and about 0.47 at the globe's edge: glow there, fade outwards.
      fragmentShader: "uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(abs(dot(vN, vV)) * 2.1, 0.0, 1.0), 2.5); gl_FragColor = vec4(uColor, f * 0.7); }",
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  const n = 1400, pos = new Float32Array(n * 3);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 1600 + rnd() * 1400, k = Math.sqrt(1 - u * u);
    pos.set([r * k * Math.cos(th), r * u, r * k * Math.sin(th)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ecebe8", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(rim, stars);
  return () => {
    scene.remove(rim, stars);
    rim.geometry.dispose(); rim.material.dispose(); sg.dispose(); stars.material.dispose();
  };
}
