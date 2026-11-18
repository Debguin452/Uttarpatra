// Turns a Google Drive "share" link into a direct image link, which is what
// an <img> needs. Anything else is returned as typed (trimmed).
export function imageSrc(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "drive.google.com") {
      const id = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(parsed.pathname)?.[1] ?? parsed.searchParams.get("id");
      if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    }
  } catch {
    /* not a URL: leave it for the form's own validation */
  }
  return trimmed;
}
