import { Hono } from "hono";
import { requireRole } from "../../middleware/firebaseAuth";
import type { AppEnv } from "../../index";
import analytics from "./analytics";
import batches from "./batches";
import notices from "./notices";
import teachers from "./teachers";
import users from "./users";

const app = new Hono<AppEnv>();

app.use("*", requireRole("support", "super_admin"));
app.use("/analytics/*", requireRole("super_admin"));

app.route("/", users);
app.route("/", teachers);
app.route("/notices", notices);
app.route("/batches", batches);
app.route("/analytics", analytics);

export default app;
