import { signal } from "@preact/signals";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { idbClear, idbGet, idbSet } from "@coaching-app/shared/cache/idbStore";
import { invalidateQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { api, ApiError, fatal } from "./api";
import { meKey, myBatchesKey, paymentsKey } from "./cacheKeys";
import { auth } from "./firebase";
import type { Me } from "./types";

export const authUser = signal<User | null | undefined>(undefined);
export const me = signal<Me | null>(null);
export const meError = signal<string | null>(null);

// Kept around for a signed-in user to fall back on when /api/me can't be
// reached at all (app opened offline, or straight after an Android cold
// start before connectivity comes back) — without this, a perfectly valid,
// already-persisted sign-in would still dead-end on a blocking error screen
// instead of reaching Home/Batches, which is the one thing the whole
// useCachedQuery offline-catalog setup is meant to avoid.
const ME_CACHE_TTL_MS = 30 * 24 * 60 * 60_000; // staleness only bounds how long we'll trust it at all

export async function loadMe(): Promise<void> {
  const uid = authUser.value?.uid;
  try {
    const result = await api<Me>("/api/me");
    me.value = result;
    meError.value = null;
    if (uid) await idbSet(meKey(uid), result, ME_CACHE_TTL_MS);
  } catch (error) {
    if (fatal.value) return;
    const cached = uid ? await idbGet<Me>(meKey(uid)) : null;
    if (cached) {
      me.value = cached.value;
      meError.value = null;
      return;
    }
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
