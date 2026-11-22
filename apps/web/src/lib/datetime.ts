// datetime-local inputs speak local time as "2026-12-01T09:30"; the server stores unix seconds.
export const toLocalInput = (unixSec: number | null | undefined): string => {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const toUnixSec = (local: string): number | null => (local ? Math.round(new Date(local).getTime() / 1000) : null);
