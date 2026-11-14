import { Hono } from "hono";
import { SubjectUpdate, SubjectUpsert } from "@coaching-app/shared/schema";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";

const app = new Hono<AppEnv>();

const audit = (db: D1Database, actor: string, action: string, target: string) =>
  db.prepare("INSERT INTO audit_log (actor_uid, action, target) VALUES (?, ?, ?)").bind(actor, action, target);

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT s.id, s.name_bn, s.name_en, s.active, s.sort_order,
              (SELECT COUNT(*) FROM batch_teachers t WHERE t.subject = s.id) AS assignment_count
       FROM subjects s ORDER BY s.sort_order, s.name_en`,
    )
    .all();
  return c.json(rows.results);
});

app.post("/", requireRole("super_admin"), async (c) => {
  const parsed = SubjectUpsert.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const s = parsed.data;

  const exists = await c.env.DB.prepare("SELECT 1 FROM subjects WHERE id = ?").bind(s.id).first();
  if (exists) return c.json({ error: "subject_id_taken" }, 409);

  await c.env.DB.batch([
    c.env.DB
      .prepare("INSERT INTO subjects (id, name_bn, name_en, active, sort_order) VALUES (?, ?, ?, ?, ?)")
      .bind(s.id, s.nameBn, s.nameEn, s.active ? 1 : 0, s.sortOrder),
    audit(c.env.DB, c.get("uid"), "subject.create", s.id),
  ]);
  return c.json({ id: s.id }, 201);
});

app.put("/:id", requireRole("super_admin"), async (c) => {
  const parsed = SubjectUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
  const s = parsed.data;
  const id = c.req.param("id");

  const claim = await c.env.DB
    .prepare("UPDATE subjects SET name_bn = ?, name_en = ?, active = ?, sort_order = ? WHERE id = ?")
    .bind(s.nameBn, s.nameEn, s.active ? 1 : 0, s.sortOrder, id)
    .run();
  if (claim.meta.changes === 0) return c.json({ error: "not_found" }, 404);

  await audit(c.env.DB, c.get("uid"), "subject.update", id).run();
  return c.json({ ok: true });
});

export default app;
