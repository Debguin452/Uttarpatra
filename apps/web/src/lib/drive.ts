// Shared Google Drive helpers: turning whatever a teacher pastes into a bare
// file ID, building the URLs the app uses to view a file, and (when
// configured) opening Google's own Picker so a teacher can choose or upload
// a file without ever touching a file ID.

const SHARE_LINK_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // drive.google.com/file/d/<id>/view
  /\/document\/d\/([a-zA-Z0-9_-]{10,})/, // docs.google.com/document/d/<id>/edit
  /\/presentation\/d\/([a-zA-Z0-9_-]{10,})/,
  /\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/,
  /[?&]id=([a-zA-Z0-9_-]{10,})/, // drive.google.com/open?id=<id>
];

/** Pulls the bare file ID out of any Google Drive/Docs share link. A plain ID (or
 * anything else unrecognized) passes through unchanged, so it's always safe to
 * run whatever a teacher pastes through this before saving it. */
export function extractDriveFileId(input: string): string {
  const trimmed = input.trim();
  for (const pattern of SHARE_LINK_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return trimmed;
}

/** Embeds the file inline (used by the in-app material viewer). */
export function driveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/** Opens the file in Drive's own full-page viewer (fallback link, new tab). */
export function driveOpenUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

const PICKER_SCOPE = "https://www.googleapis.com/auth/drive.file";

let apisLoaded: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadGoogleApis(): Promise<void> {
  if (!apisLoaded) {
    apisLoaded = Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]).then(() => undefined);
  }
  return apisLoaded;
}

function loadPickerLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gapi = (window as any).gapi;
    gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("picker load failed")) });
  });
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: PICKER_SCOPE,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error ?? "no access token"));
      },
    });
    // Must run inside the click handler that triggered this — Google's
    // consent popup only opens for a direct user gesture.
    client.requestAccessToken();
  });
}

/** True only when both Drive Picker env vars are configured (build-time). */
export function isDrivePickerConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_DRIVE_API_KEY && import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID);
}

async function shareWithAnyoneReader(fileId: string, accessToken: string): Promise<void> {
  // Picker-selected/uploaded files are visible to the picking teacher via the
  // drive.file scope, but students have no Drive access of their own — make
  // the file link-viewable so the in-app embed and "Open in Drive" link both
  // work for them. Best-effort: a failure here just means the teacher may
  // need to flip on link-sharing themselves.
  await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

/**
 * Opens Google's Picker so a teacher can choose an existing Drive file or
 * upload a new one, without ever copying a file ID. Returns null if they
 * cancel. Must be called directly from a click handler (no `await` before
 * it) so the browser treats the Google sign-in popup as user-initiated.
 */
export async function openDrivePicker(): Promise<{ id: string; name: string } | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string;
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string;
  if (!apiKey || !clientId) throw new Error("Drive picker is not configured");

  await loadGoogleApis();
  const [accessToken] = await Promise.all([requestAccessToken(clientId), loadPickerLib()]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google;

  return new Promise((resolve, reject) => {
    const picker = new google.picker.PickerBuilder()
      .addView(google.picker.ViewId.DOCS)
      .addView(new google.picker.DocsUploadView())
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback(
        (data: { action: string; docs?: { id: string; name: string }[] }) => {
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            const doc = data.docs[0];
            shareWithAnyoneReader(doc.id, accessToken).finally(() => resolve({ id: doc.id, name: doc.name }));
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        },
      )
      .build();
    try {
      picker.setVisible(true);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
