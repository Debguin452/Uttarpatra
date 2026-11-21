import { Hono } from "hono";
import { LectureUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const batchId = c.req.query("batchId");
  const rows = await c.env.DB
    .prepare(
      batchId
        ? `SELECT l.id, l.batch_id, b.title_en AS batch_title_en, l.chapter, l.title_bn, l.title_en,
                  l.youtube_id, l.duration_sec, l.order_index, l.is_live, l.live_at, l.subject_id, l.chapter_id, l.status, l.release_at, l.created_at
           FROM lectures l JOIN batches b ON b.id = l.batch_id
           WHERE l.batch_id = ? ORDER BY l.order_index, l.created_at`
        : `SELECT l.id, l.batch_id, b.title_en AS batch_title_en, l.chapter, l.title_bn, l.title_en,
                  l.youtube_id, l.duration_sec, l.order_index, l.is_live, l.live_at, l.subject_id, l.chapter_id, l.status, l.release_at, l.created_at
           FROM lectures l JOIN batches b ON b.id = l.batch_id
           ORDER BY l.live_at IS NULL, l.live_at, l.created_at DESC LIMIT 200`,
    )
    .bind(...(batchId ? [batchId] : []))
    .all();
  return c.json(rows.results);
});

app.post("/", async (c) => {
  const parsed = LectureUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, chapter, titleBn, titleEn, youtubeId, durationSec, orderIndex, isLive, liveAt, subjectId, chapterId, status, releaseAt } = parsed.data;

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO lectures (id, batch_id, chapter, title_bn, title_en, youtube_id, duration_sec, order_index, is_live, live_at, subject_id, chapter_id, status, release_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, batchId, chapter, titleBn, titleEn, youtubeId, durationSec ?? null, orderIndex, isLive ? 1 : 0, liveAt ?? null,
      subjectId ?? null, chapterId ?? null, status, releaseAt ?? null,
    )
    .run();

  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = LectureUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const { batchId, chapter, titleBn, titleEn, youtubeId, durationSec, orderIndex, isLive, liveAt, subjectId, chapterId, status, releaseAt } = parsed.data;

  const result = await c.env.DB
    .prepare(
      `UPDATE lectures SET batch_id = ?, chapter = ?, title_bn = ?, title_en = ?, youtube_id = ?,
              duration_sec = ?, order_index = ?, is_live = ?, live_at = ?,
              subject_id = ?, chapter_id = ?, status = ?, release_at = ?
       WHERE id = ?`,
    )
    .bind(
      batchId, chapter, titleBn, titleEn, youtubeId, durationSec ?? null, orderIndex, isLive ? 1 : 0, liveAt ?? null,
      subjectId ?? null, chapterId ?? null, status, releaseAt ?? null, c.req.param("id"),
    )
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM lectures WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
