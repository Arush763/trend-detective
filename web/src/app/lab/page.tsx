"use client";
// "Fool the detector": seeded noise (lag-1 autocorrelation 0.3) plus a hidden trend you choose, run live through the
// same statistics as every case (lib/stats.ts, a port of pipeline/stats.py). Nothing here is NASA data: it's a sandbox.
import { useMemo, useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { Card, SectionLabel } from "@/components/ui";
import { fmt, pfmt, signed } from "@/lib/data";
import { mannKendall, permutationP, yearsToDetect } from "@/lib/stats";

const YEARS = Array.from({ length: 46 }, (_, i) => 1980 + i);
const PHI = 0.3, SD = 0.5, MAX = 1.0; // year-to-year memory, wobble (°C, like a temperature record), slider top (°C/decade)

/** AR(1) noise, seeded: e[t] = φ·e[t−1] + √(1−φ²)·σ·z, with z from a seeded Box-Muller. */
function noise(seed: number) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const z = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const out: number[] = [];
  let e = SD * z();
  for (let i = 0; i < YEARS.length; i++) { out.push(e); e = PHI * e + Math.sqrt(1 - PHI * PHI) * SD * z(); }
  return out;
}

function Result({ name, pass, detail, fooled }: { name: string; pass: boolean; detail: string; fooled: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-[var(--radius-sm)] border p-4 ${fooled ? "border-[var(--false-alarm)]" : "border-hairline"}`}>
      <span className="hud">{name}</span>
      <span className={`font-display text-[22px] ${fooled ? "text-false-alarm" : pass ? "text-ink" : "text-ink-dim"}`}>{pass ? "Trend found" : "No trend"}{fooled ? " · fooled" : ""}</span>
      <span className="num text-[13px] text-ink-dim">{detail}</span>
    </div>
  );
}

export default function Lab() {
  const [seed, setSeed] = useState(1);
  const [strength, setStrength] = useState(0.3); // °C per decade
  const [sweep, setSweep] = useState<{ simple: number; strict: number } | null>(null);
  const e = useMemo(() => noise(seed), [seed]);
  const y = useMemo(() => e.map((x, i) => +(x + (strength / 10) * i).toFixed(4)), [e, strength]);
  const r = useMemo(() => {
    const simple = mannKendall(y, false), strict = mannKendall(y), luck = permutationP(y, 200, seed), wob = yearsToDetect(y, strict.slope);
    const snr = Math.abs(strict.slope * (YEARS.length - 1)) / wob.sigma;
    return { simple, strict, luck, snr, sigma: wob.sigma };
  }, [y, seed]);
  const hidden = strength > 0;
  const found = r.simple.p < 0.05;

  // "Hide no trend": noise only, 100 seeds. How often does it pass the simple test, and the corrected one?
  const hideNone = () => {
    setStrength(0);
    let simple = 0, strict = 0;
    for (let k = 1; k <= 100; k++) { const n = noise(1000 + k); if (mannKendall(n, false).p < 0.05) simple++; if (mannKendall(n).p < 0.05) strict++; }
    setSweep({ simple, strict });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-[860px] flex-col gap-3">
        <SectionLabel>The lab · Fool the detector</SectionLabel>
        <h1 className="text-balance font-display text-[clamp(36px,5vw,64px)] leading-[0.98] tracking-[-0.02em]">Can you hide a trend the detector misses, or fake one it believes?</h1>
        <p className="max-w-[62ch] text-lg leading-relaxed text-ink-dim">
          This is made-up data, not NASA&apos;s: 46 years of random wobble ({SD} °C a year, and each year a little like the one before, as real weather is), plus a hidden trend you set. The detector is the same code that checks every real case.
        </p>
      </header>

      <Card className="flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex min-w-[260px] flex-1 flex-col gap-2">
            <span className="hud">Hidden trend: <span className="num !text-ink">{signed(strength)} °C per decade</span></span>
            <input type="range" min={0} max={MAX} step={0.01} value={strength} onChange={(ev) => { setStrength(+ev.target.value); setSweep(null); }} className="accent-[var(--ink)]" aria-valuetext={`${strength} degrees per decade`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="pill" onClick={() => { setSeed((s) => s + 1); setSweep(null); }}>New noise</button>
            <button type="button" className="pill" onClick={hideNone}>Hide no trend</button>
          </div>
        </div>
        <TrendChart years={YEARS} y={y} perYear={1} slope={r.strict.slope} intercept={r.strict.intercept} ci={[r.strict.ci_low, r.strict.ci_high]}
          trendColor={r.strict.slope >= 0 ? "var(--warming)" : "var(--cooling)"} units="°C" title="Made-up yearly values with your hidden trend" annotate={false} />
        <p className="text-sm text-ink-dim">The line is the Theil-Sen trend the detector sees: {signed(r.strict.slope * 10)} °C per decade (you hid {signed(strength)}).</p>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Result name="Simple test (Mann-Kendall)" pass={found} detail={`p = ${pfmt(r.simple.p)}`} fooled={hidden ? !found : found} />
        <Result name="Luck test (200 shuffles)" pass={r.luck < 0.05} detail={`p = ${pfmt(r.luck)}`} fooled={hidden ? r.luck >= 0.05 : r.luck < 0.05} />
        <Result name="Beats the noise (change ≥ 2× wobble)" pass={r.snr >= 2} detail={`change ${fmt(r.snr, 2)}× the ${fmt(r.sigma, 2)} °C wobble`} fooled={hidden ? r.snr < 2 : r.snr >= 2} />
      </section>
      <p className="text-[14px] text-ink-dim"><span className="text-false-alarm">Violet = fooled</span>: noise passed as a trend, or a hidden trend slipped past.</p>

      {sweep && (
        <div aria-live="polite"><Card className="flex flex-col gap-2">
          <SectionLabel>Noise only · 100 tries</SectionLabel>
          <p className="font-display text-[clamp(22px,2.6vw,30px)] leading-tight">
            Noise alone fooled the simple test <span className="num text-false-alarm">{sweep.simple}</span> times in 100.
          </p>
          <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-dim">
            With no trend at all, about 5 in 100 should pass by luck. Because each year resembles the one before, plain noise passes more often. The autocorrelation-corrected test (Hamed-Rao, used in every case) was fooled {sweep.strict} times: it only steps in when that year-to-year memory is clearly visible, and in 46 years it often isn&apos;t. Test 12,960 places and even a few percent becomes hundreds of false alarms, which is why the strict test&apos;s last step corrects for testing every place at once.
          </p>
        </Card></div>
      )}
    </div>
  );
}
