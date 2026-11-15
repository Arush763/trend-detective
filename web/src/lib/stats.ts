// One-to-one port of pipeline/stats.py for a single yearly series, so a place picked anywhere on Earth gets
// exactly the same tests as the 21 built-in regions. Checked against the Python results in scripts/check-stats.mjs.

const Z975 = 1.959963984540054; // norm.ppf(0.975)

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
/** numpy's round(): halves go to the even neighbour. */
const roundEven = (x: number) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 ? r - 1 : r; };

/** Standard normal CDF (erfc with a Chebyshev fit, |error| < 1.2e-7: Numerical Recipes erfcc). */
export function normCdf(x: number) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - r / 2 : r / 2;
}

// Regularized incomplete beta (Numerical Recipes betacf), for the Student t CDF.
function betacf(a: number, b: number, x: number) {
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
}
function lgamma(x: number) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, s = 1.000000000190015;
  const t = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}
function ibeta(a: number, b: number, x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** Two-sided Student t p-value. */
const tTwoSided = (t: number, dof: number) => ibeta(dof / 2, 0.5, dof / (dof + t * t));

export function senSlope(y: number[]) {
  const n = y.length, slopes: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) slopes.push((y[j] - y[i]) / (j - i));
  const slope = median(slopes);
  return { slope, intercept: median(y.map((v, t) => v - slope * t)), slopes };
}

export function mkS(y: number[]) {
  let s = 0;
  for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++) s += Math.sign(y[j] - y[i]);
  return s;
}

function varS(y: number[]) {
  const n = y.length, counts = new Map<number, number>();
  for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1);
  let ties = 0;
  for (const c of counts.values()) if (c > 1) ties += c * (c - 1) * (2 * c + 5);
  return (n * (n - 1) * (2 * n + 5) - ties) / 18;
}

/** Average ranks, 1-based (scipy rankdata). */
function rank(a: number[]) {
  const idx = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]), r = new Array<number>(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

/** Biased autocorrelation at lags 0..nlags. */
function acf(x: number[], nlags: number) {
  const m = mean(x), c = x.map((v) => v - m), den = c.reduce((s, v) => s + v * v, 0), out = [1];
  for (let k = 1; k <= nlags; k++) { let s = 0; for (let i = 0; i + k < c.length; i++) s += c[i] * c[i + k]; out.push(s / den); }
  return out;
}

export type MK = { S: number; z: number; p: number; slope: number; intercept: number; ci_low: number; ci_high: number };

/** Mann-Kendall with the Hamed & Rao correction (conservative: may only widen the variance) and the Gilbert CI. */
export function mannKendall(y: number[], correctAutocorr = true): MK {
  const n = y.length, S = mkS(y);
  let v = varS(y);
  const { slope, intercept, slopes } = senSlope(y);
  if (correctAutocorr) {
    const R = rank(y.map((val, i) => val - (i + 1) * slope));
    const a = acf(R, n - 1), bound = Z975 / Math.sqrt(n);
    let sni = 0;
    for (let k = 1; k < n; k++) if (Math.abs(a[k]) > bound) sni += (n - k) * (n - k - 1) * (n - k - 2) * a[k];
    v *= Math.max(1, 1 + (2 / (n * (n - 1) * (n - 2))) * sni);
  }
  const z = S > 0 ? (S - 1) / Math.sqrt(v) : S < 0 ? (S + 1) / Math.sqrt(v) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  const N = slopes.length, srt = slopes.sort((p1, q1) => p1 - q1), C = Z975 * Math.sqrt(v);
  const clip = (i: number) => Math.min(N - 1, Math.max(0, i));
  return { S, z, p, slope, intercept, ci_low: srt[clip(roundEven((N - C) / 2) - 1)], ci_high: srt[clip(roundEven((N + C) / 2))] };
}

/** Benjamini-Hochberg q-values (non-finite p stay NaN). */
export function fdrBh(p: number[]) {
  const ok = p.map((x, i) => [x, i] as const).filter(([x]) => Number.isFinite(x)).sort((a, b) => a[0] - b[0]);
  const m = ok.length, q = p.map(() => NaN);
  let run = Infinity;
  for (let r = m - 1; r >= 0; r--) { run = Math.min(run, (ok[r][0] * m) / (r + 1)); q[ok[r][1]] = Math.min(run, 1); }
  return q;
}

/** Weatherhead et al. (1998) years needed, with the √12 factor for yearly means (see stats.py). */
export function yearsToDetect(y: number[], slope: number) {
  const intercept = median(y.map((v, t) => v - slope * t)), resid = y.map((v, t) => v - (intercept + slope * t));
  const m = mean(resid), sigma = Math.sqrt(resid.reduce((s, v) => s + (v - m) ** 2, 0) / (resid.length - 1));
  const phi = Math.min(0.9, Math.max(-0.5, acf(resid, 1)[1]));
  const nstar = ((3.3 * Math.sqrt(12) * sigma) / Math.abs(slope) * Math.sqrt((1 + phi) / (1 - phi))) ** (2 / 3);
  return { nstar, sigma, phi };
}

/** Fit y = a + b·t + c·ENSO, subtract c·ENSO. Returns the adjusted series, c and its p-value. */
export function removeEnso(y: number[], enso: number[]) {
  const n = y.length, tm = (n - 1) / 2, X = y.map((_, t) => [1, t - tm, enso[t]]);
  const XtX = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const inv = invert3(XtX), Xty = [0, 1, 2].map((i) => X.reduce((s, r, t) => s + r[i] * y[t], 0));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const resid = y.map((v, t) => v - (beta[0] + beta[1] * X[t][1] + beta[2] * X[t][2]));
  const dof = n - 3, s2 = resid.reduce((s, v) => s + v * v, 0) / dof, se = Math.sqrt(s2 * inv[2][2]);
  return { adjusted: y.map((v, t) => v - beta[2] * enso[t]), coef: beta[2], p: tTwoSided(beta[2] / se, dof) };
}
function invert3(m: number[][]) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]].map((r) => r.map((x) => x / det));
}

/** Share of 2,000 shuffles whose |S| is at least the observed one (seeded, so a place always gives the same answer). */
export function permutationP(y: number[], nPerm = 2000, seed = 1) {
  const obs = Math.abs(mkS(y)), a = [...y];
  let s = seed >>> 0, hits = 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < nPerm; k++) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (Math.abs(mkS(a)) >= obs) hits++;
  }
  return (hits + 1) / (nPerm + 1);
}

export const WF_LABELS = ["no signal", "emerging", "confirmed", "continuing", "reversed", "faded"];
/** Trend in the first part, then checked in the part the first test never saw (codes as in stats.py). */
export function walkForward(y: number[], split: number) {
  const a = mannKendall(y.slice(0, split)), b = mannKendall(y.slice(split));
  const sa = a.p < 0.05, sb = b.p < 0.05, same = Math.sign(a.slope) === Math.sign(b.slope);
  const code = !sa && sb ? 1 : sa && sb && same ? 2 : sa && !sb && same ? 3 : sa && sb && !same ? 4 : sa && !sb && !same ? 5 : 0;
  return { code, a, b };
}

/** No gaps, not constant, mostly distinct values (stats.py valid_rows). */
export const validSeries = (y: number[]) =>
  y.every(Number.isFinite) && new Set(y).size >= 0.5 * y.length && Math.max(...y) > Math.min(...y);
