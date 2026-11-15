import { ImageResponse } from "next/og";

export const alt = "Trend Detective: Is Earth really changing, or is it just luck? 46 years of NASA MERRA-2 data.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Warming-stripe colours, blue → red, for the band along the bottom.
const STRIPES = ["#162046", "#283e8c", "#5271ce", "#7884a8", "#807f7b", "#aaa8a2", "#d2d0ca", "#f0eee9"];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0b", color: "#ecebe8", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px 0", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, textTransform: "uppercase", fontFamily: "monospace", color: "#a3a39f" }}>Trend Detective · NASA Space Apps 2026</div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, fontWeight: 400, letterSpacing: -2 }}>Is Earth really changing, or is it just luck?</div>
          <div style={{ display: "flex", fontSize: 32, color: "rgba(244,246,251,0.78)" }}>46 years of NASA MERRA-2 data, put through four checks that luck rarely passes.</div>
        </div>
        <div style={{ display: "flex", height: 90 }}>
          {STRIPES.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
      </div>
    ),
    size,
  );
}
