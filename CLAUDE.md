# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Team Taraba River is a community portal (member directory, events/RSVPs, photo/video media
sharing, birthday reminders, AI knowledge assistant) built as a single Vite/React SPA served
by a single Express server that also hosts the entire REST API. It originated from an AI
Studio ("Gemini") applet template — `README.md`/`.env.example` still reference that origin,
but the app has grown well beyond it.

## Commands

```bash
npm install                # install deps
npm run dev                 # tsx server.ts — runs Express + Vite (middleware mode) on :3001
npm run build                # vite build (client -> dist/public) + esbuild bundle server.ts -> dist/server.cjs
npm start                    # run the built server: node dist/server.cjs
npm run lint                 # tsc --noEmit (no separate eslint config in this repo)
npm test                     # vitest run (single run)
npm run test:watch           # vitest (watch mode)
npm run test:rules           # firebase emulators:exec --only firestore, runs src/server/firestoreRules.test.ts
```

Run a single test file or test name with vitest directly, e.g.:
```bash
npx vitest run src/utils/memberValidation.test.ts
npx vitest run -t "some test name"
```

Deployment (still requires explicit user confirmation before actually running — these affect
live infra — but after finishing a code change, proactively offer to deploy it rather than
staying silent; do not run the command until the user confirms):
```bash
npm run deploy               # build + firebase deploy (hosting + functions + rules)
npm run deploy:hosting       # build + firebase deploy --only hosting
npm run deploy:cloudrun      # build + gcloud run deploy (the API server)
npm run deploy:functions     # firebase deploy --only functions,hosting
```

There is no `Dockerfile` in the repo despite `build:docker` referencing one — check before
assuming that script works.

## Architecture

### One server, two responsibilities

`server.ts` (top-level, ~4100 lines) is both the Express API server and the dev-time web
server: in non-production it creates a Vite dev server in middleware mode and serves
`index.html` with client-side routing fallback; in production it serves the built
`dist/public` static assets with the same SPA fallback. All `/api/*` routes are defined
directly in this one file (not split into route-file modules) — search it by route path
(`app.get("/api/...")`) rather than expecting a router directory. Supporting logic lives in
`server/` (auth, config, Firestore admin, validation schemas, media pipeline, email, birthday
digests, login codes) and is imported into `server.ts`.

Note: `src/server/` is a different directory — it holds **tests** for the `server/` modules
(`adminAISearch.test.ts`, `mediaPipeline.test.ts`, `validation.test.ts`, etc.), not server code.

### Auth & authorization model

- Firebase Auth (client SDK) issues ID tokens; the server is the only place role
  (`member` vs `admin`) is decided — via a Firebase custom claim or the `ADMIN_EMAILS`
  allowlist in `server/config.ts`. The client never keeps its own copy of the admin list
  (see the comment in `src/lib/config.ts`); it must call `apiClient.verifySession()` and
  trust the server's answer.
- `server/authMiddleware.ts` exports `authMiddleware` (verifies the `Authorization: Bearer`
  ID token via Admin SDK) and `requireAdmin`.
- `server.ts` wraps these in `conditionalAuth` / `optionalAuth` / `conditionalRequireAdmin`:
  when Firestore Admin isn't reachable, deployed environments (`K_SERVICE` set, or
  `NODE_ENV=production`) fail closed with 503; local dev instead falls back to a mocked
  `{ uid: 'local_dev', role: 'admin' }` user so the app is usable without credentials.
  `optionalAuth` additionally allows fully anonymous requests through for public read
  endpoints (e.g. `GET /api/events`).
- `requireCronSecret` gates the `/api/cron/*` endpoints (birthday digests, expired-event
  purge) behind a `CRON_SECRET` env var, meant to be called by an external scheduler
  (Cloud Scheduler); it refuses all requests if the secret isn't configured.

### Data layer

Firestore is the source of truth (`members`, `events`, `photoRequests`/approvals,
`mediaItems` collections — see `COLLECTIONS` in `server.ts`). `firestore.rules` /
`storage.rules` define security rules and are exercised by `firestoreRules.test.ts` against
the Firestore emulator (`npm run test:rules`). `server/firebaseAdmin.ts` initializes the
Admin SDK, preferring a local `service-account.json` key file for dev convenience and
falling back to Application Default Credentials (what Cloud Run injects automatically) in
deployed environments — never assume a key file is present in production. Requests are
validated with `zod` schemas centralized in `server/validation.ts` before touching Firestore.

### Client structure

React 19 + Vite + Tailwind v4. `src/main.tsx` → `src/App.tsx` is a single large stateful
component, not a router — navigation is a `activeTab` state machine
(`media | events | admin | architecture | upload | profile | manual`) persisted to
`localStorage`. Shell components (`Navbar`, `EventCalendarView`, `LoginGate`,
`MobileBottomNav`, `SignInModal`, `HeroBanner`) are eagerly imported for first paint; heavier
views/modals (`AdminDashboardView`, `AIKnowledgeAssistant`, `FullPageMediaUpload`,
`MemberRegistrationModal`, `MyProfileView`, `UserManualView`, etc.) are `lazy()`-loaded.
Incomplete member profiles are force-redirected to the `profile` tab (never for admins).

Client-side persistence/services (`src/services/`):
- `storage.ts` — `AppStateManager`, a localStorage-backed cache of members/events/approvals/
  current user/visit metrics/cloud media config/recycle bin, used for optimistic UI and
  offline resilience; state is versioned via key suffixes (e.g. `taraba_river_members_v7_live`).
- `apiClient.ts` — the fetch wrapper for all `/api/*` calls (the "REST" path).
- `firebaseService.ts` — `FirebaseSyncManager`/`FirebaseService`, direct client-side Firebase
  usage (auth sign-in, some direct Firestore sync) that is separate from the REST API client.
- `EngagementTracker.ts` — activity/points tracking.
- `googleDriveDirectUpload.ts` / `youtubeDirectUpload.ts` — client-side halves of the
  resumable direct-upload flows (browser uploads straight to a signed Google session URL).

### Media upload pipeline

Two cloud storage targets: Google Drive (photos, and video fallback) and YouTube (videos).
Two upload strategies coexist:
1. Base64 staged upload: `POST /api/media/upload` stages a base64 payload (in Firestore, or
   an in-memory `Map` fallback if Firestore is unavailable), then `POST /api/media/finalize`
   pushes it to Drive/YouTube. Implemented in `server/mediaPipeline.ts`.
2. Direct resumable upload: `/api/media/drive/init-upload` and `/api/media/youtube/init-upload`
   open a resumable upload session server-side and hand the client a single-use session URL,
   so large files go straight from the browser to Google without transiting the server as
   base64 JSON.

`server/mediaPipeline.ts` also generates video thumbnails using `fluent-ffmpeg` +
`ffmpeg-static`. YouTube OAuth credentials (`YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`) are
server-only and must never be given a `VITE_` prefix — that would inline them into the public
bundle and hand out permanent channel-upload access to every visitor (see `.env.example`).
The current branch (`security/server-side-media-upload-bridge`) is actively touching this
area (`FullPageMediaUpload.tsx`, `firebaseService.ts`) — check `git log`/`git diff` before
assuming the upload flow described here hasn't shifted.

### Cross-cutting server concerns (all inline in `server.ts`, no external middleware libs)

- CORS: manual allowlist via `ALLOWED_ORIGINS` env var (comma-separated), not the `cors` package.
- Rate limiting: hand-rolled in-memory per-IP token buckets — global 60 req/min on `/api/`,
  a stricter 5 req/min tier on expensive routes (AI endpoints, `cloud-sync-all`, YouTube/Drive
  init-upload, `usosa-news`), and a 10 req/min tier applied per-route to auth endpoints.
- Security headers (nosniff, frame-deny, HSTS in production, etc.) are set manually.
- In-memory request metrics (`requestMetrics`) and a 30s memory-pressure check (warns/errors
  based on RSS thresholds tuned for a 512MB Cloud Run instance) back `/api/system/metrics`.

### AI features

`@google/genai` (Gemini) powers the query router (`/api/ai/query-router`), stats insights
(`/api/ai/stats-insights`), admin AI search (`/api/admin/ai-search`), and `/api/ai-xplora`.
These route free-text queries to member search, events, media, or the knowledge base and are
rate-limited under the "heavy" tier.

### Email

`server/emailService.ts` + `server/emailTemplates.ts` send transactional email via the Brevo
API: monthly birthday digests, day-before birthday alerts, and one-time login codes
(`server/loginCodes.ts`, verified via `/api/auth/login/verify-code`) as an alternative to
Firebase Google sign-in.

## Working conventions

- Scope edits tightly: only touch the components or code blocks that actually have the
  issue being worked on. Do not modify unaffected code (formatting sweeps, unrelated
  refactors, drive-by cleanups) as part of an unrelated fix or feature.

## Security-sensitive files (never commit)

`.env`, `service-account.json`, and `firebase-applet-config.json` hold credentials —
see `SECURITY.md` for the full policy and incident-response steps.
