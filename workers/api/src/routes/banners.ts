import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

// ?kind=launch (default) are the batch promos on Home; ?kind=community are the
// support banners at the top of the Doubt tab. Only banners that are switched on
// AND inside their schedule are returned.
//
// For launch banners the linked batch's details come back too (name, category,
// fee, fee before discount, start date), so the app can show them beside the image
// without a second request. batch_id is resolved for lecture, material and test
// banners as well, and rows saved before banners had targets fall back to
// their old batch_id / link_url.
app.get("/", async (c) => {
  const kind = c.req.query("kind") === "community" ? "community" : "launch";
  const rows = await c.env.DB
    .prepare(
      `SELECT x.*, b.title_bn AS batch_title_bn, b.title_en AS batch_title_en, b.track AS batch_track, b.kind AS batch_kind,
              b.price_paise AS batch_price_paise, b.mrp_paise AS batch_mrp_paise, b.start_date AS batch_start_date,
              b.summary_bn AS batch_summary_bn, b.summary_en AS batch_summary_en
       FROM (
         SELECT bn.id, bn.kind, bn.image_url, bn.title_bn, bn.title_en, bn.description_bn, bn.description_en, bn.link_url, bn.cta,
                bn.support_hours_bn, bn.support_hours_en, bn.phone, bn.buttons_json, bn.order_index,
                COALESCE(bn.target_type, CASE WHEN bn.batch_id IS NOT NULL THEN 'batch' WHEN bn.link_url IS NOT NULL THEN 'link' END) AS target_type,
                COALESCE(bn.target_id, bn.batch_id) AS target_id,
                COALESCE(l.batch_id, n.batch_id, t.batch_id, bn.batch_id) AS batch_id
         FROM banners bn
         LEFT JOIN lectures l ON bn.target_type = 'lecture' AND l.id = bn.target_id
         LEFT JOIN notes n ON bn.target_type = 'material' AND n.id = bn.target_id
         LEFT JOIN tests t ON bn.target_type = 'test' AND t.id = bn.target_id
         WHERE bn.status = 'active' AND bn.kind = ?1
           AND (bn.starts_at IS NULL OR bn.starts_at <= unixepoch())
           AND (bn.ends_at IS NULL OR bn.ends_at > unixepoch())
       ) x
       LEFT JOIN batches b ON b.id = x.batch_id AND b.status = 'published'
       ORDER BY x.order_index LIMIT 10`,
    )
    .bind(kind)
    .all<{ buttons_json: string | null }>();

  return c.json(rows.results.map(({ buttons_json, ...r }) => ({ ...r, buttons: JSON.parse(buttons_json ?? "[]") })));
});

export default app;
