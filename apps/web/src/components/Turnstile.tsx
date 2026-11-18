import { useEffect, useRef } from "preact/hooks";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_script"));
    document.head.appendChild(script);
  });
  return loader;
}

// Bump resetKey to throw the current token away and get a fresh one: a token
// works for exactly one check, so it must be renewed after every attempt.
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let disposed = false;
    loadScript()
      .then(() => {
        if (disposed || !host.current || !window.turnstile) return;
        widgetId = window.turnstile.render(host.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITEKEY,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      disposed = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [resetKey]);

  return <div ref={host} />;
}
