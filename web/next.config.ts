import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The data files only change when the pipeline is rebuilt: cache for an hour, then revalidate in the background.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }];
    return [{ source: "/data/:path*", headers: cache }, { source: "/coastline.txt", headers: cache }];
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
