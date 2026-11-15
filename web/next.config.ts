import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The data files only change when the pipeline is rebuilt: cache for an hour, then revalidate in the background.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }];
    return [
      { source: "/data/:path*", headers: cache },
      { source: "/coastline.txt", headers: cache },
      // The service worker must always be re-checked, or a fixed version could take a day to reach visitors.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
