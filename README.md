# উত্তরপত্র Coaching Institute

Learning platform for a Bengali and English coaching institute. It serves school students in **Classes 5 to 12** and aspirants preparing for **NEET, JEE and CUET**.

It is built to run on free tiers: Cloudflare Pages and Workers, D1, Durable Objects, Firebase Authentication. Production is the Pages project `uttarpatro` with the Worker `coach`.

## What each role gets

Every account signs in with Google or email. The server decides what the account can do. The client only chooses which screens to draw.

| Role | How they get it | Experience |
|---|---|---|
| Student | Default after sign-up | Student app: batches, lectures, materials, notices, tests, payments |
| Teacher | Chooses "teacher" at sign-up, applies, a super admin approves | Application status and assigned batches. Roster and doubts exist as API only |
| Support | Set by a super admin | Admin console: payments, users, batches (read), notices |
| Super admin | Set in the database (see below) | Admin console: everything, including teachers, batches, subjects |

Staff accounts (support and super admin) land in the admin console and never see the student screens.

A support or super admin account can also hold teacher access as an add-on, set independently of `role` via the `is_teacher` flag on `users`. This does not change which console the account lands in; it only unlocks `/api/teacher` and lets the account be assigned to batches like a regular teacher. A super admin grants or revokes it from the user search result in the admin console. Revoking it unassigns the account from every batch.

## What is built

**Student app (`apps/web`)**
- Welcome and first-time guidance, Google and email sign-in, password reset
- Sign-up shows a three-step progress indicator (role, account, profile) and greets the student by first name once they type it
- Registration with class 5 to 12 or dropper, language switch (English and Bengali), light and dark theme
- Batch catalogue filtered by class and exam, defaulting to the student's own class
- Enrolling by manual UPI: coupon quote, UTR, compressed screenshot, Turnstile check
- My batches (archived batches stay visible to students who own them), YouTube lectures, study materials from Google Drive, notices
- Timed tests: server-held timer, question palette, mark for review, one attempt, server-side scoring
- Profile, payment history, teacher application

**Admin console (staff only, loaded on demand)**
- Payments: review queue, screenshot view, approve or reject
- Users: search, block or unblock, grant or revoke teacher access for support and super admin accounts
- Batches: create, edit, publish, archive, assign teachers by subject
- Teachers: approve or reject applications, remove access
- Notices: global or per batch, pinned
- Subjects: add, rename, switch off. Teachers and batch assignments pick from this list

**Home strip**
- Public banners from `/public/banners` show as a strip on Home

**API only, no screen yet**
- Admin user detail, manual enroll and revoke, role change

The route table in `workers/api/src/routes.test.ts` lists every endpoint and fails if one stops being mounted.

## Layout

```
apps/web          Student app and admin console. Vite, Preact, hash routing
workers/api       Hono API on Cloudflare Workers. The only code that touches D1
packages/shared   Zod schemas, scoring, pricing, analytics maths, i18n, cache helpers
packages/ui       Design tokens (tokens.css) and the custom icon set
db/migrations     D1 schema, 0001 to 0004
firebase          Firestore rules
infra/scripts     Usage check used by the alert workflow
.github/workflows deploy.yml and usage-alert.yml
```

`apps/admin`, `apps/mobile` and `workers/live` from the original plan do not exist. The admin console lives inside `apps/web` and is split into its own bundle, so students never download it.

## Architecture

Every request to `/api/*` passes, in order: Firebase token check, then one Durable Object call that enforces a per-user rate limit, then a registration check, then the route. Roles are read from D1 on each request, so a change applies immediately. Public batch and banner lists are cached at the edge for five minutes.

Quota habits that shape the code:
- A test's questions are one JSON blob, and an attempt's answers are one JSON blob, so a 300-student exam costs hundreds of D1 writes, not tens of thousands.
- Scoring happens on the server. The client never receives the correct answers, and the timer is held server-side.
- Durable Object rate-limit counters live in memory, so they cost no storage writes.
- Firestore rules never call `get()` or `exists()`. The web app does not use Firestore yet.
- Numeric budgets live in `QUOTA` in `packages/shared/src/schema.ts`.

## Classes, exams and subjects

- A batch has one `track`: `class5` to `class12`, `neet`, `jee`, `cuet`, `crash`, `one_shot`.
- A student's class is `5` to `12` or `dropper`.
- Subjects are rows in the `subjects` table, seeded with 19 (science, languages, social science, commerce, humanities, CUET general test). Super admins add or switch off subjects in the console. Teacher applications and batch assignments validate against this table on the server.

## API summary

| Prefix | Who | Purpose |
|---|---|---|
| `/public/batches`, `/public/banners` | Anyone | Catalogue and banners, edge cached |
| `/api/me` | Signed in | Profile, enrollments |
| `/api/batches`, `/api/notices`, `/api/subjects`, `/api/tests`, `/api/attempts`, `/api/payments`, `/api/doubts` | Registered users | Learning, tests, payments |
| `/api/teacher-application` | Registered users | Apply and check status |
| `/api/teacher` | Teachers, and support/super admin accounts with `is_teacher` set | Roster and doubts for assigned batches |
| `/api/admin` | Support and super admin | Console. Payment review, user search and notices are open to support. Analytics, audit log, batch edits, roles, enrollments, blocking, subjects and granting/revoking teacher access are super admin only |

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

- **Firebase**: enable Google and Email/Password sign-in. Put the web config in the `VITE_FIREBASE_*` variables and the project id in `FIREBASE_PROJECT_ID` in `workers/api/wrangler.toml`.
- **D1**: database name `database`. Its id is in `wrangler.toml`. Apply schema with `pnpm db:migrate:remote`.
- **Turnstile**: `VITE_TURNSTILE_SITEKEY`, and `wrangler secret put TURNSTILE_SECRET` in `workers/api`.
- **UPI**: `VITE_UPI_ID` and `VITE_UPI_PAYEE`.
- **CORS**: list the Pages origins in `ALLOWED_ORIGIN`, comma separated.
- **GitHub Actions**: secrets `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `FIREBASE_TOKEN`, and a repository variable for every `VITE_*` value.
- **First super admin**: sign in once, copy your UID from Firebase Console, Authentication, Users, then run:

```
pnpm --filter api exec wrangler d1 execute database --remote \
  --command "UPDATE users SET role='super_admin' WHERE uid='<your uid>'"
```

## Database migrations

| File | Adds |
|---|---|
| `0001_core.sql` | Users, batches, lectures, notes, tests, attempts, payments, coupons, doubts, audit log |
| `0002_teachers.sql` | Teacher applications |
| `0003_content.sql` | Banners, note kinds |
| `0004_academic_levels.sql` | Classes 5 to 12 and CUET as batch tracks, the `subjects` table |
| `0005_dual_teacher_access.sql` | `is_teacher` flag on `users`, letting a support or super admin account also hold teacher access |

SQLite cannot change a `CHECK` constraint in place, so `0004` rebuilds `batches`. D1 rejects the usual rename-and-drop trick when other tables point at the table. The pattern that works is: defer foreign keys, copy rows to a plain stash table, drop, recreate, insert back, drop the stash. Use it for any future table rebuild and test it on a database that already contains rows in the child tables before shipping.

## Design system and brand

- Palette: brand navy `#03297E` as the single accent, gold for live and pinned states, warm grey paper, graphite ink. Dark theme has its own tokens. All of it lives in `packages/ui/src/tokens.css`.
- Type: Source Serif 4 and Noto Serif Bengali for headings and numbers, Hind Siliguri for all interface text.
- Direction: an exam mark-sheet. Hairline rules and flat panels, no gradients, no shadows.
- Logo and icons are in `apps/web/public`: `logo.webp` for the interface, plus app icons, a maskable icon, an Apple touch icon and a favicon cut from the supplied logo. The `Logo` component renders `logo.webp`.
- Dropdowns use one `Select` component: a bottom sheet on phones, a popover on larger screens, search for lists over eight items, keyboard and screen-reader support. Do not add native `<select>` elements.

## Languages

All visible text goes through `t()` with keys in `packages/shared/src/i18n/en.json` and `bn.json`. Both files must have the same keys. A key missing from either shows as its raw name on screen, so add both together.

## Testing

```
pnpm typecheck
pnpm test
```

Unit tests cover scoring, pricing, analytics maths, the cache layer, i18n and the API route table. CI runs both before deploying. Behaviour that needs a database, such as the migrations and role rules, was checked against a local D1 using Wrangler's `getPlatformProxy` with simulated users in each role.

## Conventions

- A test answer is the exact text of the chosen option. `answer` in `questions_json` must equal one of the strings in `options`.
- Question JSON per test: `{ id, type, subject, prompt, options[], answer, marks }`. The API never sends `answer` to the client.
- Never trust the client for access. Every route checks the role and, for teachers, the batch assignment.
- Routes that change money, roles or access write to `audit_log`.
- New TypeScript is written without inline comments. Keep functions small and names plain.

## Next

1. Teacher panel: batches, roster, doubts. The API exists.
2. Teacher authoring: lectures, live class scheduling, notes, tests.
3. Student doubts screen and banners on the home screen. The API exists.
4. Admin insights and audit log screens, user detail, manual enroll and revoke. The API exists.
5. Attendance, DPP submissions, result review and leaderboards.
6. Public landing page for search and sharing.
