# Project Management Standards

## Retrace before you build

Before starting new work in an area of this codebase, spend the few
minutes to retrace what's already there. This session found three
independent, fully-wired pipelines doing overlapping jobs (staged base64
upload vs. direct resumable upload; Drive reverse-sync vs. the
direct-upload pipeline that already wrote the same data; a YouTube
back-sync toggle whose two positions did the same thing) — each added at a
different time, each reasonable in isolation, none reconciled against what
already existed. That reconciliation is a project-management failure as
much as an engineering one: nobody asked "do we already have a way to do
this?" before adding the next way.

## Scope discipline

Per `CLAUDE.md`: only touch the components or code blocks that actually
have the issue being worked on. The one deliberate exception is a
debloat/removal pass explicitly requested — that's allowed to be wide,
but every deletion in it must be grep-verified as dead (see
`full-stack.md`'s removal checklist), not assumed dead because it "looks
old."

## The removal checklist (repeat this for every "remove X" request)

1. Confirm scope with the user in one line when the boundary is genuinely
   ambiguous (e.g., "does removing reverse sync also mean removing the
   recovery script that reads Drive the same way?" is worth a single
   clarifying question — a compound cleanup task is not).
2. Trace every layer the feature touches: client UI, client service
   wrapper, server route, server implementation, validation schema, rate
   limiter registration, body-size allowlist, tests, related UI copy.
3. Leave clearly-labeled backward-compatibility shims only when deleting
   them would break already-persisted data with no code path left to
   handle it (e.g., a URL-format detector for data already sitting in
   Firestore from a removed sync feature) — and say so explicitly when
   reporting the change, don't let it look like an oversight.
4. Report what was removed, what was deliberately kept and why, and what
   residual risk remains (e.g., stale duplicate records the removal
   doesn't retroactively clean up).

## When to ask vs. when to just act

- Ask when a decision affects what data or capability the user actually
  relies on ("does anyone add media directly in Drive?" before deleting
  the only bridge for that workflow).
- Don't ask before deleting code that is provably unreachable (zero call
  sites after a full-repo grep) — that's an engineering judgment call, not
  a product decision.
- Don't ask before running `npx tsc --noEmit` or re-running the test
  suite — verification is never optional and never needs permission.

## MVP-stage discipline

This project is MVP-stage (see project memory). Don't over-engineer,
don't add configuration surface or abstraction for hypothetical future
scale. The actual failures in this codebase were never from
under-engineering — they were unfinished, un-reconciled parallel systems.
Favor finishing and removing over adding another layer.
