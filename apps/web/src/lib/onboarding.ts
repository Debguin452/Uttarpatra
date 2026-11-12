import { signal } from "@preact/signals";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    return;
  }
}

export type LoginMode = "in" | "up";

export const welcomeSeen = signal(read("welcome-seen"));
export const loginMode = signal<LoginMode>("in");
export const guideHidden = signal(read("guide-hidden"));
export const openedLecture = signal(read("opened-lecture"));

export function finishWelcome(mode: LoginMode): void {
  write("welcome-seen");
  loginMode.value = mode;
  welcomeSeen.value = true;
}

export function showWelcome(): void {
  welcomeSeen.value = false;
}

export function hideGuide(): void {
  write("guide-hidden");
  guideHidden.value = true;
}

export function markOpenedLecture(): void {
  if (openedLecture.value) return;
  write("opened-lecture");
  openedLecture.value = true;
}
