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
to know it:

1. Get the SHA-1 (and SHA-256) of whichever keystore signs your build:
   - Easiest: run the `android-apk` GitHub Action once (Actions tab → "Run
     workflow"). A "Print signing certificate fingerprints" step prints the
     debug keystore's SHA-1/SHA-256 in the log (and the release keystore's
     too, if you've set up `ANDROID_KEYSTORE_BASE64` and friends as repo
     secrets — see `app/build.gradle`'s comment for the exact secret names).
   - Or locally, if you ever have Android Studio / a JDK + the project
     checked out: `cd apps/web/android && ./gradlew signingReport`.
2. Firebase console → Project settings → scroll to "Your apps" → the
   Android app (`com.uttarpatra.app`) → **Add fingerprint** → paste the
   SHA-1 (add SHA-256 too if you have it).
3. **Download the updated `google-services.json`** from that same screen
   (it changes once a fingerprint is added — it gets a new OAuth client tied
   to that certificate) and replace `apps/web/android/app/google-services.json`
   in the repo with it.
4. Re-run the `android-apk` workflow. Google Sign-In should now work in
   that build.

Repeat steps 1–4 for the release keystore once you set one up — a debug
build and a release build have different certificates, so each needs its
own fingerprint added in Firebase.

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
