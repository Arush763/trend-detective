import type { MetadataRoute } from "next";

const BASE = "https://trend-detective.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/explore", "/compare", "/globe", "/lab", "/how"].map((p) => ({ url: BASE + p }));
}
