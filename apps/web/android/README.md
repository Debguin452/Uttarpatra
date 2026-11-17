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

The web push system (`apps/web/src/lib/push.ts`, registering an FCM web
token via a service worker) **will not reliably reach this app** — Android
WebViews don't support the Push API the way full Chrome does, which is why
it was built as a web feature in the first place. The backend (hand-rolled
FCM v1 client in `workers/api/src/lib/push.ts`) can still send to this app,
but only once it registers a token the *native* way — that means adding
`@capacitor/push-notifications` (not done yet) and a small native-token
branch next to the Google Sign-In one above. Flagging this as a known gap
rather than something already working.
