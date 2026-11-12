import { signal } from "@preact/signals";

const read = () => location.hash.replace(/^#\/?/, "") || "home";

export const route = signal(read());

addEventListener("hashchange", () => {
  route.value = read();
  scrollTo(0, 0);
});

export function go(path: string) {
  location.hash = `#/${path}`;
}

export function segments(): string[] {
  return route.value.split("/").map(decodeURIComponent);
}
