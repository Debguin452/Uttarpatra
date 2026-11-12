type GuardRequest = { deviceId?: string; limit?: number; windowSec?: number };

export class SessionGuard {
  private windowStart = 0;
  private count = 0;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/reset-device") {
      await this.state.storage.delete("deviceId");
      return new Response("ok");
    }

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

    if (!body.deviceId) return Response.json({ error: "missing_device_id" }, { status: 400 });

    const bound = await this.state.storage.get<string>("deviceId");
    if (!bound) {
      await this.state.storage.put("deviceId", body.deviceId);
      return Response.json({ ok: true });
    }
    if (bound !== body.deviceId) {
      return Response.json({ error: "device_mismatch" }, { status: 409 });
    }
    return Response.json({ ok: true });
  }
}
