import { describe, it, expect } from "vitest";
import { isMemberProfileComplete, getMissingMemberFields, MANDATORY_MEMBER_FIELD_KEYS } from "./memberValidation";
import { Member } from "../types";

describe("memberValidation", () => {
  const completeMember: Member = {
    id: "mem_test_1",
    title: "Mr.",
    firstName: "Bako",
    surname: "Danladi",
    fullName: "Mr. Bako Danladi",
    dateOfBirth: "15, August",
    jerseySize: 'Asian XXL (US L / CH 46")',
    photoUrl: "https://example.com/avatar.jpg",
    email: "bako@tarabariver.org",
    phoneNumber: "08031234567",
    whatsappNumber: "08031234567",
    schoolName: "Federal Government College, Wukari",
    gradYear: "1998",
    occupation: "Environmental Engineer",
    estateName: "Somiari Estate",
    area: "Rumuodara",
    streetName: "Youth Avenue",
    nextOfKinName: "Aisha Danladi",
    nextOfKinPhone: "08039876543",
    closestNeighborName: "Emeka Okafor",
    closestNeighborPhone: "08035555555",
    role: "member",
    skills: ["Engineering", "Hydrology"],
    activityPoints: 120,
    photoStatus: "approved",
    joinedAt: "2024-01-01",
    lastActive: "2026-08-30",
  };

  it("identifies a fully populated member as complete", () => {
    expect(isMemberProfileComplete(completeMember)).toBe(true);
    expect(getMissingMemberFields(completeMember)).toHaveLength(0);
  });

  it("exempts admin users from profile completion gating", () => {
    const adminUser: Partial<Member> = {
      id: "admin_1",
      role: "admin",
      fullName: "Admin User",
      email: "admin@tarabariver.org",
    };
    expect(isMemberProfileComplete(adminUser as Member)).toBe(true);
    expect(getMissingMemberFields(adminUser as Member)).toHaveLength(0);
  });

  it("detects missing jerseySize and flags profile as incomplete", () => {
    const memberWithoutJersey = { ...completeMember, jerseySize: "" };
    expect(isMemberProfileComplete(memberWithoutJersey)).toBe(false);

    const missing = getMissingMemberFields(memberWithoutJersey);
    expect(missing.some((m) => m.key === "jerseySize")).toBe(true);
  });

  it("detects multiple blank mandatory fields", () => {
    const memberWithBlanks: Partial<Member> = {
      id: "mem_old_1",
      fullName: "Danladi Bako",
      role: "member",
    };
    expect(isMemberProfileComplete(memberWithBlanks as Member)).toBe(false);

    const missing = getMissingMemberFields(memberWithBlanks as Member);
    expect(missing.length).toBeGreaterThan(5);
    expect(missing.some((m) => m.key === "jerseySize")).toBe(true);
    expect(missing.some((m) => m.key === "schoolName")).toBe(true);
    expect(missing.some((m) => m.key === "whatsappNumber")).toBe(true);
  });

  it("handles null and undefined input gracefully", () => {
    expect(isMemberProfileComplete(null)).toBe(false);
    expect(isMemberProfileComplete(undefined)).toBe(false);
    expect(getMissingMemberFields(null)).toHaveLength(0);
  });
});
