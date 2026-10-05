import { isChapterEvent, parseEventDateObj } from '../src/utils/eventUtils';

/**
 * One media folder per event. Before a member (or an approval) creates a new
 * media folder, this decides whether an existing folder for the same
 * occasion is already there: same calendar day, and the same event judged by
 * title, venue and time of day. Plain rules catch the obvious cases; an AI
 * judge (injected, so this stays testable) handles the fuzzy ones such as
 * "Club Nite" vs "Club Night Party", and tells apart a morning and an evening
 * event on the same day. If the AI is unavailable the rules decide alone.
 */

export interface FolderCheckInput {
  title: string;
  date: string;
  location?: string;
}

export interface FolderCandidate {
  id: string;
  title: string;
  date?: string;
  time?: string;
  location?: string;
}

export interface DuplicateVerdict {
  duplicate: boolean;
  event?: { id: string; title: string; date?: string; location?: string };
  confidence: number;
  method: 'none' | 'rules' | 'ai';
  reason: string;
}

export type AskAi = (prompt: string) => Promise<{ matchId?: string; confidence?: number; reason?: string } | null>;

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'at', 'in', 'on', 'for', 'to', 'with', 'by', 'team', 'taraba', 'river', 'event', 'annual']);
const SYNONYMS: Record<string, string> = { nite: 'night', nights: 'night', parties: 'party', games: 'game' };
const AI_CONFIDENCE_THRESHOLD = 0.7;
const MAX_AI_CANDIDATES = 10;

function tokens(text: string | undefined): Set<string> {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => SYNONYMS[t] || t)
      .filter((t) => !STOP_WORDS.has(t))
  );
}

/** 0..1 word overlap. A shorter title that sits fully inside a longer one counts as a near-match once it has 2+ words. */
export function textSimilarity(a: string | undefined, b: string | undefined): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  if (shared === 0) return 0;
  const smaller = Math.min(A.size, B.size);
  if (shared === smaller && smaller >= 2) return A.size === B.size ? 1 : 0.9;
  return shared / (A.size + B.size - shared);
}

function sameDay(a: string | undefined, b: string | undefined): boolean {
  const da = parseEventDateObj(a);
  const db = parseEventDateObj(b);
  return !!da && !!db && da.getTime() === db.getTime();
}

function toEventInfo(c: FolderCandidate) {
  return { id: c.id, title: c.title, date: c.date, location: c.location };
}

function buildPrompt(input: FolderCheckInput, candidates: FolderCandidate[]): string {
  const list = candidates
    .map((c) => `- id: ${c.id} | title: "${c.title}" | venue: "${c.location || 'unknown'}" | start time: ${c.time || 'unknown'}`)
    .join('\n');
  return `A member of "Team Taraba River", a Nigerian community group, wants to create a NEW media folder (photos/videos) for an event. The group keeps exactly ONE media folder per real-world event, so we must find out whether the event already has a folder.

New folder request:
- title: "${input.title}"
- date: ${input.date}
- venue: "${input.location || 'not given'}"

Existing media folders on the SAME day:
${list}

Decide whether the new request is the SAME real-world event as one of those folders. Compare the wording of the titles (spelling variants, abbreviations, extra words such as "Nite"/"Night", "Party", "Day"), the venue, and the time of day (day vs night). Two clearly different events on the same day (for example a morning sports day and an evening dinner) are NOT the same event. If you are not reasonably sure, answer no match.

Return JSON: { "matchId": the id of the matching folder, or "" if none, "confidence": 0 to 1, "reason": one short sentence }.`;
}

/**
 * Finds the existing media folder, if any, that a new folder request would
 * duplicate. `events` is every event record; only media folders (not calendar
 * announcements) on the same day are considered.
 */
export async function findDuplicateFolder(
  input: FolderCheckInput,
  events: Array<FolderCandidate>,
  askAi?: AskAi,
  excludeEventId?: string
): Promise<DuplicateVerdict> {
  const candidates = events.filter((e) => e && e.id && e.id !== excludeEventId && !isChapterEvent({ id: e.id } as any) && sameDay(e.date, input.date));
  if (candidates.length === 0) return { duplicate: false, confidence: 1, method: 'none', reason: 'No other folder exists for that day.' };

  const scored = candidates
    .map((c) => ({ c, title: textSimilarity(input.title, c.title), loc: input.location && c.location ? textSimilarity(input.location, c.location) : null }))
    .sort((a, b) => b.title - a.title);
  const best = scored[0];

  // Practically the same title on the same day: no need to ask anyone.
  if (best.title >= 0.85) {
    return { duplicate: true, event: toEventInfo(best.c), confidence: 0.95, method: 'rules', reason: `A folder named "${best.c.title}" already exists for this day.` };
  }

  if (askAi) {
    try {
      const answer = await askAi(buildPrompt(input, candidates.slice(0, MAX_AI_CANDIDATES)));
      if (answer) {
        const match = candidates.find((c) => c.id === answer.matchId);
        const confidence = typeof answer.confidence === 'number' ? answer.confidence : 0;
        if (match && confidence >= AI_CONFIDENCE_THRESHOLD) {
          return { duplicate: true, event: toEventInfo(match), confidence, method: 'ai', reason: answer.reason || `This looks like the same event as "${match.title}".` };
        }
        return { duplicate: false, confidence: confidence || 0.5, method: 'ai', reason: answer.reason || 'The existing folders for that day look like different events.' };
      }
    } catch {
      // fall through to the rules
    }
  }

  const ruleMatch = best.title >= 0.6 || (best.title >= 0.4 && best.loc !== null && best.loc >= 0.6);
  if (ruleMatch) {
    return { duplicate: true, event: toEventInfo(best.c), confidence: 0.7, method: 'rules', reason: `"${best.c.title}" on the same day looks like the same event.` };
  }
  return { duplicate: false, confidence: 0.6, method: 'rules', reason: 'The existing folders for that day look like different events.' };
}
