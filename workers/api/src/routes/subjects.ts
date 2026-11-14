import { Hono } from "hono";
import type { AppEnv } from "../index";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const rows = await c.env.DB
    .prepare("SELECT id, name_bn, name_en, active, sort_order FROM subjects ORDER BY sort_order, name_en")
    .all();
  return c.json(rows.results);
});

export default app;
