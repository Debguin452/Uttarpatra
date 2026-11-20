import { signal } from "@preact/signals";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { idbClear } from "@coaching-app/shared/cache/idbStore";
import { invalidateQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { api, ApiError, fatal } from "./api";
import { myBatchesKey, paymentsKey } from "./cacheKeys";
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

let lastRefresh = 0;

// Enrolments are read once at sign-in, so a payment approved while the app
// is open would stay "not enrolled" until the next login. This re-reads them
// when the person comes back to the app or opens a batch. Quiet by design:
// on a failure it keeps what it has, and it will not run more than every
// 15 seconds unless forced (for example right after "already enrolled").
export async function refreshMe(force = false): Promise<void> {
  const user = authUser.value;
  const before = me.value;
  if (!user || !before || !before.registered) return;
  if (!force && Date.now() - lastRefresh < 15_000) return;
  lastRefresh = Date.now();
  try {
    const next = await api<Me>("/api/me");
    me.value = next;
    const ids = (m: Me) => (m.registered ? m.enrollments.map((e) => e.batch_id).sort().join(",") : "");
    if (ids(before) !== ids(next)) await invalidateQuery(myBatchesKey(user.uid), paymentsKey(user.uid));
  } catch {
    /* keep the copy we already have */
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
