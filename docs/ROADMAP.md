# UttarPatra roadmap: audit against the PW-style plan

Status as of this audit. "Done" means it exists in the repo and is tested;
"Partial" means a usable first version exists; "Missing" means nothing yet.

## What the repo actually contains

The plan assumes `apps/admin`, `apps/mobile` and `workers/live`. They do not
exist. Today: `apps/web` (student, teacher AND admin screens, one app, role
based), `workers/api`, `packages/shared`, `packages/ui`, Cloudflare D1, Firebase
Auth, and an Android wrapper built from the web app. The plan's "keep the
existing repository" rule is followed by extending these, not adding apps.

## Phase status

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Repository audit | Done | this file |
| 2 | Design system | Partial | `packages/ui` tokens + icons exist; the app keeps its exam mark-sheet look. Deep-indigo palette is a design decision, not applied |
| 3 | Student / teacher / admin dashboards | Partial | all three exist; teacher dashboard lacks pending evaluations, attendance |
| 4 | Course, batch, enrollment | Partial | batches, enrolment, payments approval, per-batch banner, teachers shown. Missing: batch start/end dates, schedule, reviews, preview lectures, course categories as a model |
| 5 | Sequential lecture + learning system | **Done in this update (core)** | My Learning tab, Subject > Chapter > Lecture, saved progress, resume, previous/next, chapter %, drafts, scheduled release. Missing: teacher-set prerequisites, chapter objects (chapter is still a name) |
| 6 | Notes, DPP, assignments | Partial | notes and DPP exist (`notes.kind`), attachable to a lecture. Missing: assignments and submissions |
| 7 | Test engine + analytics | Partial | timed tests, results, leaderboard. Missing: question palette/mark for review check, percentile, chapter-wise weakness, PYQ category |
| 8 | Live classes + recordings | Partial | a lecture can be flagged live with a time. Missing: real-time live room (`workers/live`) |
| 9 | Razorpay + subscriptions | Missing | payments are manual UPI with admin approval. D1 payments table already has Razorpay columns |
| 10 | Admin analytics + banner manager | **Done in this update (core)** | launch + community banners, details, scheduling, ordering, CTA; admin and teacher notifications; admin doubts. Missing: separate desktop/mobile images |
| 11 | AI doubt solver + question generator | **Done in this update (core)** | Cloudflare Workers AI; see `docs/AI.md`. Missing: image doubts, AI performance analysis, quiz battle |
| 12 | Certificates, referrals | Missing | |
| 13 | Streaks, goals | Partial | streak shown; goals and rings missing |
| 14 | 1v1 AI quiz battle | Missing | needs Durable Objects and the AI layer first |
| 15 | AI performance analysis | Missing | |

## Decisions needed before building

1. **Single-device binding.** The plan lists it; it was deliberately removed
   earlier. It is not re-added unless you say so.
2. **Razorpay.** Needs a Razorpay account, key id/secret as Worker secrets and a
   webhook URL. Manual UPI keeps working meanwhile.
3. **AI provider.** The plan says Gemini; the cheapest fit for this stack is
   Cloudflare Workers AI, with Gemini as the quality fallback for Bengali.
   Either way the key stays on the server.
4. **Guardian phone number** for students: needs a privacy-policy line first.

## Suggested order from here

1. Chapter objects + batch start/end dates + schedule (finishes Phase 4/5).
2. Assignments + submissions (finishes Phase 6).
3. Test engine gaps: question palette, review marks, percentile, weakness (Phase 7).
4. Razorpay (Phase 9) once the account exists.
5. AI doubt solver, then question generator with teacher review (Phase 11).
6. Certificates and referrals, then goals, then the quiz battle.
