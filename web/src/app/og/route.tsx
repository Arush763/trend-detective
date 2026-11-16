/* eslint-disable @typescript-eslint/no-explicit-any */
// Share-card image for a globe or case link: /og?kind=globe&v=T2M&region=arctic | &city=Lagos, Nigeria | kind=case&place=arctic&v=T2M.
// Reads the same static JSON the site serves; anything it can't resolve falls back to a general card.
import { ImageResponse } from "next/og";
import { DEMOS, NICE, VERDICT, inPlace, signed } from "@/lib/data";

const size = { width: 1200, height: 630 };
const tone = { real: ["#f5f5f2", "#0a0a0b"], fake: ["#c58ad6", "#0a0a0b"], none: ["#272728", "#a3a39f"] } as const;

export async function GET(req: Request) {
  const u = new URL(req.url), q = u.searchParams;
  const data = (p: string) => fetch(new URL(`/data/${p}`, u.origin)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const v = NICE[q.get("v") ?? ""] ? q.get("v")! : "T2M", n = NICE[v];
  let eyebrow = "Trend Detective · NASA MERRA-2 · 1980–2025", title = "Is Earth really changing, or is it just luck?", line = "", verdict: [string, keyof typeof tone] | null = null;

  const regionId = (() => { const r = q.get("place") ?? q.get("region"); const d = DEMOS.find((x) => `demo:${x.id}` === r); return d ? d.place : r; })();
  const cityParam = q.get("city");
  if (regionId && !regionId.includes(":")) {
    const r = await data(`regions/${regionId}.json`), d = r?.variables?.[v];
    if (d) {
      title = `${n.short} ${inPlace(r)}`;
      line = `${signed(d.slope_decade)} ${n.units} per decade, 1980–2025`;
      verdict = [VERDICT[d.verdict].label, d.verdict === "significant" ? "real" : "none"];
    }
  } else if (cityParam) {
    const [cities, meta, grid] = await Promise.all([data("cities.json"), data("meta.json"), data(`grid/${v}.json`)]);
    const c = cities?.find((x: any[]) => `${x[0]}, ${x[1]}` === cityParam) ?? cities?.find((x: any[]) => x[0] === cityParam.split(",")[0]);
    if (c && meta && grid) {
      const near = (arr: number[], val: number, wrap = 0) => arr.reduce((b, x, i) => { let dd = Math.abs(x - val); if (wrap) dd = Math.min(dd, wrap - dd); return dd < b.d ? { i, d: dd } : b; }, { i: 0, d: Infinity }).i;
      const k = near(meta.grid.lat, c[2]) * grid.shape[1] + near(meta.grid.lon, c[3], 360), s = grid.slope_decade[k];
      title = `${n.short} in ${c[0]}, ${c[1]}`;
      if (s != null) {
        line = `${signed(s)} ${n.units} per decade, 1980–2025 · the NASA square around the city`;
        verdict = grid.q[k] < 0.05 ? ["Real signal", "real"] : grid.p_naive[k] < 0.05 ? ["Fake (failed luck test)", "fake"] : ["No trend", "none"];
      }
    }
  } else if (q.get("kind") === "globe") {
    const meta = await data("meta.json"), s = meta?.grid_summary?.[v];
    if (s) {
      title = `${n.short}: signal or noise?`;
      line = `${s.naive_sig.toLocaleString("en-US")} places look like trends · ${s.noise_sig.toLocaleString("en-US")} were luck · ${s.real_sig.toLocaleString("en-US")} pass the strict test`;
      eyebrow = `The globe · ${s.cells.toLocaleString("en-US")} places · NASA MERRA-2 · 1980–2025`;
    }
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0a0b", color: "#ecebe8", fontFamily: "sans-serif", padding: 48 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#151516", border: "1px solid #272728", borderRadius: 24, padding: "56px 64px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, textTransform: "uppercase", fontFamily: "monospace", color: "#a3a39f" }}>{eyebrow}</div>
            <div style={{ display: "flex", fontSize: 68, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
            {line && <div style={{ display: "flex", fontSize: 32, color: "#a3a39f" }}>{line}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {verdict
              ? <div style={{ display: "flex", fontSize: 30, letterSpacing: 2, textTransform: "uppercase", padding: "14px 28px", borderRadius: 999, background: tone[verdict[1]][0], color: tone[verdict[1]][1] }}>{verdict[0]}</div>
              : <div style={{ display: "flex" }} />}
            <div style={{ display: "flex", fontSize: 24, fontFamily: "monospace", color: "#4b4b49" }}>trend-detective.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
