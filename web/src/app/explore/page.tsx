import type { Metadata } from "next";
import { DynamicMarker } from "@/components/DynamicMarker";
import Explore from "./ExploreClient";

// Server wrapper so a shared case link gets its own share image (from ?place=&v=); the page itself is the client
// component, unchanged. Places found by search (osm:/pt:) and links without a case use the site's default image.
export async function generateMetadata({ searchParams }: PageProps<"/explore">): Promise<Metadata> {
  const q = await searchParams, place = q.place, v = q.v;
  if (typeof place !== "string" || !place || place.includes(":") || typeof v !== "string" || !v) return {};
  const p = new URLSearchParams({ kind: "case", place: place.slice(0, 60), v: v.slice(0, 20) });
  const image = { url: `/og?${p}`, width: 1200, height: 630, alt: "Trend Detective case: trend, slope and verdict" };
  return {
    openGraph: { type: "website", siteName: "Trend Detective", title: "Trend Detective: Signal or Noise?", url: "/explore", images: [image] },
    twitter: { card: "summary_large_image", images: [image.url] },
  };
}

export default function Page() {
  return (
    <>
      <Explore />
      <DynamicMarker />
    </>
  );
}
