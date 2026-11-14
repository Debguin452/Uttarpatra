import { Hono } from "hono";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";
import analytics from "./analytics";
import banners from "./banners";
import batches from "./batches";
import materials from "./materials";
import notices from "./notices";
import teachers from "./teachers";
import subjects from "./subjects";
import users from "./users";

const app = new Hono<AppEnv>();

app.use("*", requireRole("support", "super_admin"));
app.use("/analytics/*", requireRole("super_admin"));

app.route("/", users);
app.route("/", teachers);
app.route("/notices", notices);
app.route("/batches", batches);
app.route("/subjects", subjects);
app.route("/analytics", analytics);
app.route("/banners", banners);
app.route("/materials", materials);

export default app;
