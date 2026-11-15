/* eslint-disable @typescript-eslint/no-explicit-any */
// Checks lib/stats.ts against pipeline/stats.py on identical inputs (every built-in region x variable series).
// Run from web/: node scripts/check-stats.ts   (needs the pipeline's Python environment)
import { execFileSync } from "node:child_process";
import { mannKendall, removeEnso, walkForward, yearsToDetect } from "../src/lib/stats.ts";

const ref = JSON.parse(execFileSync("python", ["stats_reference.py"], { cwd: new URL("../../pipeline/", import.meta.url), maxBuffer: 1 << 26 }).toString());
const P = new Set(["p_hr", "p_naive", "enso_p", "p_enso_hr"]);
// The ENSO-adjusted series differs from numpy's by ~1e-13, which can flip a tie in its ranks: allow 2% there.
const TOL: Record<string, number> = { p_enso_hr: 0.02 };
let bad = 0, n = 0;
for (const [k, py] of Object.entries<any>(ref.series)) {
  const y: number[] = py.annual, hr = mannKendall(y), e = removeEnso(y, ref.enso), yd = yearsToDetect(y, hr.slope);
  const ts: Record<string, number> = { slope: hr.slope, ci_low: hr.ci_low, ci_high: hr.ci_high, p_hr: hr.p, p_naive: mannKendall(y, false).p,
    enso_coef: e.coef, enso_p: e.p, p_enso_hr: mannKendall(e.adjusted).p, wf: walkForward(y, ref.split).code, sigma: yd.sigma, phi: yd.phi, nstar: yd.nstar };
  for (const [s, x] of Object.entries(ts)) {
    n++;
    const d = Math.abs(x - py[s]) / Math.max(1e-12, Math.abs(py[s]), P.has(s) ? 1e-3 : 0);
    if (d > (TOL[s] ?? 1e-5)) { bad++; console.log(`${k} ${s}: ${x} vs ${py[s]}`); }
  }
}
console.log(bad ? `${bad} of ${n} statistics differ` : `all ${n} statistics match stats.py`);
process.exit(bad ? 1 : 0);
