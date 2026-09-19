# DevOps Standards

## Rate limits: one bucket per usage pattern, not per "how expensive it looks"

`server.ts` groups routes into a global 60/min tier, a "heavy" 5/min tier,
and (after this session's fix) a 40/min upload-session tier. The original
bug: `drive/init-upload` and `youtube/init-upload` — called once per file
in a normal batch upload — shared the same 5-req/min bucket as
`cloud-sync-all` and AI endpoints, which are called at most a few times a
session. Anyone uploading more than 5 photos in a minute (normal usage for
a community photo gallery) got silently throttled from file 6 onward. When
adding a new route, ask "how often does one normal user action call this?"
and bucket it with routes of similar frequency — not routes of similar
Google-API cost.

## Credentials: know which account actually holds the quota

Google service accounts get **zero** personal Drive storage. Uploading as
a bare service-account JWT to a folder merely *shared* with that account
fails with `storageQuotaExceeded` regardless of folder permissions. This
app authenticates Drive/YouTube operations as the real `tarabateam@gmail.com`
account via OAuth2 refresh token (`YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`
env vars, reused for both Drive and YouTube scopes) specifically to avoid
this. `getDriveAuthClient()` in `server/mediaPipeline.ts` falls back to a
local `service-account.json` only for dev convenience when OAuth vars
aren't set — don't "simplify" that back to service-account-only, it will
break uploads in production the same way it did before.

Never give a server-only credential (YouTube client secret, refresh
token) a `VITE_` prefix — that inlines it into the public client bundle
and hands out permanent upload access to every visitor.

## Deploys require explicit confirmation, every time

Per `CLAUDE.md`: after finishing a code change, proactively offer to
deploy, but never run `npm run deploy*` without the user confirming that
specific deploy in that specific moment. A prior approval for one deploy
is not standing approval for the next one.

## Recovery tooling is not a live pipeline

`scripts/restore_media_from_drive.cjs` is a manual, break-glass script for
rebuilding event data from Drive if Firestore is ever lost while the Drive
files survive. It is not part of the live app or its API, and removing a
*live* sync feature (like Drive reverse-sync) does not imply this script
should go too — they solve different problems (routine sync vs. disaster
recovery) even though they read Drive similarly. Keep them conceptually
separate, and say so explicitly when doing pipeline cleanup so the
distinction doesn't get lost in the diff.

## Body-size allowlists rot fast — keep them synced with what's actually live

`MEDIA_UPLOAD_PATHS` (the 50MB-body allowlist in `server.ts`) must list
exactly the routes that still receive a base64 payload in the JSON body.
When a route stops taking base64 (moved to direct/resumable upload, or
removed outright), take it off this list in the same change — a stale
entry doesn't break anything visibly, it just quietly leaves a 50MB body
limit open on a route that no longer needs it.
