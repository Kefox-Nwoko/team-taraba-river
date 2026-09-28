import { describe, expect, it } from "vitest";
import { birthdayLabel, toCommunityView } from "../../server/memberPrivacy";
import type { Member } from "../types";

const full: Member = {
  id: "mem_1",
  fullName: "Ada Obi",
  title: "Dr.",
  firstName: "Ada",
  surname: "Obi",
  email: "ada@example.com",
  phoneNumber: "08011111111",
  whatsappNumber: "08022222222",
  dateOfBirth: "1990-10-12",
  occupation: "Physician",
  skills: ["Medicine"],
  photoUrl: "https://example.com/ada.jpg",
  photoStatus: "approved",
  role: "member",
  activityPoints: 120,
  joinedAt: "2026-01-01T00:00:00.000Z",
  lastActive: "2026-09-01T00:00:00.000Z",
  schoolName: "FGGC Owerri",
  area: "Choba",
  streetName: "1 Secret Street",
  nextOfKinName: "Kin",
  nextOfKinPhone: "08033333333",
  closestNeighborPhone: "08044444444",
};

describe("birthdayLabel", () => {
  it("drops the year from an ISO date", () => {
    expect(birthdayLabel({ dateOfBirth: "1990-10-12" })).toBe("October 12");
  });
  it("normalises free-text dates", () => {
    expect(birthdayLabel({ dateOfBirth: "12th of October" })).toBe("October 12");
    expect(birthdayLabel({ dateOfBirth: "April 1" })).toBe("April 1");
  });
  it("falls back to birthMonth/birthDay", () => {
    expect(birthdayLabel({ dateOfBirth: "", birthMonth: "March", birthDay: "5" })).toBe("March 5");
  });
  it("returns an empty string when there is no usable birthday", () => {
    expect(birthdayLabel({ dateOfBirth: "" })).toBe("");
    expect(birthdayLabel({ dateOfBirth: "not a date" })).toBe("");
  });
});

describe("toCommunityView", () => {
  const view = toCommunityView(full);

  it("keeps only what the birthday calendar and member count need", () => {
    expect(view.id).toBe("mem_1");
    expect(view.fullName).toBe("Ada Obi");
    expect(view.photoUrl).toBe("https://example.com/ada.jpg");
    expect(view.dateOfBirth).toBe("October 12");
  });

  it("never leaks contact, address, family or profile details", () => {
    const json = JSON.stringify(view);
    for (const secret of [
      "ada@example.com", "08011111111", "08022222222", "1990", "Physician", "Medicine",
      "FGGC Owerri", "Choba", "Secret Street", "Kin", "08033333333", "08044444444",
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(view.activityPoints).toBe(0);
  });
});
