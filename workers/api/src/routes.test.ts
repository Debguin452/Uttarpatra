import { describe, expect, it } from "vitest";
import app from "./index";

const mounted = new Set(app.routes.map((route) => `${route.method} ${route.path}`));

const EXPECTED = [
  "GET /healthz",
  "GET /public/batches",
  "GET /public/banners",
  "GET /api/me",
  "PUT /api/me",
  "PUT /api/me/avatar",
  "GET /api/subjects",
  "GET /api/notices",
  "GET /api/batches/mine",
  "GET /api/batches/:id/content",
  "GET /api/batches/:id/teachers",
  "GET /api/payments/quote",
  "POST /api/payments/manual-upi",
  "GET /api/payments/mine",
  "GET /api/tests",
  "POST /api/attempts/start",
  "POST /api/attempts/submit",
  "GET /api/doubts/mine",
  "POST /api/doubts",
  "GET /api/teacher-application",
  "PUT /api/teacher-application",
  "GET /api/teacher/students",
  "GET /api/teacher/students/:uid",
  "GET /api/teacher/doubts",
  "POST /api/teacher/doubts/:id/answer",
  "GET /api/admin/payments/pending",
  "POST /api/admin/payments/review",
  "GET /api/admin/users/search",
  "GET /api/admin/users/:uid",
  "POST /api/admin/users/:uid/status",
  "POST /api/admin/users/:uid/role",
  "POST /api/admin/users/:uid/enroll",
  "DELETE /api/admin/users/:uid/enroll/:batchId",
  "GET /api/admin/teacher-applications",
  "POST /api/admin/teacher-applications/review",
  "GET /api/admin/teachers",
  "POST /api/admin/teachers/:uid/suspend",
  "GET /api/admin/batches",
  "GET /api/admin/batches/:id",
  "POST /api/admin/batches",
  "PUT /api/admin/batches/:id",
  "POST /api/admin/batches/:id/teachers",
  "DELETE /api/admin/batches/:id/teachers/:uid",
  "GET /api/admin/notices",
  "POST /api/admin/notices",
  "PUT /api/admin/notices/:id",
  "DELETE /api/admin/notices/:id",
  "GET /api/admin/subjects",
  "POST /api/admin/subjects",
  "PUT /api/admin/subjects/:id",
  "GET /api/admin/banners",
  "POST /api/admin/banners",
  "PUT /api/admin/banners/:id",
  "DELETE /api/admin/banners/:id",
  "GET /api/admin/materials",
  "POST /api/admin/materials",
  "PUT /api/admin/materials/:id",
  "DELETE /api/admin/materials/:id",
  "GET /api/admin/analytics/overview",
  "GET /api/admin/analytics/audit-log",
];

describe("API route table", () => {
  it.each(EXPECTED)("%s is mounted", (route) => {
    expect(mounted.has(route)).toBe(true);
  });

  it("mounts every router file in routes/", () => {
    const prefixes = ["/api/teacher/", "/api/doubts", "/public/banners", "/api/admin/banners", "/api/admin/materials"];
    for (const prefix of prefixes) {
      expect([...mounted].some((route) => route.includes(` ${prefix}`))).toBe(true);
    }
  });
});
