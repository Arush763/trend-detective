/* eslint-disable @typescript-eslint/no-explicit-any */
// Data access + the site's one vocabulary. Every user-facing label for a statistic lives here.
export type Meta = any;
export type Region = any;
export type Grid = any;
export type VarStats = any;

const cache = new Map<string, Promise<any>>();
export const get = (path: string): Promise<any> => {
  if (!cache.has(path)) {
    cache.set(path, fetch(`/data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(path)!;
};

export const fmt = (x: number | null | undefined, d = 2) =>
  x == null || !Number.isFinite(x) ? "n/a"
    : x !== 0 && Math.abs(x) < 0.001 ? x.toExponential(d - 1).replace("e", "×10^") // tiny numbers would round to "0"
      : Number(x.toPrecision(d)).toLocaleString();
/** p- and q-values: below 0.001 the exact size doesn't matter to a reader. */
export const pfmt = (p: number | null | undefined) => (p != null && p < 0.001 ? "< 0.001" : fmt(p));
export const signed = (x: number, d = 2) => (x > 0 ? "+" : x < 0 ? "−" : "") + fmt(Math.abs(x), d);

// Short, everyday names (the pipeline's names are fine for tables, these read better in sentences).
export const NICE: Record<string, { short: string; units: string; noun: string }> = {
  T2M: { short: "Air temperature", units: "°C", noun: "air temperature" },
  TQV: { short: "Water vapor", units: "mm", noun: "water vapor in the air" },
  PRECTOTCORR: { short: "Rain and snow", units: "mm/day", noun: "rain and snowfall" },
  EVAP: { short: "Evaporation", units: "mm/day", noun: "evaporation" },
  GWETROOT: { short: "Soil moisture", units: "% wet", noun: "soil moisture" },
  SNOMAS: { short: "Snow on the ground", units: "kg/m²", noun: "snow on the ground" },
  RUNOFF: { short: "River runoff", units: "mm/day", noun: "river runoff" },
  TOTEXTTAU: { short: "Haze", units: "haze index", noun: "haze" },
  DUEXTTAU: { short: "Dust", units: "dust index", noun: "dust in the air" },
};

export const TYPE_LABEL: Record<string, string> = {
  global: "Whole Earth", polar: "Polar", boreal: "Cold forest", desert: "Desert", "semi-arid": "Dry grassland",
  rainforest: "Rainforest", farmland: "Farmland", city: "Big city", estuary: "Coast & bay", mountain: "Mountains", ocean: "Ocean",
};

export const VERDICT: Record<string, { label: string; tone: "real" | "maybe" | "none"; blurb: string }> = {
  significant: { label: "Real signal", tone: "real", blurb: "Very unlikely to be luck." },
  possible: { label: "Not proven yet", tone: "maybe", blurb: "Could still be luck." },
  none: { label: "No clear trend", tone: "none", blurb: "Most likely just noise." },
};

// Walk-forward codes from stats.walk_forward, in plain words.
export const WF: Record<number, { label: string; pass: boolean | null }> = {
  0: { label: "No clear trend in either half", pass: null },
  1: { label: "Only appeared after 2002", pass: false },
  2: { label: "Found before 2003 and kept going after", pass: true },
  3: { label: "Same direction after 2002, but weaker", pass: true },
  4: { label: "Turned around after 2002", pass: false },
  5: { label: "Faded out after 2002", pass: false },
};

const oneIn = (p: number) => {
  if (p <= 0.001) return "less than 1 time in 1,000";
  if (p < 0.01) return `about ${Math.round(p * 1000)} times in 1,000`;
  return `about ${Math.round(p * 100)} times in 100`;
};

/** "the Arctic", "Greenland", "the whole Earth": region names as they read inside a sentence. */
export const placeName = (r: { id: string; name: string }) =>
  r.id === "global" ? "the whole Earth" : ["greenland", "new-jersey"].includes(r.id) ? r.name : `the ${r.name}`;
export const inPlace = (r: { id: string; name: string }) => `${r.id === "global" ? "across" : "in"} ${placeName(r)}`;
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The headline: what happened, then what the verdict means, in two plain sentences. */
export function headline(v: string, place: string /* from inPlace() */, d: VarStats, years: number[]) {
  const n = NICE[v];
  const dir = d.total_change > 0 ? "rose" : "fell";
  const amount = v === "T2M" ? `${fmt(Math.abs(d.total_change), 2)} °C`
    : d.pct_change != null ? `${fmt(Math.abs(d.pct_change), 2)}%` : `${fmt(Math.abs(d.total_change), 2)} ${n.units}`;
  const title = `${n.short} ${place} ${dir} by about ${amount} since ${years[0]}.`;
  const sub = d.verdict === "significant"
    ? "The strict test says this is very unlikely to be luck."
    : d.verdict === "possible"
      ? (d.years_more > 0
        ? `That could still be luck. About ${d.years_more} more years of data would likely settle it.`
        : "That could still be luck. The data moves in long swings, so more years alone may not settle it.")
      : "That change is small next to the normal ups and downs, so it is most likely noise.";
  return { title, sub };
}

/** The four checks shown on every case file. The verdict comes from check 3 (the strictest). */
export function checks(v: string, d: VarStats) {
  const u = NICE[v].units;
  const snr = d.snr ?? 0;
  const wf = WF[d.walk_forward.code];
  const wfLabel = d.walk_forward.code === 1  // "emerging": say which way the new trend goes
    ? `A new trend after 2002, going ${d.walk_forward.second.slope_decade > 0 ? "up" : "down"}` : wf.label;
  return [
    {
      q: "Is the change bigger than the normal wobble?",
      pass: snr >= 2,
      text: `A normal year sits about ${fmt(d.noise_level, 2)} ${u} above or below the trend. The total change, ${fmt(Math.abs(d.total_change), 2)} ${u}, is ${fmt(snr, 2)} times that wobble.`,
      note: "Trend strength = total change ÷ normal wobble. Above 2 is easy to see.",
    },
    {
      q: "Could shuffled years do this?",
      pass: d.p_perm < 0.05,
      text: `We shuffled the ${d.annual.length} years into random order 2,000 times. Random order made a trend this strong ${oneIn(d.p_perm)}.`,
      note: "Shuffling keeps the same years but destroys any real trend. Under 5 in 100 passes.",
    },
    {
      q: "Does it survive checking many places at once?",
      pass: d.q < 0.05,
      text: d.q < 0.0001
        ? "After accounting for all 184 tests in this app, and for years that resemble the year before, the false-alarm chance is far below 1 in 10,000."
        : `After accounting for all 184 tests in this app, and for years that resemble the year before, the false-alarm chance is about ${fmt(d.q * 100, 2)}%.`,
      note: "The more places you test, the more false alarms you get. This is the check the verdict uses. Under 5% passes.",
    },
    {
      q: "Does it hold up over time?",
      pass: wf.pass,
      text: `1980–2002: ${signed(d.walk_forward.first.slope_decade)} ${u} per decade. 2003–2025: ${signed(d.walk_forward.second.slope_decade)} ${u} per decade. ${wfLabel}.`,
      note: "We look for the trend in the first half, then check it in the half the first test never saw.",
    },
  ];
}

export type Demo = { id: string; title: string; place: string; v: string; tag: string; tone: "real" | "maybe" | "none"; text: string };
// shortcut: hand-picked from the 2026-11-14 build; re-check these numbers if build.py output changes.
export const DEMOS: Demo[] = [
  {
    id: "arctic", title: "Is the Arctic really warming?", place: "arctic", v: "T2M", tag: "Real signal", tone: "real",
    text: "About 2 °C warmer than in 1980, rising nearly 3 times as fast as the planet overall. It passes every check.",
  },
  {
    id: "beijing", title: "Is Beijing's air getting hazier?", place: "beijing", v: "TOTEXTTAU", tag: "Fooled the simple test", tone: "maybe",
    text: "A simple test says haze went up. The real story: it rose until the early 2010s, then fell. A straight line hides that.",
  },
  {
    id: "murray", title: "Are Australia's farm rivers drying up?", place: "murray-darling", v: "RUNOFF", tag: "Not proven yet", tone: "none",
    text: "River runoff in the Murray-Darling Basin is down 28% since 1980, but it's not proven yet. About 5 more years of data would likely settle it.",
  },
];
