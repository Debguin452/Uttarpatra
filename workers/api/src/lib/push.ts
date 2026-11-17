// Minimal Firebase Cloud Messaging (HTTP v1) client, hand-rolled for the
// Workers runtime: no Node crypto, no googleapis SDK — just Web Crypto for
// the RS256 service-account JWT and fetch() for the two HTTP calls.
//
// Needs a Firebase service-account JSON (Project settings -> Service
// accounts -> Generate new private key) stored as the FCM_SERVICE_ACCOUNT_JSON
// Worker secret (the whole JSON file's contents, as one string).

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

type PushEnv = { DB: D1Database; FCM_SERVICE_ACCOUNT_JSON?: string };

function base64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const arr = typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey("pkcs8", bytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`fcm_oauth_failed:${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** Sends a notification to every registered push token for the given uids. Silently no-ops if FCM isn't configured or nobody has a token. */
export async function sendPushToUids(
  env: PushEnv,
  uids: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  if (uids.length === 0 || !env.FCM_SERVICE_ACCOUNT_JSON) return;

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as ServiceAccount;
  } catch {
    return;
  }

  const placeholders = uids.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT token FROM push_tokens WHERE uid IN (${placeholders})`)
    .bind(...uids)
    .all<{ token: string }>();
  const tokens = rows.results.map((r) => r.token);
  if (tokens.length === 0) return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch {
    return;
  }

  await Promise.all(
    tokens.map((token) =>
      fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ message: { token, notification, data: data ?? {} } }),
      }).catch(() => null),
    ),
  );
}
