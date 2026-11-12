import { Hono } from "hono";
import type { AppEnv, Env } from "../index";

const publicRoutes = new Hono<{ Bindings: Env }>();

publicRoutes.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, preview_video_id FROM batches WHERE status = 'published' ORDER BY created_at DESC",
    )
    .all();
  return c.json(rows.results);
});

const authedRoutes = new Hono<AppEnv>();

authedRoutes.get("/:id/content", async (c) => {
  const batchId = c.req.param("id");
  const uid = c.get("uid");

  const batch = await c.env.DB
    .prepare("SELECT kind FROM batches WHERE id = ? AND status = 'published'")
    .bind(batchId)
    .first<{ kind: string }>();
  if (!batch) return c.json({ error: "not_found" }, 404);

  if (batch.kind === "paid") {
    const enrolled = await c.env.DB
      .prepare(
        "SELECT 1 FROM enrollments WHERE uid = ? AND batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())",
      )
      .bind(uid, batchId)
      .first();
    if (!enrolled) return c.json({ error: "not_enrolled" }, 403);
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/batch-content/${batchId}`);
  const hit = await cache.match(cacheKey);
  if (hit) return c.json(await hit.json());

  const lectures = await c.env.DB
    .prepare(
      "SELECT id, chapter, title_bn, title_en, youtube_id, duration_sec, is_live, live_at FROM lectures WHERE batch_id = ? ORDER BY order_index",
    )
    .bind(batchId)
    .all();

  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(lectures.results), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
      }),
    ),
  );
  return c.json(lectures.results);
});

export default { public: publicRoutes, authed: authedRoutes };
