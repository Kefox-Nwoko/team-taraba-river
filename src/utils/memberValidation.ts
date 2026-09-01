import { Member } from "../types";
import { MEMBER_DATABASE_SCHEMA } from "../constants/memberSchema";

/**
 * List of mandatory member fields that must be non-empty for a complete profile.
 */
export const MANDATORY_MEMBER_FIELD_KEYS: Array<keyof Member> = [
  "title",
  "firstName",
  "surname",
  "fullName",
  "dateOfBirth",
  "jerseySize",
  "photoUrl",
  "email",
  "phoneNumber",
  "whatsappNumber",
  "schoolName",
  "gradYear",
  "occupation",
  "estateName",
  "area",
  "streetName",
  "nextOfKinName",
  "nextOfKinPhone",
  "closestNeighborName",
  "closestNeighborPhone",
];

/**
 * Checks if a member has filled all mandatory profile fields.
 * Admin users are exempt.
 */
export function isMemberProfileComplete(user: Member | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  for (const field of MANDATORY_MEMBER_FIELD_KEYS) {
    const val = user[field];
    if (val === undefined || val === null) return false;
    if (typeof val === "string" && val.trim() === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
  }
  return true;
}

/**
 * Returns human-readable labels for any mandatory fields missing from a member's profile.
 */
export function getMissingMemberFields(user: Member | null | undefined): Array<{ key: keyof Member; label: string }> {
  if (!user || user.role === "admin") return [];

  const missing: Array<{ key: keyof Member; label: string }> = [];

  for (const field of MANDATORY_MEMBER_FIELD_KEYS) {
    const val = user[field];
    const isBlank = val === undefined || val === null || (typeof val === "string" && val.trim() === "");
    if (isBlank) {
      const schemaDef = MEMBER_DATABASE_SCHEMA.find((s) => s.key === field);
      const label = schemaDef?.label || (field === "fullName" ? "Full Name" : field);
      missing.push({ key: field, label });
    }
  }

  return missing;
}
