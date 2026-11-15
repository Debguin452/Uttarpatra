import { render } from "preact";
import { locale, setLocale } from "@coaching-app/shared/i18n";
import { App } from "./app";
import { applyTheme } from "./lib/theme";
import { startSession } from "./lib/session";
import "./styles.css";

applyTheme();
setLocale(locale.value);
startSession();

render(<App />, document.getElementById("app")!);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let registration: ServiceWorkerRegistration | undefined;
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => (registration = reg)).catch(() => undefined);
  });

  // The browser only re-checks sw.js on its own at cold navigation —
  // an app/tab left open for hours (very normal for an installed PWA)
  // never notices a new deploy on its own. Re-checking whenever the
  // user returns to it is what actually surfaces the update promptly.
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") registration?.update().catch(() => undefined);
  });

  // sw.js calls skipWaiting()+clients.claim() on every new deploy, so a
  // new service worker takes control immediately — even in a tab that's
  // already open. Without this listener that tab silently keeps running
  // the OLD bundle until the user force-closes it, so an installed PWA
  // ("the app") can lag behind the live site ("the website") indefinitely.
  // One reload, guarded against firing twice, closes that gap.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    location.reload();
  });
}
