import { Hono } from "hono";
import type { Env } from "../index";

const publicRoutes = new Hono<{ Bindings: Env }>();

// Read by the Astro build (seo-rebuild.yml) to regenerate static batch
// pages — never called from the live client at request time, so it
// costs nothing against the per-student request budget.
publicRoutes.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      "SELECT id, title_bn, title_en, track, kind, price_paise, summary_bn, summary_en, preview_video_id FROM batches WHERE status = 'published'",
    )
    .all();
  return c.json(rows.results);
});

const authedRoutes = new Hono<{ Bindings: Env; Variables: { uid: string } }>();

authedRoutes.get("/:id/content", async (c) => {
  const batchId = c.req.param("id");
  const enrolled = await c.env.DB
    .prepare("SELECT 1 FROM enrollments WHERE uid = ? AND batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())")
    .bind(c.get("uid"), batchId)
    .first();

  const batch = await c.env.DB.prepare("SELECT kind FROM batches WHERE id = ?").bind(batchId).first<{ kind: string }>();
  if (!batch) return c.json({ error: "not_found" }, 404);
  if (batch.kind === "paid" && !enrolled) return c.json({ error: "not_enrolled" }, 403);

  const lectures = await c.env.DB
    .prepare("SELECT id, chapter, title_bn, title_en, youtube_id, duration_sec, is_live, live_at FROM lectures WHERE batch_id = ? ORDER BY order_index")
    .bind(batchId)
    .all();
  return c.json(lectures.results);
});

export default { public: publicRoutes, authed: authedRoutes };
