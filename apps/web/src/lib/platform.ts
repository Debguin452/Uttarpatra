import { Capacitor } from "@capacitor/core";

/** True when running inside the packaged Android app (Capacitor), not a browser. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
