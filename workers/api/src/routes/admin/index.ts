import { Hono } from "hono";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";
import analytics from "./analytics";
import banners from "./banners";
import batches from "./batches";
import coupons from "./coupons";
import doubts from "./doubts";
import lectures from "./lectures";
import materials from "./materials";
import notices from "./notices";
import notifications from "./notifications";
import teachers from "./teachers";
import subjects from "./subjects";
import tests from "./tests";
import users from "./users";

const app = new Hono<AppEnv>();

app.use("*", requireRole("support", "super_admin"));
app.use("/analytics/*", requireRole("super_admin"));

app.route("/", users);
app.route("/", teachers);
app.route("/notices", notices);
app.route("/notifications", notifications);
app.route("/doubts", doubts);
app.route("/batches", batches);
app.route("/subjects", subjects);
app.route("/analytics", analytics);
app.route("/banners", banners);
app.route("/materials", materials);
app.route("/lectures", lectures);
app.route("/coupons", coupons);
app.route("/tests", tests);

export default app;
