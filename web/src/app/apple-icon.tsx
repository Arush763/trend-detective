import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as icon.svg and the nav logo: a ring with a rising trend line.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#07090d" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="22" fill="none" stroke="#5eead4" strokeWidth="4.5" />
          <path d="M12 38 L22 28 L30 34 L40 18 L50 24" fill="none" stroke="#ff8a3d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
