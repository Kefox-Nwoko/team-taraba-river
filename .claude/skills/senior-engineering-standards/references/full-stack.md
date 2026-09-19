# Full-Stack Engineering Standards

## Pipeline hygiene — the recurring failure mode in this codebase

This app has, at various points, had two or three ways to do the same
thing at once:

- A base64-JSON staged upload (`/api/media/upload` + `/api/media/finalize`)
  and a direct browser-to-Google resumable upload
  (`/api/media/drive/init-upload`, `/api/media/youtube/init-upload`). Only
  the second was ever called from the client. The first sat there, fully
  wired end-to-end (server routes, validation schemas, Firestore/in-memory
  fallback store, a TTL sweep interval, tests) with zero real traffic,
  for long enough to look load-bearing.
- Drive "reverse sync" (pull from Drive into Firestore) alongside the
  direct-upload pipeline, which already wrote the authoritative event data
  at upload time. Reverse sync didn't know that, so it re-derived events
  from Drive folder listings and minted a second `gdrive_<folderId>` event
  for anything the direct-upload path had already created — duplicating
  every gallery it touched.
- A YouTube "back-sync" direction toggle where both positions called the
  identical function with identical arguments. The toggle was cosmetic;
  clicking either side did the same (broken) thing.

**The lesson, generalized**: when a new pipeline supersedes an old one,
finish the job — delete the old one in the same change, or in the very
next one. A superseded pipeline doesn't fail loudly; it just sits there
until someone (user or engineer) hits it by accident, or until an audit
finds it. Treat "this still exists in the code" as a claim that it's live;
verify that claim by grepping for callers before trusting it.

## Before adding a new route, sync mechanism, or client wrapper

1. Grep for existing routes/functions that already do something similar.
   `Grep "cloud-sync\|reverse.*sync\|back-sync"` would have surfaced all
   three parallel Drive/YouTube mechanisms in one query.
2. If you're adding a v2 of something, plan the v1 removal as part of the
   same body of work, not as a "someday" cleanup.

## Before removing a route, schema, or exported function

Grep the *whole* repo for the exact symbol name, not just its file. Check,
in order:

1. Client call sites (components, services) — the real signal of whether
   it's live.
2. Other server files that import it.
3. Validation schemas that back only that route.
4. Rate-limiter registrations (`app.use(path, limiter)`) naming that path.
5. Any body-size / adaptive-parser allowlist naming that path.
6. Tests that import the function — a test file whose only subject is the
   code you just deleted should be deleted with it, not left red.
7. UI copy that references the feature by name (button labels, toggle
   descriptions, help text).

`npx tsc --noEmit` will catch (2), (3), (6) if they're TypeScript. It will
not catch (1), (4), (5), (7) — those need grep.

## Trust boundaries and identifiers

- The server is the only place that should mint or resolve identifiers for
  resources it creates (Drive folder IDs, Firestore doc IDs from external
  systems). If the client needs that ID after the fact, add it to the
  response — don't let the client synthesize a lookalike.
- `driveFolderId` on an event record must be a real Google Drive folder
  ID or empty — never a fabricated placeholder. Any code that reads that
  field to decide "does a folder already exist" will silently do the
  wrong thing if it's fake.

## Verify third-party behavior before depending on it

- `lh3.googleusercontent.com/d/<fileId>` only serves a file that's been
  explicitly made public (`role: reader, type: anyone`); it does not
  authenticate as your service account. The server-side `/api/media/image/
  :fileId` proxy exists specifically as a fallback for files that aren't
  public yet or ever — keep both, they cover different failure modes.
- Don't assume a CDN link format that works for images also works
  identically for video (Range-request / seeking support can differ).
  Confirm the specific behavior you're relying on, not the general
  reputation of the host.

## Rate limits are a usage-pattern decision, not a cost-tier decision

`drive/init-upload` and `youtube/init-upload` look "expensive" (they talk
to Google) but are called once per file in an ordinary batch upload —
completely different call frequency than an admin's once-a-day sync
button or an AI query. Sharing one rate-limit bucket across routes with
different call patterns will throttle the highest-frequency one first,
usually invisibly, until someone uploads more than N files and asks why
half failed. Give each genuinely distinct usage pattern its own bucket.
