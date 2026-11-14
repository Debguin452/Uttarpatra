import { signal } from "@preact/signals";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { idbClear } from "@coaching-app/shared/cache/idbStore";
import { api, ApiError, fatal } from "./api";
import { auth } from "./firebase";
import type { Me } from "./types";

export const authUser = signal<User | null | undefined>(undefined);
export const me = signal<Me | null>(null);
export const meError = signal<string | null>(null);

export async function loadMe(): Promise<void> {
  try {
    me.value = await api<Me>("/api/me");
    meError.value = null;
  } catch (error) {
    if (fatal.value) return;
    meError.value = error instanceof ApiError ? error.code : "network";
  }
}

export function startSession(): void {
  onAuthStateChanged(auth, async (user) => {
    authUser.value = user;
    me.value = null;
    meError.value = null;
    fatal.value = null;
    if (user) await loadMe();
  });
}

export async function logOut(): Promise<void> {
  await signOut(auth);
  await idbClear();
  me.value = null;
  location.hash = "#/home";
}

export function enrolledIds(): Set<string> {
  const current = me.value;
  return new Set(current && current.registered ? current.enrollments.map((e) => e.batch_id) : []);
}

export function uid(): string {
  return authUser.value?.uid ?? "anon";
}

export function currentRole(): string {
  const current = me.value;
  return current && current.registered ? current.user.role : "guest";
}
