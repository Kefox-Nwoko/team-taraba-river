import { Member } from "../types";

/**
 * Regex matching any common title prefixes with optional period and trailing spaces.
 * Case-insensitive, global flag for repeated prefixes.
 */
export const TITLE_PREFIX_REGEX =
  /^(?:(?:Mr|Mrs|Ms|Dr|Engr|Prof|Chief|Barr|Pastor|Rev|Hon|Elder|Alhaji|Hajiya|Sir|Lady|Arc|Pharm)\.?\s+)+/gi;

/**
 * Standard known titles in the system schema
 */
export const STANDARD_TITLES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Engr.",
  "Prof.",
  "Chief",
  "Barr.",
  "Pastor",
  "Rev.",
  "Hon.",
  "Elder",
  "Alhaji",
  "Hajiya",
  "Sir",
  "Lady",
  "Arc.",
  "Pharm.",
];

/**
 * Strips all title prefixes from any name string.
 * e.g., "Mr. Mr Kefox Nwoko" -> "Kefox Nwoko"
 *       "Dr. Dr. Chinenye Ikpeama" -> "Chinenye Ikpeama"
 */
export function stripTitlePrefixes(name?: string | null): string {
  if (!name) return "";
  let clean = name.trim();
  // Repeatedly strip until no matching prefix remains
  while (TITLE_PREFIX_REGEX.test(clean)) {
    clean = clean.replace(TITLE_PREFIX_REGEX, "").trim();
    TITLE_PREFIX_REGEX.lastIndex = 0;
  }
  // Replace multiple spaces with a single space
  return clean.replace(/\s+/g, " ").trim();
}

/**
 * Extracts a single valid title prefix if present in the string.
 */
export function detectTitlePrefix(text?: string | null): string | null {
  if (!text) return null;
  const match = text.trim().match(/^(Mr|Mrs|Ms|Dr|Engr|Prof|Chief|Barr|Pastor|Rev|Hon|Elder|Alhaji|Hajiya|Sir|Lady|Arc|Pharm)\.?\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  const found = STANDARD_TITLES.find((t) => t.toLowerCase().replace(".", "") === raw);
  return found || match[0];
}

/**
 * Normalizes title into standard schema form (e.g., "mr" -> "Mr.", "dr" -> "Dr.")
 */
export function normalizeTitle(title?: string | null): string {
  if (!title) return "";
  const detected = detectTitlePrefix(title);
  if (detected) return detected;
  return title.trim();
}

export interface CleanedMemberNames {
  title: string;
  firstName: string;
  surname: string;
  fullName: string;
}

/**
 * Cleans all name components of a member record to guarantee no duplicated titles.
 * Ensures:
 * - title has at most 1 standard title (e.g. "Mr.")
 * - firstName has NO title prefixes
 * - surname has NO title prefixes
 * - fullName has NO title prefixes (pure name "Kefox Nwoko")
 */
export function extractAndCleanMemberNames(member: {
  title?: string | null;
  firstName?: string | null;
  surname?: string | null;
  fullName?: string | null;
}): CleanedMemberNames {
  let title = normalizeTitle(member.title);

  // If title is not set, try to detect from fullName or firstName
  if (!title) {
    title = detectTitlePrefix(member.fullName) || detectTitlePrefix(member.firstName) || "";
  }

  let cleanFirstName = stripTitlePrefixes(member.firstName);
  let cleanSurname = stripTitlePrefixes(member.surname);
  let cleanFullName = stripTitlePrefixes(member.fullName);

  if (cleanFullName && (!cleanFirstName || !cleanSurname)) {
    const parts = cleanFullName.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      if (!cleanFirstName) cleanFirstName = parts[0];
      if (!cleanSurname) cleanSurname = parts.slice(1).join(" ");
    } else if (parts.length === 1) {
      if (!cleanFirstName) cleanFirstName = parts[0];
    }
  }

  if (!cleanFullName && (cleanFirstName || cleanSurname)) {
    cleanFullName = [cleanFirstName, cleanSurname].filter(Boolean).join(" ");
  }

  return {
    title,
    firstName: cleanFirstName,
    surname: cleanSurname,
    fullName: cleanFullName,
  };
}

/**
 * Sanitizes an entire Member object to ensure database consistency without title duplication,
 * and clears placeholder 'Member' occupations to blank.
 */
export function sanitizeMemberRecord<T extends Partial<Member>>(member: T): T {
  if (!member) return member;
  const names = extractAndCleanMemberNames(member);
  let occ = member.occupation || "";
  if (occ.trim().toLowerCase() === "member") {
    occ = "";
  }
  let skills = Array.isArray(member.skills) ? [...member.skills] : [];
  if (skills.length > 0 && skills[0].toLowerCase() === "community support") {
    skills = [];
  }
  return {
    ...member,
    title: names.title,
    firstName: names.firstName,
    surname: names.surname,
    fullName: names.fullName,
    occupation: occ,
    skills,
  };
}

/**
 * Formats a member's display name with exactly one title prefix if available.
 * e.g., formatMemberDisplayName("Mr.", "Mr. Mr Kefox Nwoko") -> "Mr. Kefox Nwoko"
 *       formatMemberDisplayName("Dr.", "Chinenye Ikpeama") -> "Dr. Chinenye Ikpeama"
 */
export function formatMemberDisplayName(title?: string | null, fullName?: string | null): string {
  const cleanName = stripTitlePrefixes(fullName);
  const cleanTitle = normalizeTitle(title) || detectTitlePrefix(fullName) || "";
  if (cleanTitle && cleanName) {
    return `${cleanTitle} ${cleanName}`.trim();
  }
  return cleanName || cleanTitle || "Member";
}

/**
 * Formats a member's name for directory lists with surname in uppercase and clean single title.
 * e.g. "Kefox NWOKO"
 */
export function formatMemberDirectoryName(_title?: string | null, fullName?: string | null): string {
  const cleanName = stripTitlePrefixes(fullName);
  if (!cleanName) return "";
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const surname = parts.pop() || "";
    parts.push(surname.toUpperCase());
    return parts.join(" ");
  }
  return cleanName.toUpperCase();
}
