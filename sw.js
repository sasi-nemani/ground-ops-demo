/*
 * Makes repeat visits fast without ever mixing old and new files.
 *  - /assets/ files have content hashes in their names, so a cached copy is always the right one:
 *    served from cache, fetched once. This is the bulk of the download (the map code).
 *  - The page, config and data have fixed names, so they could go stale after a deploy and clash with new
 *    code. They come from the network first, with the cache as the fallback when offline.
 * The live feed (WebSocket) and /api/ calls are never cached.
 * Bump CACHE when this file's strategy changes; old caches are deleted on activate.
 */
const CACHE = 'ground-ops-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  event.respondWith(caches.open(CACHE).then(async (cache) => {
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw new Error(`Offline and ${url.pathname} is not cached`);
    }
  }));
});
