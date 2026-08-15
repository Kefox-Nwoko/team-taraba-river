import { describe, it, expect } from "vitest";
import { getMemberSearchableText, getMonthNameFromDate } from "../components/MemberDirectoryView";
import { Member } from "../types";

const sampleMember: Member = {
  id: "mem_1",
  fullName: "Bako Danladi",
  email: "bako@example.com",
  phoneNumber: "08012345678",
  dateOfBirth: "1985-08-15",
  occupation: "Engineer",
  skills: ["Coding", "Design"],
  photoUrl: "https://example.com/photo.jpg",
  photoStatus: "approved",
  role: "member",
  activityPoints: 100,
  joinedAt: "2024-01-01T00:00:00Z",
  lastActive: "2024-01-02T00:00:00Z",
  title: "Mr.",
  firstName: "Bako",
  surname: "Danladi",
  whatsappNumber: "08012345678",
  gradYear: "2008",
  schoolName: "FGC Port Harcourt",
  maritalStatus: "Single",
  jerseySize: "L",
  estateName: "Somiari Estate",
  area: "Rumuodara",
  otherArea: "Mgbuogba",
  streetName: "Youth Avenue",
  closestNeighborName: "Aisha",
  closestNeighborPhone: "08087654321",
  nextOfKinName: "Danladi Bako",
  nextOfKinPhone: "08011111111",
  isGoogleAuth: false,
};

describe("getMonthNameFromDate", () => {
  it("extracts month from ISO date", () => {
    expect(getMonthNameFromDate("1985-08-15")).toBe("august");
  });

  it("extracts month name from text", () => {
    expect(getMonthNameFromDate("15, August")).toBe("august");
  });

  it("returns null for unknown format", () => {
    expect(getMonthNameFromDate("unknown")).toBeNull();
  });
});

describe("getMemberSearchableText", () => {
  it("includes all text fields", () => {
    const text = getMemberSearchableText(sampleMember);
    expect(text).toContain("bako");
    expect(text).toContain("engineer");
    expect(text).toContain("rumuodara");
    expect(text).toContain("august");
  });

  it("does not throw on optional missing fields", () => {
    const minimal: Member = {
      ...sampleMember,
      whatsappNumber: undefined,
      otherArea: undefined,
      skills: undefined,
    };
    expect(() => getMemberSearchableText(minimal)).not.toThrow();
  });
});
