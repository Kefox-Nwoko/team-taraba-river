import { Member } from "../types";

/**
 * Universal, high-resilience member credential matcher.
 * Matches by:
 * 1. Email (case-insensitive)
 * 2. Member ID (exact)
 * 3. Phone / WhatsApp / Next of Kin / Neighbor numbers across all formats:
 *    - Nigerian local: 0803..., 0703..., 0814...
 *    - International: +234803..., 234803..., +234 803...
 *    - 10-digit subscriber numbers: 803..., 703...
 *    - Dashed, spaced, dotted, or comma/slash separated multi-number fields
 * 4. Full Name, First Name, Surname, and individual name tokens
 */
export function isMemberCredentialMatch(
  m: Member | null | undefined,
  rawInput: string
): boolean {
  if (!m || !rawInput) return false;
  const input = rawInput.trim().replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "");
  if (!input) return false;
  const norm = input.toLowerCase();

  // 1. Email match
  if (m.email && m.email.trim().toLowerCase() === norm) return true;

  // 2. Member ID match
  if (m.id && m.id.trim().toLowerCase() === norm) return true;

  // 3. Extract clean digits from input
  const cleanDigits = norm.replace(/\D/g, "");

  // If input contains at least 5 digits, perform comprehensive phone number matching
  if (cleanDigits.length >= 5) {
    const candidatePhones: string[] = [
      m.phoneNumber,
      m.whatsappNumber,
      m.nextOfKinPhone,
      m.closestNeighborPhone,
      (m as any).phone,
      (m as any).whatsapp,
      (m as any).telephone,
      (m as any).mobileNumber,
    ].filter((p): p is string => Boolean(p) && typeof p === "string");

    const searchLast10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const searchLast9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;
    const searchLast8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;
    const searchLast7 = cleanDigits.length >= 7 ? cleanDigits.slice(-7) : cleanDigits;

    for (const phone of candidatePhones) {
      const pDigits = phone.replace(/\D/g, "");
      if (!pDigits || pDigits.length < 5) continue;

      // Direct exact digits match
      if (pDigits === cleanDigits) return true;

      // Multi-number or prefix substring match
      if (pDigits.includes(cleanDigits) || cleanDigits.includes(pDigits)) return true;

      // Substring match for last 7, 8, 9, 10 significant digits
      if (searchLast10.length >= 7 && pDigits.includes(searchLast10)) return true;
      if (searchLast9.length >= 7 && pDigits.includes(searchLast9)) return true;
      if (searchLast8.length >= 7 && pDigits.includes(searchLast8)) return true;
      if (searchLast7.length >= 7 && pDigits.includes(searchLast7)) return true;

      // Reverse candidate phone's last 7-10 digits included in cleanDigits
      if (pDigits.length >= 7) {
        const pLast7 = pDigits.slice(-7);
        const pLast8 = pDigits.length >= 8 ? pDigits.slice(-8) : pLast7;
        const pLast9 = pDigits.length >= 9 ? pDigits.slice(-9) : pLast8;
        const pLast10 = pDigits.length >= 10 ? pDigits.slice(-10) : pLast9;

        if (
          cleanDigits.includes(pLast7) ||
          cleanDigits.includes(pLast8) ||
          cleanDigits.includes(pLast9) ||
          cleanDigits.includes(pLast10)
        ) {
          return true;
        }
      }
    }
  }

  // 4. Name match (Full name, First name, Surname, or individual name tokens)
  const fullNameLower = (m.fullName || "").trim().toLowerCase();
  const firstNameLower = (m.firstName || "").trim().toLowerCase();
  const surnameLower = (m.surname || "").trim().toLowerCase();

  if (fullNameLower && fullNameLower === norm) return true;
  if (firstNameLower && firstNameLower === norm) return true;
  if (surnameLower && surnameLower === norm) return true;

  if (norm.length >= 3) {
    if (fullNameLower && (fullNameLower.includes(norm) || norm.includes(fullNameLower))) return true;
    const tokens = fullNameLower.split(/\s+/).filter((t) => t.length >= 3);
    if (tokens.some((t) => t === norm || t.startsWith(norm) || norm.startsWith(t))) return true;
  }

  return false;
}
