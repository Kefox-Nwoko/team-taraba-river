import { Member } from "../types";

/**
 * Member credential matcher strictly enforcing registered Email and Phone/WhatsApp number.
 * 
 * Allowed credentials:
 * 1. Registered Email (case-insensitive, exact or whitespace-trimmed)
 * 2. Registered Phone Number / WhatsApp Number across all formats:
 *    - Nigerian local format: 0803..., 0703..., 0814..., 0903...
 *    - International format: +234803..., 234803..., +234 803...
 *    - 10-digit subscriber format: 803..., 703..., 903...
 *    - Formatted strings with spaces, dashes, or parentheses
 */
export function isMemberCredentialMatch(
  m: Member | null | undefined,
  rawInput: string
): boolean {
  if (!m || !rawInput) return false;
  // Clean zero-width, non-breaking spaces, and quotes
  let input = rawInput.trim().replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "");
  input = input.replace(/^['"]+|['"]+$/g, "").trim();
  if (!input) return false;
  const norm = input.toLowerCase();

  // 1. Registered Email match (exact or whitespace-stripped)
  if (m.email) {
    const mEmailNorm = m.email.trim().toLowerCase();
    if (mEmailNorm === norm) return true;
    if (mEmailNorm.replace(/\s+/g, "") === norm.replace(/\s+/g, "")) return true;
  }

  // 2. Extract digits for registered Phone & WhatsApp matching
  const cleanDigits = norm.replace(/\D/g, "");

  // If input contains a valid phone sequence (at least 7 digits)
  if (cleanDigits.length >= 7) {
    const candidatePhones: string[] = [
      m.phoneNumber,
      m.whatsappNumber,
      (m as any).phone,
      (m as any).whatsapp,
      (m as any).mobileNumber,
    ].filter((p): p is string => Boolean(p) && typeof p === "string");

    const searchLast10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const searchLast9 = cleanDigits.length >= 9 ? cleanDigits.slice(-9) : cleanDigits;
    const searchLast8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;
    const searchLast7 = cleanDigits.length >= 7 ? cleanDigits.slice(-7) : cleanDigits;

    for (const phone of candidatePhones) {
      const pDigits = phone.replace(/\D/g, "");
      if (!pDigits || pDigits.length < 7) continue;

      // Direct exact digits match
      if (pDigits === cleanDigits) return true;

      // Suffix / prefix matches (e.g. 0802... vs +234802... vs 802...)
      if (pDigits.includes(cleanDigits) || cleanDigits.includes(pDigits)) return true;

      // Match last 7 to 10 significant digits
      if (searchLast10.length >= 7 && pDigits.includes(searchLast10)) return true;
      if (searchLast9.length >= 7 && pDigits.includes(searchLast9)) return true;
      if (searchLast8.length >= 7 && pDigits.includes(searchLast8)) return true;
      if (searchLast7.length >= 7 && pDigits.includes(searchLast7)) return true;

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

  return false;
}
