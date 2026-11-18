export type TurnstileCheck = { ok: boolean; codes: string[] };

// Cloudflare's reasons ("invalid-input-secret", "timeout-or-duplicate", ...)
// come back with the verdict. They are returned to the caller so a failed
// check can be diagnosed instead of guessed at.
export async function verifyTurnstile(token: string | undefined, secret: string | undefined): Promise<TurnstileCheck> {
  if (!secret) return { ok: false, codes: ["server-secret-not-set"] };
  if (!token) return { ok: false, codes: ["missing-input-response"] };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { ok: data.success === true, codes: data["error-codes"] ?? [] };
  } catch {
    return { ok: false, codes: ["siteverify-unreachable"] };
  }
}
