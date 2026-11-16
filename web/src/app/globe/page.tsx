import type { Metadata } from "next";
import { DynamicMarker } from "@/components/DynamicMarker";
import GlobePage from "./GlobeClient";

// Server wrapper so a shared /globe link gets its own share image (from ?v=&region=&city=); the page itself is the
// client component, unchanged. With no parameters the site's default image is used.
export async function generateMetadata({ searchParams }: PageProps<"/globe">): Promise<Metadata> {
  const q = await searchParams, p = new URLSearchParams({ kind: "globe" });
  for (const k of ["v", "region", "city"]) { const x = q[k]; if (typeof x === "string" && x) p.set(k, x.slice(0, 80)); }
  if (p.size === 1) return {};
  const image = { url: `/og?${p}`, width: 1200, height: 630, alt: "Trend Detective globe: trend, slope and verdict" };
  return {
    openGraph: { type: "website", siteName: "Trend Detective", title: "Signal or noise? See it on the globe", url: "/globe", images: [image] },
    twitter: { card: "summary_large_image", images: [image.url] },
  };
}

export default function Page() {
  return (
    <>
      <GlobePage />
      <DynamicMarker />
    </>
  );
}
