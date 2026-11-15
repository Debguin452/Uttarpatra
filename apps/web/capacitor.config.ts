import type { CapacitorConfig } from "@capacitor/cli";

// The APK is this same Vite build, just wrapped — not a separate
// codebase. `npx cap sync` copies dist/ (already produced by
// `pnpm build`) into the Android project; there is no server.url
// live-reload pointer here on purpose, so a release build keeps
// working offline-first exactly like the installed PWA does.
const config: CapacitorConfig = {
  appId: "com.uttarpatro.app",
  appName: "উত্তরপত্র",
  webDir: "dist",
  // Default scheme is already "https", spelled out because
  // workers/api's CORS allowlist (ALLOWED_ORIGIN) has to match it —
  // see wrangler.toml.
  android: {
    androidScheme: "https",
  },
};

export default config;
