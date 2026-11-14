import { useState } from "preact/hooks";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { t } from "@coaching-app/shared/i18n";
import { auth } from "../lib/firebase";
import { authErrorKey } from "../lib/authErrors";
import { loginMode, showWelcome, type LoginMode } from "../lib/onboarding";
import { LangToggle } from "../components/LangToggle";
import { Logo } from "../components/Logo";

type View = LoginMode | "reset";

export function Login() {
  const [view, setView] = useState<View>(loginMode.value);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function run(action: () => Promise<unknown>, onDone?: () => void) {
    setBusy(true);
    setErrorKey(null);
    try {
      await action();
      onDone?.();
    } catch (e) {
      setErrorKey(authErrorKey((e as { code?: string }).code ?? ""));
    }
    setBusy(false);
  }

  const google = () => run(() => signInWithPopup(auth, new GoogleAuthProvider()));

  const submit = (event: Event) => {
    event.preventDefault();
    if (view === "reset") {
      return run(
        () => sendPasswordResetEmail(auth, email.trim()),
        () => setResetSent(true),
      );
    }
    return run(() =>
      view === "in"
        ? signInWithEmailAndPassword(auth, email.trim(), password)
        : createUserWithEmailAndPassword(auth, email.trim(), password),
    );
  };

  const switchTo = (next: View) => {
    setView(next);
    setErrorKey(null);
    setResetSent(false);
  };

  if (view === "reset") {
    return (
      <main class="center">
        <Logo width={140} />
        <h1 class="title">{t("reset_title")}</h1>
        <form class="stack" onSubmit={submit}>
          <div class="field">
            <label for="email">{t("email")}</label>
            <input
              id="email"
              class="input"
              type="email"
              autocomplete="email"
              required
              value={email}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </div>
          {resetSent && <p class="notice small">{t("reset_sent")}</p>}
          {errorKey && <p class="error-text">{t(errorKey)}</p>}
          <button class="btn primary block" type="submit" disabled={busy}>
            {t("reset_send")}
          </button>
          <button class="btn quiet block" type="button" onClick={() => switchTo("in")}>
            {t("back_to_sign_in")}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main class="center">
      <Logo width={150} />
      <LangToggle />
      <h1 class="title">{view === "in" ? t("sign_in") : t("create_account")}</h1>

      <div class="seg" role="tablist">
        <button role="tab" aria-selected={view === "in"} onClick={() => switchTo("in")}>
          {t("sign_in")}
        </button>
        <button role="tab" aria-selected={view === "up"} onClick={() => switchTo("up")}>
          {t("create_account")}
        </button>
      </div>

      {view === "up" && <p class="muted small">{t("first_time_hint")}</p>}

      <button class="btn primary block" onClick={google} disabled={busy}>
        {t("sign_in_google")}
      </button>

      <p class="eyebrow">{t("or")}</p>

      <form class="stack" onSubmit={submit}>
        <div class="field">
          <label for="email">{t("email")}</label>
          <input
            id="email"
            class="input"
            type="email"
            autocomplete="email"
            required
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label for="password">{t("password")}</label>
          <input
            id="password"
            class="input"
            type="password"
            autocomplete={view === "in" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          {view === "up" && <span class="hint">{t("password_hint")}</span>}
        </div>
        {errorKey && <p class="error-text">{t(errorKey)}</p>}
        <button class="btn block" type="submit" disabled={busy}>
          {view === "in" ? t("sign_in_email") : t("create_account")}
        </button>
        {view === "in" && (
          <button class="btn quiet block" type="button" onClick={() => switchTo("reset")}>
            {t("forgot_password")}
          </button>
        )}
      </form>

      <div class="stack">
        <p class="hint">{t("same_method")}</p>
        {view === "up" && <p class="hint">{t("device_lock_note")}</p>}
        <button class="btn small quiet" style="justify-self:start" onClick={showWelcome}>
          {t("how_it_works")}
        </button>
      </div>
    </main>
  );
}
