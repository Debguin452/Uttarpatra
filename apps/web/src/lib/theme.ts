import { signal } from "@preact/signals";

export type Theme = "system" | "light" | "dark";

function read(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    return "system";
  }
  return "system";
}

export const theme = signal<Theme>(read());

export function applyTheme(next: Theme = theme.value): void {
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);
}

export function setTheme(next: Theme): void {
  theme.value = next;
  try {
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
  } catch {
    applyTheme(next);
    return;
  }
  applyTheme(next);
}
