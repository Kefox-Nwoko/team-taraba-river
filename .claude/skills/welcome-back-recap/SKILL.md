---
name: welcome-back-recap
description: Give the user a short "welcome back" recap at the start of a session on this project — what was last worked on, what was done, what is still open, plus a snippet of the last conversation. Use at the FIRST reply of any new or resumed session, before starting new work, and whenever the user says they are back or asks where we left off.
---

# Welcome-back recap (Team Taraba River)

The owner steps away between sessions and wants their memory jogged when they
return. Do this once, at the start of the first reply of a session, then carry
on with whatever they asked. Keep it short enough to read in about 20 seconds.

## Gather (read-only, takes seconds)

1. **Project memory** — read `project_last_activity.md` in this project's memory
   folder (see `MEMORY.md`). It holds the last known state and open decisions.
2. **Git** — `git log --oneline -5`, `git status --short`, and the current branch.
3. **Last conversation** — run `node .claude/skills/welcome-back-recap/last-session.cjs`
   (optionally pass the current session id to skip it). It prints when the last
   session ended, the user's last messages, and the final assistant reply.
4. **Live systems that were mid-flight** — if the memory says something is
   scheduled or paused (e.g. the `youtube-drain` Cloud Scheduler job), say what
   state it was left in; check it only if it is a one-line read-only command.

Never print secrets (`CRON_SECRET`, tokens, `.env` values) in the recap.

## Present (use this shape)

**Welcome back.** Last activity: *<date/time, one line>*.

- **Last worked on:** one line.
- **Actions taken:** 2–4 bullets, with commit hashes or deploy revisions where relevant.
- **Still open / waiting on you:** the pending decisions, in one line each.
- **Last conversation (snippet):** 1–3 short lines quoting the user's last request and the gist of the last reply.

Then ask what they want to do next, offering the most likely next step.

## Keep it current

At the end of a working session (or after any deploy, commit or decision),
update `project_last_activity.md` so the next recap is accurate. Dates must be
absolute (e.g. 2026-10-05), never "yesterday". If the memory looks stale
compared with `git log`, trust git and say so.
