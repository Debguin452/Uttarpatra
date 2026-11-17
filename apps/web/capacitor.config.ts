import type { CapacitorConfig } from "@capacitor/cli";

// The APK is this same Vite build, just wrapped — not a separate
// codebase. `npx cap sync` copies dist/ (already produced by
// `pnpm build`) into the Android project; there is no server.url
// live-reload pointer here on purpose, so a release build keeps
// working offline-first exactly like the installed PWA does.
const config: CapacitorConfig = {
  appId: "com.uttarpatra.app",
  appName: "উত্তরপত্র",
  webDir: "dist",
  // Default scheme is already "https", spelled out because
  // workers/api's CORS allowlist (ALLOWED_ORIGIN) has to match it —
  // see wrangler.toml.
  android: {
    androidScheme: "https",
  },
  // Google sign-in has to go through the native Firebase Auth SDK here —
  // signInWithPopup/signInWithRedirect from the JS SDK don't work inside
  // Capacitor's WebView (Google blocks OAuth consent screens there).
  // skipNativeAuth: false (the default) keeps the native sign-in synced
  // into the JS SDK's auth state, so the rest of the app (session.ts's
  // onAuthStateChanged) needs no native-vs-web branching.
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
    },
  },
};

export default config;
