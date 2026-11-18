# Uttarpatra Android app

A [Capacitor](https://capacitorjs.com/) wrapper around the same web build
(`apps/web/dist`) — no separate codebase. `.github/workflows/android-apk.yml`
builds it (`pnpm build:web` → `npx cap sync android` → `gradlew
assembleDebug`/`assembleRelease`) and uploads the APK(s) as workflow
artifacts; trigger it from the Actions tab ("Run workflow").

- Package name: `com.uttarpatra.app`, registered under the **prism0001**
  Firebase project (the same project as the web app). You mentioned you'd
  also created a separate "uttar-patra" Firebase project earlier — this repo
  stays on **prism0001**, since that's where `com.uttarpatra.app` and the
  web app "Prism" both already live; nothing here needs the other project.
- `google-services.json` is committed at `apps/web/android/app/`, matching
  that package name.

## Google Sign-In: why it needs more than just an SHA fingerprint

`signInWithPopup`/`signInWithRedirect` (the Firebase JS SDK's normal sign-in
calls) **do not work inside a Capacitor WebView** — Google blocks its OAuth
consent screen in any embedded WebView, regardless of certificates. So this
app now uses [`@capacitor-firebase/authentication`](https://github.com/capawesome-team/capacitor-firebase)
for native Google Sign-In on Android instead:

- `apps/web/capacitor.config.ts` configures the plugin
  (`providers: ["google.com"]`, `skipNativeAuth: false`)
- `apps/web/src/screens/Login.tsx` calls `FirebaseAuthentication.signInWithGoogle()`
  when running natively (detected via `Capacitor.isNativePlatform()` in
  `apps/web/src/lib/platform.ts`), and the normal web popup flow otherwise
- With `skipNativeAuth: false` (the default), a native sign-in also updates
  the Firebase JS SDK's auth state automatically, so nothing else in the
  app (`session.ts`'s `onAuthStateChanged`) needed to change

**This is the part that genuinely needs the SHA fingerprint.** Native
Google Sign-In verifies the app by its signing certificate, so Firebase has
to know it.

`apps/web/android/app/debug.keystore` is now **committed to the repo** with
a fixed password (`android`/`android`, alias `androiddebugkey` — the
standard, non-secret Android debug-key defaults) and wired as the `debug`
build type's explicit signing config in `app/build.gradle`. That means
every build — yours locally, or any fresh/ephemeral GitHub Actions runner —
signs with the exact same key, so its fingerprint never changes and you
only need to add it to Firebase **once**:

- **SHA-1**: `46:46:27:F0:66:E0:6A:B6:EF:08:98:B5:4B:5B:65:76:D8:7E:59:F9`
- **SHA-256**: `AE:89:AF:8E:87:91:2A:7D:E6:62:BE:8F:3D:1B:09:39:72:AA:F3:31:E6:D8:B5:1B:B8:FB:2B:9A:B3:3B:61:BF`

Steps:

1. Firebase console → Project settings → scroll to "Your apps" → the
   Android app (`com.uttarpatra.app`) → **Add fingerprint** → paste the
   SHA-1 above (add the SHA-256 too).
2. **Download the updated `google-services.json`** from that same screen
   (it changes once a fingerprint is added — it gets a new OAuth client tied
   to that certificate) and replace `apps/web/android/app/google-services.json`
   in the repo with it.
3. Re-run the `android-apk` workflow (or build locally). Google Sign-In
   should now work in that debug build — this is a one-time setup, not
   something to repeat per build.

(The `android-apk` workflow's "Print signing certificate fingerprints" step
still prints this same value in the log too, as a convenience/sanity check.)

Do the same for a **release** keystore once you set one up (`ANDROID_KEYSTORE_BASE64`
and friends as repo secrets) — a release build signs with a different
certificate, so it needs its own fingerprint added in Firebase.

## Push notifications in this app

Android WebViews don't support the Push API the way full Chrome does, so
the web push system (`apps/web/src/lib/push.ts`, an FCM *web* token via a
service worker) doesn't reach this app. Instead, `apps/web/src/lib/push.ts`
now branches on `isNativeApp()` and, inside the Android app, registers a
**native** FCM token via `@capacitor/push-notifications` — same "Enable
notifications" button on Profile, same `/api/push/register` endpoint on the
backend (it already accepted `platform: "android"`), same hand-rolled FCM
v1 sender (`workers/api/src/lib/push.ts`) that sends to it. No extra native
code was needed beyond installing the plugin and running `cap sync` — it
registers its own Firebase messaging service via the already-committed
`google-services.json`.

What this gives you, and one caveat:

- **App backgrounded or closed**: a class-reminder push shows as a normal
  Android system notification automatically (standard FCM "notification"
  payload behavior) — this is the main case, since reminders fire while
  students probably aren't staring at the app.
- **App open in the foreground**: Android does *not* auto-show a system
  notification in this case (true for any app, not just this one). The
  push still arrives — `PushNotifications.addListener("pushNotificationReceived", ...)`
  can be wired up to show an in-app toast/banner, but that listener isn't
  added yet. Low priority, since reminders are most useful when the app
  isn't already open to the live class.
