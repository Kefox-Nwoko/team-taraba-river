---
name: senior-engineering-standards
description: Senior-level (30-year combined) full-stack engineering, UI/UX, project-management, and DevOps judgment for Team Taraba River. Load before writing or reviewing code, adding or removing a data pipeline / sync mechanism / API route, making a UI/UX decision, scoping or planning work, or touching deploy config, rate limits, or credentials in this repo.
---

# Team Taraba River — Senior Engineering Standards

This skill exists because this codebase has repeatedly accumulated parallel,
half-working versions of the same capability (a base64-staged media upload
pipeline *and* a direct-resumable one; a Drive reverse-sync *and* a forward-
push; a YouTube back-sync toggle whose "forward" and "reverse" positions
both silently called the same function). Each was added reasonably at the
time. None were removed when superseded. The cost showed up as user-facing
dysfunction (rate-limit exhaustion on ordinary batch uploads, duplicated
gallery events, broken video playback) that took a full audit to untangle.

The standards below exist to stop that pattern from recurring — here, and
anywhere this team works. Read the relevant reference file before acting;
this file is the index and the rules that apply everywhere.

## The one rule that would have prevented most of this

**Before adding a new way to do something this codebase already does,
grep for the existing way first.** Before removing something, grep for
every caller — client components, server routes, validation schemas,
tests, rate-limit registrations, body-size allowlists — not just the
function definition. "It's not imported anywhere I can see" is not the
same as "I grepped the whole repo and found zero call sites."

## References

- `references/full-stack.md` — coding and architecture judgment: pipeline
  hygiene, dead-code discipline, trust boundaries, verifying third-party
  behavior before shipping it.
- `references/ui-ux.md` — interface honesty and feedback: never report
  success for work that didn't happen, never show a control with no real
  effect, progress must track ground truth.
- `references/project-management.md` — scoping, the removal checklist,
  when to ask vs when to just act.
- `references/devops.md` — rate limits, credentials, deploy discipline,
  recovery tooling.

## Non-negotiables (apply on every task, no exceptions)

1. Run `npx tsc --noEmit` after every edit that touches `.ts`/`.tsx`. Clean
   compile is necessary, never sufficient — it does not catch a route with
   zero callers or a UI control wired to nothing.
2. Never fabricate an identifier for something the server actually created
   (a real Drive folder ID, a real resource ID). If the client needs it,
   the server returns it. A placeholder like `thing_${Date.now()}` in a
   field meant to reference a real external resource is a bug, not a
   convenience.
3. Never let an operation report success when it did nothing (or did less
   than it claims). If a code path is a stub, say so in the response and
   the UI, or finish it — don't leave it lying to whoever reads the result.
4. Scope edits tightly (this is also in `CLAUDE.md`): touch only the
   components with the actual issue. Debloating dead code is the one
   exception where a wide, mechanical sweep is correct — but sweep with
   grep-verified call-sites, not guesses.
5. This app is MVP-stage. Don't add abstraction, config surface, or
   defensive engineering for scenarios the app doesn't have yet. The
   failures in this codebase were never from under-engineering — they were
   from unfinished parallel systems left half-alive.
