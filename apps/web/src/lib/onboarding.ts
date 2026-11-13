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
export type SignupIntent = "student" | "teacher" | null;

function readIntent(): SignupIntent {
  try {
    const raw = localStorage.getItem("signup-intent");
    return raw === "student" || raw === "teacher" ? raw : null;
  } catch {
    return null;
  }
}

function writeIntent(intent: SignupIntent): void {
  try {
    if (intent) localStorage.setItem("signup-intent", intent);
    else localStorage.removeItem("signup-intent");
  } catch {
    return;
  }
}

export const welcomeSeen = signal(read("welcome-seen"));
export const loginMode = signal<LoginMode>("in");
export const guideHidden = signal(read("guide-hidden"));
export const openedLecture = signal(read("opened-lecture"));
export const signupIntent = signal<SignupIntent>(readIntent());
export const awaitingRoleChoice = signal(false);

export function finishWelcome(mode: LoginMode): void {
  write("welcome-seen");
  loginMode.value = mode;
  welcomeSeen.value = true;
}

export function beginSignup(): void {
  awaitingRoleChoice.value = true;
}

export function chooseSignupRole(intent: "student" | "teacher"): void {
  writeIntent(intent);
  signupIntent.value = intent;
  awaitingRoleChoice.value = false;
  finishWelcome("up");
}

export function clearSignupIntent(): void {
  writeIntent(null);
  signupIntent.value = null;
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
