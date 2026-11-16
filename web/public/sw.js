/* Trend Detective service worker: makes the site installable and usable offline.
 *
 * - Pages (and Next's page data):    network first, so a deploy shows up at once; offline -> saved copy or /offline.
 * - /_next/static/*, icons, fonts:   cache first. Their names change with every build, so a saved copy is never stale.
 * - NASA data (/data/*, coastline):  saved copy at once, refreshed in the background (it only changes when we rebuild).
 *
 * On install it saves every page, the build files those pages need, and the data for every case, so the site
 * works offline after a single visit. Bump VERSION to drop every old cache.
 */
const VERSION = "v3"; // v3: adds /lab to the offline pages
const PAGES = `td-pages-${VERSION}`, STATIC = `td-static-${VERSION}`, DATA = `td-data-${VERSION}`;
const ROUTES = ["/", "/explore", "/compare", "/globe", "/lab", "/how", "/offline"];
const REGIONS = ["global", "arctic", "greenland", "siberia", "sahara", "sahel", "middle-east", "amazon", "congo", "us-southwest", "us-midwest",
  "new-jersey", "chesapeake", "mediterranean", "alps", "himalaya", "delhi", "beijing", "los-angeles", "murray-darling", "nino34"];
const DATA_FILES = ["/data/meta.json", "/data/grid/T2M.json", "/data/validation/beijing_aeronet.json", "/coastline.txt",
  ...REGIONS.map((r) => `/data/regions/${r}.json`)];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES), statics = await caches.open(STATIC), data = await caches.open(DATA);
    // Best effort: one failed file must not stop the app from installing.
    const save = (cache, url) => fetch(url, { cache: "reload" }).then((r) => (r.ok ? cache.put(url, r) : null)).catch(() => null);
    const assets = new Set();
    await Promise.all(ROUTES.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(url, res);
        for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
      } catch { /* offline during install: the page is cached on first real visit instead */ }
    }));
    await Promise.all([...assets].map((u) => save(statics, u)));
    await Promise.all(["/icons/icon-192.png", "/icons/icon-512.png"].map((u) => save(statics, u)));
    await Promise.all(DATA_FILES.map((u) => save(data, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, STATIC, DATA]);
    for (const k of await caches.keys()) if (k.startsWith("td-") && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// The page lists files it loaded before this worker took control (e.g. the 3D globe, loaded on demand):
// save them too, so the first visit is enough for offline use.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    for (const u of event.data.urls.slice(0, 300)) {
      let url;
      try { url = new URL(u, self.location.origin); } catch { continue; }
      if (url.origin !== self.location.origin) continue;
      const name = url.pathname.startsWith("/data/") || url.pathname === "/coastline.txt" ? DATA
        : url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") ? STATIC : null;
      if (!name) continue;
      const cache = await caches.open(name);
      if (await cache.match(url.href, { ignoreSearch: name === DATA })) continue;
      try { const res = await fetch(url.href); if (res.ok) await cache.put(url.href, res); } catch { /* offline: skip */ }
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // let the browser handle other sites
  if (url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC));
  } else if (url.pathname.startsWith("/data/") || url.pathname === "/coastline.txt") {
    event.respondWith(staleWhileRevalidate(req, DATA, event));
  } else {
    event.respondWith(networkFirst(req, event));
  }
});

async function cacheFirst(req, name) {
  const hit = await caches.match(req, { cacheName: name });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(name)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name, event) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: true });
  const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (hit) { event.waitUntil(update.catch(() => {})); return hit; }
  return update;
}

// Pages and Next's page data (?_rsc= fetches): fresh from the network when online, saved copy when not.
async function networkFirst(req, event) {
  const cache = await caches.open(PAGES);
  const isPage = req.mode === "navigate";
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") event.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch {
    const hit = (await cache.match(req)) || (isPage && (await cache.match(new URL(req.url).pathname)));
    if (hit) return hit;
    if (isPage) return (await cache.match("/offline")) || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
    return Response.error(); // a failed page-data fetch makes Next fall back to a full page load, which we can serve
  }
}
