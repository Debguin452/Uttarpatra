export async function verifyTurnstile(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token }),
  });
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}
