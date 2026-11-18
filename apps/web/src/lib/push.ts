import { signal } from "@preact/signals";
import { api } from "./api";
import { firebaseApp } from "./firebase";
import { isNativeApp } from "./platform";

export type PushStatus = "unsupported" | "default" | "denied" | "granted" | "busy";

function currentStatus(): PushStatus {
  if (isNativeApp()) return "default"; // resolved async in enablePush(); see checkNativeStatus()
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as PushStatus;
}

export const pushStatus = signal<PushStatus>(currentStatus());

if (isNativeApp()) void checkNativeStatus();

async function checkNativeStatus(): Promise<void> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { receive } = await PushNotifications.checkPermissions();
  pushStatus.value = receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default";
}

/**
 * Asks for notification permission (if needed) and registers this
 * device's FCM token with the backend — the native Android token on the
 * packaged app (via @capacitor/push-notifications, using the same
 * google-services.json/Firebase project), or a Web Push token in the
 * browser (via the service worker + VAPID key). No-ops quietly if the
 * platform doesn't support push, the user denies the prompt, or (web
 * only) VITE_FIREBASE_VAPID_KEY isn't set up yet.
 */
export async function enablePush(): Promise<void> {
  if (isNativeApp()) return enableNativePush();

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

async function enableNativePush(): Promise<void> {
  pushStatus.value = "busy";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let { receive } = await PushNotifications.checkPermissions();
    if (receive !== "granted") {
      ({ receive } = await PushNotifications.requestPermissions());
    }
    if (receive !== "granted") {
      pushStatus.value = "denied";
      return;
    }

    const registered = new Promise<string>((resolve, reject) => {
      PushNotifications.addListener("registration", (token) => resolve(token.value));
      PushNotifications.addListener("registrationError", (err) =>
        reject(new Error(err.error ?? "registration failed")),
      );
    });
    await PushNotifications.register();
    const token = await registered;

    await api("/api/push/register", { body: { token, platform: "android" } });
    pushStatus.value = "granted";
  } catch {
    pushStatus.value = "default";
  }
}
