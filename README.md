# Coaching App — monorepo

Free-tier-first architecture for a Bengali/English NEET/JEE coaching
platform. See `docs/` for the full write-up; this file is the map.

## Layout
- `apps/web` — student SPA (Vite + Preact, hash routed). The Astro SEO landing pages come in phase 6
- `apps/admin` — admin SPA, separate Pages project, behind Cloudflare Access
- `apps/mobile` — Capacitor wrapper for the Android APK (screen-lock, FCM)
- `workers/api` — Hono API on Cloudflare Workers; the only thing that touches D1
- `workers/live` — Durable Objects: live-class chat, device lock, rate limiter
- `packages/shared` — Zod schemas + quota constants, imported by both web and api
- `packages/ui` — design tokens (`tokens.css`) and the custom icon set
- `db/migrations` — D1 schema
- `firebase` — Firestore rules + emulator rule tests

## Build order (what "gradually" means here)

1. **Foundation** — this scaffold: schema, rules, auth middleware, token
   system, icon set. ✅ done in this pass.
2. **Identity & money** — real Firebase project wiring, custom-claims
   setter script, manual-UPI flow end-to-end, admin approval queue.
3. **Learning** — batch catalog UI, YouTube embeds, notes via Drive,
   notices, FCM push.
4. **Test engine** — exam-taking UI (timer, palette, mark-for-review),
   bulk question import from Excel/CSV, server-side scoring (already
   stubbed in `workers/api/src/routes/attempts.ts`), leaderboard
   snapshotting.
5. **Live & community** — YouTube Live + Durable Object chat/polls,
   doubt threads, small-group WebRTC doubt calls.
6. **Ship** — SEO pass (robots.txt, sitemap, JSON-LD), PWA install,
   signed Capacitor APK, optional Play Store listing.

Each phase ends with something you can actually click through — not just
more files.

## Quota discipline (why some things look unusual)

- Test questions are stored as one JSON blob per test, and an attempt's
  answers as one JSON blob per attempt — so a 300-student mock exam costs
  a few hundred D1 row-writes, not tens of thousands.
- Per-user, high-frequency data (video position, streak, bookmarks) goes
  straight from the client to Firestore and never touches the Worker, so
  it doesn't compete with payments/tests for the 100k req/day Worker cap.
- Firestore rules never call `get()`/`exists()` — those bill as extra
  reads. Roles come from the ID token's custom claims instead.
- See `packages/shared/src/schema.ts` → `QUOTA` for the numeric budgets
  referenced by both the client and the Worker.

## Local setup

```
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate:local
pnpm dev:api
pnpm dev:web
```

Vite proxies `/api` and `/public` to the Worker on `127.0.0.1:8787`, so `VITE_API_URL` stays empty in development.

## Services to configure

- **Firebase**: create a project, enable Google and Email/Password sign-in, copy the web config into the `VITE_FIREBASE_*` variables, and set `FIREBASE_PROJECT_ID` in `workers/api/wrangler.toml`.
- **Cloudflare D1**: `wrangler d1 create coaching_db`, paste the id into `wrangler.toml`, then `pnpm db:migrate:remote`.
- **Turnstile**: set `VITE_TURNSTILE_SITEKEY` and `wrangler secret put TURNSTILE_SECRET`.
- **UPI**: set `VITE_UPI_ID` and `VITE_UPI_PAYEE`.
- **CORS**: put your Pages origin in `ALLOWED_ORIGIN` (comma separated).
- **First admin**: sign in once, then run `wrangler d1 execute coaching_db --remote --command "UPDATE users SET role='super_admin' WHERE uid='<your uid>'"`.
- **GitHub Actions**: secrets `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `FIREBASE_TOKEN`; repository variables for every `VITE_*` value.

## Conventions

- A test answer is the exact text of the chosen option, and `answer` in `questions_json` must equal one of the strings in `options`.
- Question JSON per test: `{ id, type, subject, prompt, options[], answer, marks }`. The API never sends `answer` to the client.
