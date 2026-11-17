import { signal } from "@preact/signals";
import { api } from "./api";
import { firebaseApp } from "./firebase";

export type PushStatus = "unsupported" | "default" | "denied" | "granted" | "busy";

function currentStatus(): PushStatus {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as PushStatus;
}

export const pushStatus = signal<PushStatus>(currentStatus());

/**
 * Asks for notification permission (if needed) and registers this
 * browser/device's FCM web token with the backend. No-ops quietly if the
 * browser doesn't support push, the user denies the prompt, or the app's
 * VITE_FIREBASE_VAPID_KEY / messaging config isn't set up yet.
 */
export async function enablePush(): Promise<void> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    pushStatus.value = "unsupported";
    return;
  }

  pushStatus.value = "busy";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      pushStatus.value = permission as PushStatus;
      return;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      // Config not finished yet (see public/sw.js comments) — permission is
      // granted, but there's no VAPID key to fetch a token with.
      pushStatus.value = "granted";
      return;
    }

    const { getMessaging, getToken } = await import("firebase/messaging");
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token) {
      await api("/api/push/register", { body: { token, platform: "web" } });
    }
    pushStatus.value = "granted";
  } catch {
    pushStatus.value = currentStatus();
  }
}
