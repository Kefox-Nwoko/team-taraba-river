import { Member } from "../src/types";
import { db, isFirestoreAvailable } from "./firebaseAdmin";
import { CSV_SEED_MEMBERS } from "../src/data/csvMembers";
import { serverLogger } from "./logger";

export interface ParsedCelebrant {
  member: Member;
  day: number;
  month: number; // 1-12
  monthName: string;
  formattedDate: string; // e.g. "Sep 15"
  daysUntil: number; // 0 = today, 1 = tomorrow, etc.
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_ABBRS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Normalizes and extracts (day, month) from various birthday strings.
 * Handles formats like:
 * - "15, August", "15 August", "August 15"
 * - "1985-08-15", "15/08/1985", "15-08"
 * - Separate birthDay ("15") and birthMonth ("August" | "8" | "Aug")
 */
export function parseMemberBirthday(
  dobString?: string | null,
  birthDay?: string | null,
  birthMonth?: string | null
): { day: number; month: number } | null {
  // 1. If explicit birthDay and birthMonth are provided
  if (birthDay && birthMonth) {
    const d = parseInt(birthDay.trim(), 10);
    const mStr = birthMonth.trim().toLowerCase();
    let m = parseInt(mStr, 10);

    if (isNaN(m) || m < 1 || m > 12) {
      const foundIdx = MONTH_NAMES.findIndex(
        (name) => name.toLowerCase() === mStr || name.toLowerCase().startsWith(mStr.slice(0, 3))
      );
      if (foundIdx !== -1) {
        m = foundIdx + 1;
      }
    }

    if (!isNaN(d) && d >= 1 && d <= 31 && !isNaN(m) && m >= 1 && m <= 12) {
      return { day: d, month: m };
    }
  }

  if (!dobString || typeof dobString !== "string") return null;

  const cleanDob = dobString.trim();
  if (!cleanDob) return null;

  // 2. Format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleanDob.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { day: d, month: m };
  }

  // 3. Format: DD/MM/YYYY or DD-MM-YYYY or DD-MM
  const dmyMatch = cleanDob.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { day: d, month: m };
  }

  // 4. Format: "15, August" or "15 August" or "August 15" or "15th August"
  const wordMatch1 = cleanDob.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,]+([a-zA-Z]+)/i);
  if (wordMatch1) {
    const d = parseInt(wordMatch1[1], 10);
    const mName = wordMatch1[2].toLowerCase();
    const foundIdx = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === mName || name.toLowerCase().startsWith(mName.slice(0, 3))
    );
    if (foundIdx !== -1 && d >= 1 && d <= 31) {
      return { day: d, month: foundIdx + 1 };
    }
  }

  const wordMatch2 = cleanDob.match(/([a-zA-Z]+)[\s,]+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (wordMatch2) {
    const mName = wordMatch2[1].toLowerCase();
    const d = parseInt(wordMatch2[2], 10);
    const foundIdx = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === mName || name.toLowerCase().startsWith(mName.slice(0, 3))
    );
    if (foundIdx !== -1 && d >= 1 && d <= 31) {
      return { day: d, month: foundIdx + 1 };
    }
  }

  return null;
}

/**
 * Gets the current date/time adjusted to West Africa Time (UTC+1).
 */
export function getWATDate(baseDate: Date = new Date()): Date {
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000); // UTC+1
}

/**
 * Fetch all active members from Firestore (or fallback CSV seed).
 */
export async function getAllMembersForBirthday(): Promise<Member[]> {
  try {
    if (isFirestoreAvailable() && db) {
      const snap = await db.collection("members").get();
      if (!snap.empty) {
        return snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Member[];
      }
    }
  } catch (err) {
    serverLogger.warn("[BirthdayService] Could not fetch members from Firestore, using seed fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return CSV_SEED_MEMBERS as unknown as Member[];
}

/**
 * Gathers all celebrants for a specific month (1-12), sorted chronologically by day.
 */
export async function getCelebrantsForMonth(
  targetMonth: number,
  allMembers?: Member[]
): Promise<ParsedCelebrant[]> {
  const members = allMembers || (await getAllMembersForBirthday());
  const celebrants: ParsedCelebrant[] = [];

  for (const m of members) {
    const raw = m as any;
    const parsed = parseMemberBirthday(m.dateOfBirth, raw.birthDay, raw.birthMonth);
    if (parsed && parsed.month === targetMonth) {
      celebrants.push({
        member: m,
        day: parsed.day,
        month: parsed.month,
        monthName: MONTH_NAMES[parsed.month - 1],
        formattedDate: `${MONTH_ABBRS[parsed.month - 1]} ${parsed.day}`,
        daysUntil: 0,
      });
    }
  }

  // Sort chronologically by day
  return celebrants.sort((a, b) => a.day - b.day);
}

/**
 * Gathers all celebrants celebrating in the NEXT month.
 * e.g. If current month is August (8), returns September (9) celebrants.
 */
export async function getUpcomingNextMonthCelebrants(
  currentDate: Date = getWATDate()
): Promise<{ nextMonth: number; nextMonthName: string; year: number; celebrants: ParsedCelebrant[] }> {
  const curMonth = currentDate.getMonth() + 1; // 1-12
  const curYear = currentDate.getFullYear();

  let nextMonth = curMonth + 1;
  let targetYear = curYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    targetYear += 1;
  }

  const nextMonthName = MONTH_NAMES[nextMonth - 1];
  const celebrants = await getCelebrantsForMonth(nextMonth);

  return {
    nextMonth,
    nextMonthName,
    year: targetYear,
    celebrants,
  };
}

/**
 * Gathers celebrants celebrating TOMORROW (24h eve alert).
 */
export async function getTomorrowCelebrants(
  currentDate: Date = getWATDate()
): Promise<{ tomorrowDate: Date; celebrants: ParsedCelebrant[] }> {
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tDay = tomorrow.getDate();
  const tMonth = tomorrow.getMonth() + 1; // 1-12

  const allMembers = await getAllMembersForBirthday();
  const celebrants: ParsedCelebrant[] = [];

  for (const m of allMembers) {
    const raw = m as any;
    const parsed = parseMemberBirthday(m.dateOfBirth, raw.birthDay, raw.birthMonth);
    if (parsed && parsed.day === tDay && parsed.month === tMonth) {
      celebrants.push({
        member: m,
        day: parsed.day,
        month: parsed.month,
        monthName: MONTH_NAMES[parsed.month - 1],
        formattedDate: `${MONTH_ABBRS[parsed.month - 1]} ${parsed.day}`,
        daysUntil: 1,
      });
    }
  }

  return {
    tomorrowDate: tomorrow,
    celebrants,
  };
}

/**
 * Gathers celebrants celebrating TODAY (D-day alert).
 */
export async function getTodayCelebrants(
  currentDate: Date = getWATDate()
): Promise<{ todayDate: Date; celebrants: ParsedCelebrant[] }> {
  const tDay = currentDate.getDate();
  const tMonth = currentDate.getMonth() + 1; // 1-12

  const allMembers = await getAllMembersForBirthday();
  const celebrants: ParsedCelebrant[] = [];

  for (const m of allMembers) {
    const raw = m as any;
    const parsed = parseMemberBirthday(m.dateOfBirth, raw.birthDay, raw.birthMonth);
    if (parsed && parsed.day === tDay && parsed.month === tMonth) {
      celebrants.push({
        member: m,
        day: parsed.day,
        month: parsed.month,
        monthName: MONTH_NAMES[parsed.month - 1],
        formattedDate: `${MONTH_ABBRS[parsed.month - 1]} ${parsed.day}`,
        daysUntil: 0,
      });
    }
  }

  return {
    todayDate: currentDate,
    celebrants,
  };
}

/**
 * Helper to check if today is the FIRST DAY of the current month.
 */
export function isFirstDayOfMonth(date: Date = getWATDate()): boolean {
  return date.getDate() === 1;
}
