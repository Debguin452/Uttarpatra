import type { MiddlewareHandler } from "hono";

/**
 * Caches GET responses at Cloudflare's edge using the Cache API, so the
 * client's background SWR revalidation (useCachedQuery) usually hits a
 * cache at the data-center the student is nearest to instead of D1.
 * This matters because D1's free tier is a 5M-reads/day *account-wide*
 * budget shared across every student — edge caching is what keeps 2,000
 * students browsing the same published catalog from ever touching it
 * more than once per TTL window.
 *
 * Only safe for data that's fine being briefly stale across students:
 * catalog, lecture lists, notices. Never put payment or attempt routes
 * behind this.
 */
export function edgeCache(ttlSec: number): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== "GET") return next();

    const cache = caches.default;
    const cacheKey = new Request(c.req.url, c.req.raw);
    const hit = await cache.match(cacheKey);
    if (hit) {
      // Tell the client how old this edge copy is, so the UI can show
      // "synced N ago" honestly instead of always claiming "just now".
      const age = hit.headers.get("age") ?? "0";
      const res = new Response(hit.body, hit);
      res.headers.set("x-edge-age", age);
      return res;
    }

    await next();
    if (c.res.status === 200) {
      const toCache = c.res.clone();
      toCache.headers.set("Cache-Control", `public, max-age=${ttlSec}, stale-while-revalidate=${ttlSec * 3}`);
      c.executionCtx.waitUntil(cache.put(cacheKey, toCache));
    }
  };
}
