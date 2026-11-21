# AI in UttarPatra

Built on **Cloudflare Workers AI** (model `@cf/openai/gpt-oss-20b`, set by
`AI_MODEL` in `workers/api/wrangler.toml`). No API key: the Worker has an `AI`
binding. Everything runs on the server; the app never talks to the model.

## What it does
| Where | Who | What |
|-------|-----|------|
| Doubt tab > Ask AI | students | chat with a tutor; history kept server-side (last 60 messages) |
| Doubt tab > Ask a teacher | students | "Get an instant AI answer" under a posted doubt |
| Teacher doubt sheet | teachers | "Draft with AI" fills an empty answer box for the teacher to edit |
| Test result > Review your answers | students | explanation of a missed question; saved and shared, so each question is paid for once per language and exam style |
| Test editors (admin + teacher) | staff | "Write questions with AI": drafts only, added to the test for review |

## Exam patterns (`packages/shared/src/examProfiles.ts`)
Every prompt carries the rules of the student's exam: WBCHSE Class 12 Semester 3
(MCQ, 1 mark, no negative marking) and Semester 4 (written), NEET UG 2026
(180 MCQs, +4/-1, NCERT), JEE Main Paper 1, plus a careful generic board profile.
Only patterns checked against official or widely reported 2026 sources are
written down. **Re-check each year** and update `verifiedOn`. Students can pick
the style; otherwise it follows their board, class and goal.

## Staying inside its rules
1. Student text is cleaned, fenced in tags the model is told to distrust, and
   screened for "ignore your rules" tricks before any cost is spent.
2. Chat history comes only from the database, so a made-up "assistant" turn
   cannot be sent from the app.
3. The security rules are the last thing in every prompt; a hidden marker in them
   is checked for in every reply, and a reply that looks like leaked
   instructions is replaced with a refusal.
4. Three refused attempts in a day pause AI for that person until tomorrow.
5. AI is switched off for a student during a timed test.
6. The model has no tools and no access to anyone's data: the worst a successful
   trick can do is produce text.
No prompt can make a language model impossible to trick; these layers keep the
damage small and visible.

## Cost controls
Daily limits per person (`AI_USER_DAILY_LIMIT` 12, `AI_TEACHER_DAILY_LIMIT` 40)
and for the whole app (`AI_GLOBAL_DAILY_LIMIT` 400, about the free allowance).
A failed model call gives the use back. Counters live in `ai_usage`.

## Privacy
Questions are sent to Cloudflare Workers AI to be answered, and chat messages are
stored (60 per student, deleted on "Clear chat"). The Privacy Policy should say so.
