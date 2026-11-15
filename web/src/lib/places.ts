/* eslint-disable @typescript-eslint/no-explicit-any */
// Any place on Earth: find it (OpenStreetMap Nominatim), take its outline, average the NASA squares inside it,
// then run the same tests as the built-in regions (lib/stats.ts, a port of pipeline/stats.py).
import { get, type Meta, type Region } from "./data";
import { fdrBh, mannKendall, permutationP, removeEnso, validSeries, walkForward, yearsToDetect, WF_LABELS } from "./stats";

const NOMINATIM = "https://nominatim.openstreetmap.org";
/** Only these variables are reported as a % change; temperature and soil wetness are already in readable units. */
const NO_PCT = new Set(["T2M", "GWETROOT"]);

export type PlaceHit = { id: string; name: string; kind: string; detail: string };
type Ring = [number, number][]; // [lon, lat]
type Index = { years: number[]; vars: string[]; lat0: number; lon0: number; dlat: number; dlon: number; nlat: number; nlon: number; tile: [number, number]; nodata: number; family_p: number[] };

export const isCustomPlace = (id: string) => id.startsWith("osm:") || id.startsWith("pt:");
const latLon = (lat: number, lon: number) => `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon)}°${lon >= 0 ? "E" : "W"}`;

/** Search on submit only (Nominatim's usage policy forbids search-as-you-type). Coordinates like "64.1, -21.9" work too. */
export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const pt = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (pt) {
    const lat = +pt[1], lon = +pt[2];
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [{ id: `pt:${lat},${lon}`, name: latLon(lat, lon), kind: "point", detail: "The NASA square around this point" }];
  }
  const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`place search failed (${r.status})`);
  const hits: any[] = await r.json();
  // Historic boundaries (old borders) share names with today's places and would only confuse.
  return hits.filter((h) => h.osm_type && h.osm_id && h.category !== "historic" && !String(h.addresstype ?? "").startsWith("historic")).map((h) => ({
    id: `osm:${h.osm_type[0].toUpperCase()}${h.osm_id}`,
    name: h.name || h.display_name.split(",")[0],
    kind: (h.addresstype || h.type || "place").replaceAll("_", " "),
    detail: h.display_name,
  }));
}

async function outline(id: string) {
  if (id.startsWith("pt:")) {
    const [lat, lon] = id.slice(3).split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("bad coordinates");
    return { name: `the area around ${latLon(lat, lon)}`, detail: "", lat, lon, rings: [] as Ring[], box: [lat - 0.5, lat + 0.5, lon - 0.6, lon + 0.6] };
  }
  const r = await fetch(`${NOMINATIM}/lookup?format=jsonv2&polygon_geojson=1&polygon_threshold=0.005&osm_ids=${encodeURIComponent(id.slice(4))}`);
  if (!r.ok) throw new Error(`place lookup failed (${r.status})`);
  const [h] = await r.json();
  if (!h) throw new Error("place not found");
  const g = h.geojson ?? {};
  const polys: number[][][][] = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const [s, n, w, e] = (h.boundingbox as string[]).map(Number);
  return { name: h.name || h.display_name.split(",")[0], detail: h.display_name as string, lat: +h.lat, lon: +h.lon,
    rings: polys.flatMap((p) => p.map((ring) => ring as Ring)), box: [s, n, w, e] };
}

/** Even-odd ray casting over every ring, so holes (lakes, enclaves) are left out. */
function inside(rings: Ring[], lon: number, lat: number) {
  let c = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

const tiles = new Map<string, Promise<DataView>>();
const tile = (r: number, c: number) => {
  const k = `${r}_${c}`;
  if (!tiles.has(k)) tiles.set(k, fetch(`/data/places/t_${k}.bin`).then((x) => { if (!x.ok) throw new Error(`tile ${k}: ${x.status}`); return x.arrayBuffer(); }).then((b) => new DataView(b)).catch((e) => { tiles.delete(k); throw e; }));
  return tiles.get(k)!;
};

const rnd = (x: number, sig = 4) => (Number.isFinite(x) ? +x.toPrecision(sig) : null);

/** Build a Region (same shape as data/processed/regions/<id>.json) for any place. */
export async function loadPlace(id: string, meta: Meta): Promise<Region> {
  const ix: Index = await get("places/index.json");
  const o = await outline(id);
  const NY = ix.years.length, [TR, TC] = ix.tile;
  const rowOf = (lat: number) => Math.round((lat - ix.lat0) / ix.dlat), colOf = (lon: number) => ((Math.round((lon - ix.lon0) / ix.dlon) % ix.nlon) + ix.nlon) % ix.nlon;

  // Squares whose centre is inside the outline; a place smaller than one square gets the square it sits in.
  const cells: [number, number][] = [];
  if (o.rings.length) {
    const seen = new Set<number>();
    for (const ring of o.rings) {
      const lats = ring.map((p) => p[1]), lons = ring.map((p) => p[0]);
      for (let r = Math.max(0, rowOf(Math.min(...lats))); r <= Math.min(ix.nlat - 1, rowOf(Math.max(...lats))); r++) {
        for (let c = Math.floor((Math.min(...lons) - ix.lon0) / ix.dlon); c <= Math.ceil((Math.max(...lons) - ix.lon0) / ix.dlon); c++) {
          const cc = ((c % ix.nlon) + ix.nlon) % ix.nlon, key = r * ix.nlon + cc;
          if (seen.has(key)) continue;
          if (inside(o.rings, ix.lon0 + c * ix.dlon, ix.lat0 + r * ix.dlat)) { seen.add(key); cells.push([r, cc]); }
        }
      }
    }
  }
  if (!cells.length) cells.push([Math.min(ix.nlat - 1, Math.max(0, rowOf(o.lat))), colOf(o.lon)]);

  // Area-weighted average of every square, per variable and year (squares with no data for a variable are skipped).
  const sums = ix.vars.map(() => new Float64Array(NY)), wts = ix.vars.map(() => new Float64Array(NY)), have = ix.vars.map(() => 0);
  const views = new Map<string, DataView>();
  await Promise.all([...new Set(cells.map(([r, c]) => `${Math.floor(r / TR)}_${Math.floor(c / TC)}`))].map(async (k) => {
    const [a, b] = k.split("_").map(Number);
    views.set(k, await tile(a, b));
  }));
  for (const [r, c] of cells) {
    const tr = Math.floor(r / TR), tc = Math.floor(c / TC), dv = views.get(`${tr}_${tc}`)!;
    const rows = Math.min(TR, ix.nlat - tr * TR), cols = Math.min(TC, ix.nlon - tc * TC), head = ix.vars.length * 8;
    const w = Math.cos(((ix.lat0 + r * ix.dlat) * Math.PI) / 180);
    ix.vars.forEach((_, vi) => {
      const mid = dv.getFloat32(vi * 8, true), step = dv.getFloat32(vi * 8 + 4, true);
      const base = head + 2 * (vi * rows * cols * NY + ((r - tr * TR) * cols + (c - tc * TC)) * NY);
      if (dv.getInt16(base, true) === ix.nodata) return;
      have[vi]++;
      for (let y = 0; y < NY; y++) {
        const q = dv.getInt16(base + 2 * y, true);
        if (q !== ix.nodata) { sums[vi][y] += w * (mid + step * q); wts[vi][y] += w; }
      }
    });
  }

  const split = ix.years.indexOf(meta.split_year), enso: number[] = meta.enso_annual;
  const raw: Record<string, any> = {};
  ix.vars.forEach((v, vi) => {
    if (have[vi] < Math.max(1, 0.2 * cells.length)) return; // e.g. soil moisture over a place that is mostly sea
    const y = Array.from(sums[vi], (s, t) => s / wts[vi][t]).map((x) => +x.toPrecision(5));
    if (!validSeries(y)) return;
    const hr = mannKendall(y), naive = mannKendall(y, false), e = removeEnso(y, enso), hre = mannKendall(e.adjusted);
    const wf = walkForward(y, split), yd = yearsToDetect(y, hr.slope), total = hr.slope * (NY - 1);
    raw[v] = {
      annual: y, mean: rnd(y.reduce((s, x) => s + x, 0) / NY),
      slope_decade: rnd(hr.slope * 10), ci_decade: [rnd(hr.ci_low * 10), rnd(hr.ci_high * 10)], intercept: rnd(hr.intercept, 6),
      total_change: rnd(total), pct_change: hr.intercept > 0 && !NO_PCT.has(v) ? rnd((100 * total) / hr.intercept) : null,
      p_naive: rnd(naive.p, 3), p_hr: rnd(hr.p, 3), p_perm: rnd(permutationP(y), 3),
      noise_level: rnd(yd.sigma), autocorr: rnd(yd.phi, 3), snr: yd.sigma > 0 ? rnd(Math.abs(total) / yd.sigma) : null,
      years_needed: Number.isFinite(yd.nstar) ? rnd(yd.nstar, 3) : null,
      years_more: Number.isFinite(yd.nstar) ? Math.max(0, Math.ceil(yd.nstar) - NY) : null,
      enso_coef: rnd(e.coef), enso_p: rnd(e.p, 3), slope_enso_decade: rnd(hre.slope * 10), p_enso_hr: rnd(hre.p, 3),
      walk_forward: {
        code: wf.code, label: WF_LABELS[wf.code],
        first: { years: [ix.years[0], ix.years[split - 1]], slope_decade: rnd(wf.a.slope * 10), p: rnd(wf.a.p, 3) },
        second: { years: [ix.years[split], ix.years[NY - 1]], slope_decade: rnd(wf.b.slope * 10), p: rnd(wf.b.p, 3) },
      },
    };
  });

  // False-discovery rate: this place's tests join every region x variable test the app already shows.
  const ks = Object.keys(raw), fam = ix.family_p, q = fdrBh([...fam, ...ks.map((k) => raw[k].p_hr)]).slice(fam.length);
  ks.forEach((k, i) => {
    const d = raw[k];
    d.q = rnd(q[i], 3);
    d.tests = fam.length + ks.length;
    d.verdict = d.q < 0.05 ? "significant" : d.p_hr < 0.2 ? "possible" : "none";
  });

  return {
    id, name: o.name, type: "custom", custom: true,
    blurb: `${o.detail ? `${o.detail}. ` : ""}${cells.length === 1 ? "Smaller than one NASA square (about 110 km across), so this is the square it sits in." : `The average of the ${cells.length.toLocaleString("en-US")} NASA squares (about 110 km across) inside its outline.`}`,
    box: o.box, center: { lat: o.lat, lng: o.lon }, outline: o.rings, cells: cells.length,
    screener: ks.sort((a, b) => (raw[b].snr ?? 0) - (raw[a].snr ?? 0)), variables: raw,
  };
}
