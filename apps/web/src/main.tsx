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
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
