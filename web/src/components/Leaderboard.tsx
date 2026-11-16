"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// "Which variables can you trust?": per variable, how many of the simple test's trends survive the strict test
// (trust = strict passes / simple passes) and how many false alarms shuffled data produced (noise = false alarms /
// simple passes). Straight from meta.grid_summary; nothing new is computed in the pipeline.
import Link from "next/link";
import { NICE, type Meta } from "@/lib/data";
import { SectionLabel } from "./ui";

const n0 = (x: number) => x.toLocaleString("en-US");

export function trustRows(meta: Meta) {
  return Object.entries<any>(meta.grid_summary)
    .map(([v, s]) => ({ v, name: NICE[v].short, simple: s.naive_sig, fake: s.noise_sig, real: s.real_sig, trust: s.real_sig / Math.max(1, s.naive_sig), noise: s.noise_sig / Math.max(1, s.naive_sig) }))
    .sort((a, b) => b.trust - a.trust);
}

/** One sentence from the data: the most and the least trustworthy variable. */
export function takeaway(rows: ReturnType<typeof trustRows>) {
  const top = rows[0], low = rows[rows.length - 1], pct = (x: number) => Math.round(100 * x);
  return `${top.name} trends are ${pct(top.trust)}% real. ${low.name} trends are ${low.trust < 0.5 ? `mostly noise (${pct(low.trust)}% real)` : `only ${pct(low.trust)}% real`}.`;
}

/** Ranked bars. On /globe, `onPick` switches the globe; elsewhere each bar links to /globe for that variable. */
export function Leaderboard({ meta, active, onPick }: { meta: Meta; active?: string; onPick?: (v: string) => void }) {
  const rows = trustRows(meta);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SectionLabel>Which variables can you trust?</SectionLabel>
        <p className="max-w-[60ch] font-display text-[clamp(22px,2.6vw,30px)] leading-tight text-ink">{takeaway(rows)}</p>
        <p className="max-w-[70ch] text-[14px] text-ink-dim">Trust = the share of the simple test&apos;s trends that also pass the strict test, across every map square from 1980 to 2025. False alarms = trends the simple test &ldquo;found&rdquo; in shuffled data with no trend at all.</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r, i) => {
          const body = (
            <>
              <span className="hud w-6 shrink-0 !text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[15px] text-ink">{r.name}</span>
                  <span className="hud !text-[11px]"><span className="!text-ink">{n0(r.real)}</span> real · <span className="text-false-alarm">{n0(r.fake)}</span> false alarms</span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-[var(--ground-sunken)]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-[var(--warming)]" style={{ width: `${Math.round(100 * r.trust)}%` }} />
                </span>
              </span>
              <span className="num w-14 shrink-0 text-right text-[20px] text-ink">{Math.round(100 * r.trust)}%</span>
            </>
          );
          const cls = `glass flex w-full items-center gap-3 px-4 py-3 text-left no-underline transition-colors hover:border-[var(--ink-faint)] ${active === r.v ? "!border-[var(--ink-muted)]" : ""}`;
          const label = `${r.name}: ${Math.round(100 * r.trust)}% of simple-test trends are real (${n0(r.real)} real, ${n0(r.fake)} false alarms, noise ratio ${Math.round(100 * r.noise)}%). Show it on the globe.`;
          return (
            <li key={r.v}>
              {onPick
                ? <button type="button" onClick={() => onPick(r.v)} aria-pressed={active === r.v} aria-label={label} className={cls}>{body}</button>
                : <Link href={`/globe?v=${r.v}`} aria-label={label} className={cls}>{body}</Link>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
