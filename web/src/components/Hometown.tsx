"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// "Check your hometown": ~1,250 world cities (Natural Earth, bundled; loaded the first time the box is focused),
// autocomplete as you type, then every variable's verdict for the map square the city sits in.
import { useId, useRef, useState } from "react";
import { NICE, get, signed, type Grid } from "@/lib/data";

export type City = { name: string; country: string; lat: number; lon: number };
let cities: Promise<City[]> | null = null;
/** The bundled list, largest cities first. Fetched once, on first use. */
export const loadCities = () => (cities ??= get("cities.json").then((rows: [string, string, number, number][]) => rows.map(([name, country, lat, lon]) => ({ name, country, lat, lon }))));
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const cityKey = (c: City) => `${c.name}, ${c.country}`;
export const findCity = (list: City[], key: string) => list.find((c) => cityKey(c) === key) ?? list.find((c) => fold(c.name) === fold(key.split(",")[0]));

export function HometownSearch({ onPick }: { onPick: (c: City) => void }) {
  const [list, setList] = useState<City[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const id = useId(), box = useRef<HTMLInputElement>(null);
  const f = fold(q.trim());
  const hits = list && f ? list.filter((c) => fold(c.name).startsWith(f)).concat(list.filter((c) => !fold(c.name).startsWith(f) && fold(c.name).includes(f))).slice(0, 8) : [];
  const pick = (c: City) => { setQ(c.name); setOpen(false); onPick(c); box.current?.blur(); };
  return (
    <div className="relative min-w-0 flex-[1_1_220px] sm:max-w-[280px]">
      <input ref={box} type="search" role="combobox" aria-expanded={open && hits.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && hits[hi] ? `${id}-${hi}` : undefined} aria-label="Check your hometown" placeholder="Check your hometown…" value={q} autoComplete="off"
        onFocus={() => { if (!list) loadCities().then(setList).catch(() => {}); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && hits[hi]) { e.preventDefault(); pick(hits[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="nav-glass h-11 w-full rounded-full px-4 text-[14px] text-ink placeholder:text-ink-dim" />
      {open && hits.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="glass absolute left-0 right-0 top-12 z-40 m-0 flex list-none flex-col p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          {hits.map((c, i) => (
            <li key={cityKey(c)} id={`${id}-${i}`} role="option" aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); pick(c); }} onMouseEnter={() => setHi(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-[15px] ${i === hi ? "bg-[var(--accent-wash)] text-ink" : "text-ink"}`}>
              <span>{c.name}</span><span className="hud truncate !text-[11px]">{c.country}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ROW = { real: "Real signal", fake: "Fake (failed luck test)", none: "No trend", nodata: "No data here" } as const;
/** The city's square, for every variable: slope with units, then Real signal / Fake (failed luck test) / No trend. */
export function CityCard({ city, k, grids, onClose }: { city: City; k: number; grids: Record<string, Grid>; onClose: () => void }) {
  return (
    <div role="region" aria-label={`Trends at ${city.name}`} className="glass flex flex-col gap-3 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hud">Your hometown · the NASA square it sits in</p>
          <p className="font-display text-[22px] leading-tight text-ink">{city.name}<span className="text-ink-dim">, {city.country}</span></p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="hud flex h-11 w-11 shrink-0 items-center justify-center rounded-full !text-ink">✕</button>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {Object.keys(NICE).map((v) => {
          const g = grids[v], s = g?.slope_decade[k];
          const kind = !g ? null : s == null ? "nodata" : g.q[k] < 0.05 ? "real" : g.p_naive[k] < 0.05 ? "fake" : "none";
          return (
            <li key={v} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-t border-hairline py-1.5 text-[14px]">
              <span className="text-ink">{NICE[v].short}<span className="num ml-2 text-[12px] text-ink-dim">{s != null ? `${signed(s)} ${NICE[v].units}/decade` : ""}</span></span>
              <span className={`hud !text-[11px] ${kind === "real" ? "!text-ink" : kind === "fake" ? "!text-false-alarm" : ""}`}>{kind ? ROW[kind] : "…"}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-dim">Squares are about 250 km across. Fake: passed the simple test, but not the strict one, so it could be luck.</p>
    </div>
  );
}

/** Every variable's grid, for the city card (they're cached by `get`). */
export const loadAllGrids = (vars: string[]) => Promise.all(vars.map((v) => get(`grid/${v}.json`).then((g: any) => [v, g] as const))).then(Object.fromEntries);
