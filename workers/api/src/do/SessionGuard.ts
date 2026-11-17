type GuardRequest = { limit?: number; windowSec?: number };

// Per-user request rate limiter. The class keeps its original name because
// wrangler.toml's Durable Object migration refers to it.
export class SessionGuard {
  private windowStart = 0;
  private count = 0;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== "/guard") return new Response("not_found", { status: 404 });

    const body = (await request.json().catch(() => ({}))) as GuardRequest;
    const nowSec = Math.floor(Date.now() / 1000);
    const windowSec = body.windowSec ?? 60;
    const limit = body.limit ?? 60;

    if (nowSec - this.windowStart >= windowSec) {
      this.windowStart = nowSec;
      this.count = 0;
    }
    this.count += 1;
    if (this.count > limit) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ ok: true });
  }
}
