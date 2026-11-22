import { Hono } from "hono";
import { BannerUpsert } from "@coaching-app/shared/schema";
import type { AppEnv } from "../../index";

// One place that turns the form into what is stored. batch_id and link_url
// stay filled for batch and link banners so older readers keep working.
// Community banners open nothing: they carry their own contact buttons.
function target(b: BannerUpsert) {
  if (b.kind === "community") return { type: null, id: null, batchId: null, linkUrl: null };
  const type = b.targetType ?? (b.batchId ? "batch" : b.linkUrl ? "link" : null);
  const id = type && type !== "link" ? (b.targetId ?? b.batchId ?? null) : null;
  return { type, id, batchId: type === "batch" ? id : null, linkUrl: type === "link" ? (b.linkUrl ?? null) : null };
}

const COLUMNS = `id, kind, image_url, title_bn, title_en, description_bn, description_en, batch_id, link_url, target_type, target_id, cta,
                 support_hours_bn, support_hours_en, phone, buttons_json, starts_at, ends_at, order_index, status, created_at`;

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const kind = c.req.query("kind");
  const rows = await c.env.DB
    .prepare(`SELECT ${COLUMNS} FROM banners ${kind === "launch" || kind === "community" ? "WHERE kind = ?1" : "WHERE ?1 IS NULL"} ORDER BY order_index, created_at DESC`)
    .bind(kind === "launch" || kind === "community" ? kind : null)
    .all<{ buttons_json: string | null }>();
  return c.json(rows.results.map((r) => ({ ...r, buttons: JSON.parse(r.buttons_json ?? "[]") })));
});

async function batchMissing(db: D1Database, id: string | null): Promise<boolean> {
  if (!id) return false;
  return !(await db.prepare("SELECT 1 FROM batches WHERE id = ?").bind(id).first());
}

app.post("/", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const b = parsed.data;
  const to = target(b);
  if (await batchMissing(c.env.DB, to.batchId ?? (to.type === "batch" ? to.id : null))) return c.json({ error: "batch_not_found" }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO banners (id, kind, image_url, title_bn, title_en, description_bn, description_en, batch_id, link_url, target_type, target_id, cta,
                            support_hours_bn, support_hours_en, phone, buttons_json, starts_at, ends_at, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, b.kind, b.imageUrl, b.titleBn, b.titleEn, b.descriptionBn ?? null, b.descriptionEn ?? null, to.batchId, to.linkUrl, to.type, to.id, b.cta,
      b.supportHoursBn ?? null, b.supportHoursEn ?? null, b.phone ?? null, JSON.stringify(b.buttons), b.startsAt ?? null, b.endsAt ?? null, b.orderIndex, b.status,
    )
    .run();
  return c.json({ ok: true, id });
});

app.put("/:id", async (c) => {
  const parsed = BannerUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const b = parsed.data;
  const to = target(b);
  if (await batchMissing(c.env.DB, to.batchId ?? (to.type === "batch" ? to.id : null))) return c.json({ error: "batch_not_found" }, 400);

  const result = await c.env.DB
    .prepare(
      `UPDATE banners SET kind = ?, image_url = ?, title_bn = ?, title_en = ?, description_bn = ?, description_en = ?, batch_id = ?, link_url = ?,
              target_type = ?, target_id = ?, cta = ?, support_hours_bn = ?, support_hours_en = ?, phone = ?, buttons_json = ?,
              starts_at = ?, ends_at = ?, order_index = ?, status = ?
       WHERE id = ?`,
    )
    .bind(
      b.kind, b.imageUrl, b.titleBn, b.titleEn, b.descriptionBn ?? null, b.descriptionEn ?? null, to.batchId, to.linkUrl, to.type, to.id, b.cta,
      b.supportHoursBn ?? null, b.supportHoursEn ?? null, b.phone ?? null, JSON.stringify(b.buttons), b.startsAt ?? null, b.endsAt ?? null,
      b.orderIndex, b.status, c.req.param("id"),
    )
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const result = await c.env.DB.prepare("DELETE FROM banners WHERE id = ?").bind(c.req.param("id")).run();
  if (result.meta.changes === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

export default app;
