import { signal } from "@preact/signals";
import { api } from "./api";
import type { NotificationItem } from "./types";

export const inbox = signal<{ items: NotificationItem[]; unread: number } | null>(null);

let last = 0;

/** Reads the inbox. Quiet on failure, and at most every 20 seconds unless forced. */
export async function refreshInbox(force = false): Promise<void> {
  if (!force && Date.now() - last < 20_000) return;
  last = Date.now();
  try {
    inbox.value = await api<{ items: NotificationItem[]; unread: number }>("/api/notifications");
  } catch {
    /* keep what we have */
  }
}

export async function markAllRead(): Promise<void> {
  const current = inbox.value;
  if (!current || current.unread === 0) return;
  inbox.value = { items: current.items.map((n) => ({ ...n, read: 1 })), unread: 0 };
  try {
    await api("/api/notifications/read", { body: { all: true } });
  } catch {
    await refreshInbox(true);
  }
}

export async function markRead(id: string): Promise<void> {
  const current = inbox.value;
  if (current) {
    const target = current.items.find((n) => n.id === id);
    inbox.value = {
      items: current.items.map((n) => (n.id === id ? { ...n, read: 1 } : n)),
      unread: Math.max(current.unread - (target && !target.read ? 1 : 0), 0),
    };
  }
  try {
    await api("/api/notifications/read", { body: { ids: [id] } });
  } catch {
    /* the next refresh sets it right */
  }
}
