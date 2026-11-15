import type { MetadataRoute } from "next";

const BASE = "https://trend-detective.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/explore", "/globe", "/how"].map((p) => ({ url: BASE + p }));
}
