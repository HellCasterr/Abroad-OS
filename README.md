# AbroadOS

A private Next.js admissions command center for Bhomik Jain's 2027 master's and scholarship portfolio. This repository contains actual database-backed application code. It does **not** include personal documents, keys, or a live database.

## What works

- Passwordless Supabase email authentication; owner-only, idempotent initial import of the applicant profile, three user-confirmed submitted applications, paused Pavia, a verification-required watchlist, funding leads, and starter tasks.
- Authenticated dashboard, application and scholarship pipelines, programme shortlist, task and notes storage, natural-language and recurring task reminders, deadline calendar, and original-currency expense ledger.
- Private Supabase Storage uploads (PDF/JPEG/PNG/DOCX/XLSX, 15 MB), SHA-256 metadata, short-lived signed preview URLs, deletion, row-level and folder-level access policies. A per-programme document readiness matrix records exact formats and file-size limits and enforces them when attaching a file.
- Server-side official HTML source monitor for an allowlist of approved domains. Checks robots.txt conservatively, validates public DNS and HTTPS, uses ETag/Last-Modified, stores content hashes/snapshots and quoted AI deadline candidates. A person reviews candidate dates before promotion to verified deadlines. Unsupported PDFs and redirects are flagged as unavailable.
- Vercel Cron worker for source checks, near-deadline checks, reminder alerts and weekly digest. Execution log, deduplication, retry/backoff on email delivery, in-app alerts, and a Resend delivery ledger/webhook distinguish queued, provider accepted, delivered and failed.
- OpenAI Responses API drafting for tailored application materials, saved editable versions, cautious user-reported facts, and refusal to invent an IELTS score or programme evidence.
- Optional Google Calendar OAuth with server-side encrypted refresh token and individually authorized event creation. Date-only deadlines create all-day events; times preserve the source timezone.

## Setup

1. Create a Supabase project. In its SQL Editor, run `supabase/migrations/202611190001_initial.sql` (or apply with your Supabase CLI migration workflow). The migration creates the private bucket and RLS policies. Configure Auth email sign-in and an SMTP provider appropriate for sign-in messages.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon key), `SUPABASE_SERVICE_ROLE_KEY` (server only), `OWNER_EMAIL`, `APP_URL`, and a random `CRON_SECRET`. Optionally set the private `OWNER_APS_REFERENCE` and `OWNER_HILDESHEIM_APPLICATION_ID` to import those references without publishing them in source code. Set Site URL and callback URL `${APP_URL}/auth/callback` in Supabase Auth URL configuration. Never expose the service key or provider secrets with `NEXT_PUBLIC_`.
3. `npm install && npm run dev`. Sign in with the email matching `OWNER_EMAIL`, then click **Import Bhomik’s applicant record**. Other signed-in users start with an empty workspace. The import only happens once for the owner and preserves subsequent edits.
4. Optional AI: set `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-5-mini`). User-uploaded files are not transmitted to the model by the current draft flow. The monitor uses AI only to extract reviewable candidates from public source text.
5. Optional email: verify your domain in Resend; set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Add webhook `${APP_URL}/api/email/webhook` for delivered/bounced/complained events and set `RESEND_WEBHOOK_SECRET`. In Settings, opt into notifications and supply a recipient. A provider acceptance is **not** shown as delivery.
6. Optional calendar: configure Google OAuth client with redirect URI `${APP_URL}/api/calendar/callback`; set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `CALENDAR_ENCRYPTION_KEY` (32 random bytes in base64; e.g. `openssl rand -base64 32`). Each user connects their own account. Calendar access is limited to events scope.

## Deploy on Vercel

Import this repository with **Root Directory** `.`. Set all environment variables in Vercel, apply migration, and set `APP_URL` to the actual HTTPS deployment URL. `vercel.json` invokes `/api/cron` with `Authorization: Bearer $CRON_SECRET`. Vercel Cron schedules are UTC: 01:30 daily (07:00 IST) source scan; 03:00 daily (08:30 IST) reminders/email; 02:30 Monday (08:00 IST) weekly digest; 13:00 daily (18:30 IST) near-deadline scan. Inspect plan limits and function duration before enabling many sources; each run caps scheduled checks. Worker invocations do not depend on an open browser.

To test manually, call `/api/cron?job=monitor` with the bearer secret from a trusted terminal, or use **Research now** for one source in the UI. Do not put secrets in shell history or issue logs.

## Trust rules

- All imported personal facts are labelled `user_reported`. Göttingen, Padua and Hildesheim are submitted, **not admitted**. Pavia is paused. Hildesheim's application ID and APS reference can be imported through server-only environment variables or entered later; unknown submission clock time remains unknown. IELTS is booked for 9 December 2026, with no score.
- Watchlist URLs are leads, not verified 2027 calls. No deadlines, currency rates, scholarship amounts or admission probabilities are seeded. Date-only deadlines have no invented 23:59 or IST timestamp.
- The worker only fetches public HTML on an allowlist. Add a new institution domain to `lib/monitor.ts` after reviewing its ownership and site terms. A content hash change triggers a review alert, not an automatic deadline overwrite. The snapshots preserve the before/after content hashes and candidate quotes.
- Inbound emails, submission automation, external institution email, payment and confidential-data disclosure are **not** implemented. The application never performs those actions. Individual Calendar event creation is initiated explicitly by the user.
- Authenticated clients cannot write snapshots, verified deadlines, delivery ledger, OAuth tokens or audit history. Service-role use is limited to server routes and cron. Test RLS with two real Supabase test accounts before production usage.

## Verification and known limits

Run `npm run typecheck`, `npm test`, `npm run test:migration`, `npm run build`. The tests cover unknown clock time, DST conversion, recurring reminders, alert keys, and the monitoring URL boundary. The embedded PostgreSQL migration check applies all tables/policies and checks tenant isolation, forbidden direct deadline/audit writes, cross-tenant links and failed-payment state. Live Supabase Storage integration, actual email delivery, OpenAI calls and Google OAuth need real projects and credentials; they cannot be asserted from local unit tests. No email is sent just by running tests.

Still to build: automated scholarship discovery across all official catalogues, PDF parsing/OCR, automatic import of verified per-programme document requirements, document-aware AI retrieval, form value bank, DOCX/PDF writer export, comprehensive funding scenarios and FX source, admission email ingestion, full search and kanban, calendar event update/deduplication, preference-specific quiet hours, and backup/export/retention UI. The current source monitor captures candidate deadlines from tracked HTML pages; it does not independently guarantee that a 2027 call is open.

## Project structure

`app/[section]` holds the authenticated workspace views; `app/api` has authenticated actions, cron and webhooks; `lib` holds Supabase clients, deadline handling, source monitoring, background jobs and calendar token encryption; `supabase/migrations` contains schema, RLS and storage policies; `tests` contains focused unit tests.
