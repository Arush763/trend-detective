import type { MetadataRoute } from "next";

// Makes the site installable as an app (Add to Home Screen / Install). Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Trend Detective: Signal or Noise?",
    short_name: "Trend Detective",
    description: "Is Earth really changing, or is it just luck? 46 years of NASA MERRA-2 data, tested for real trends. Works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#070b1a",
    theme_color: "#070b1a",
    lang: "en",
    dir: "ltr",
    categories: ["education", "science", "weather"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore a place", short_name: "Explore", url: "/explore", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Globe of every trend", short_name: "Globe", url: "/globe", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Case 04: same cause, opposite effects", short_name: "Case 04", url: "/compare", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "How it works", short_name: "How", url: "/how", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
