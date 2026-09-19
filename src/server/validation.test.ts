import { describe, it, expect } from "vitest";
import {
  RSVPSchema,
  MemberRegistrationSchema,
  EventCreationSchema,
  ApprovalDecisionSchema,
  AIQuerySchema,
  LoginCredentialSchema,
  AdminAISearchSchema,
  validateBody,
} from "../../server/validation";

describe("RSVPSchema", () => {
  it("accepts attending", () => {
    const result = validateBody(RSVPSchema, { memberId: "mem_1", status: "attending" });
    expect(result.success).toBe(true);
  });

  it("accepts maybe", () => {
    const result = validateBody(RSVPSchema, { memberId: "mem_1", status: "maybe" });
    expect(result.success).toBe(true);
  });

  it("accepts declined", () => {
    const result = validateBody(RSVPSchema, { memberId: "mem_1", status: "declined" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = validateBody(RSVPSchema, { memberId: "mem_1", status: "unknown" });
    expect(result.success).toBe(false);
  });
});

describe("MemberRegistrationSchema", () => {
  const validMember = {
    fullName: "Bako Danladi",
    email: "bako@example.com",
    phoneNumber: "08012345678",
    dateOfBirth: "1985-03-15",
    occupation: "Engineer",
    skills: ["Engineering"],
    photoUrl: "https://example.com/photo.jpg",
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
    otherArea: "",
    streetName: "Youth Avenue",
    closestNeighborName: "Aisha Hassan",
    closestNeighborPhone: "08087654321",
    nextOfKinName: "Danladi Bako",
    nextOfKinPhone: "08011111111",
  };

  it("accepts valid member data", () => {
    const result = validateBody(MemberRegistrationSchema, validMember);
    expect(result.success).toBe(true);
  });

  it("accepts valid member data with Asian and US jersey sizes", () => {
    const asianSize = { ...validMember, jerseySize: 'Asian XXL (US L / CH 46")' };
    expect(validateBody(MemberRegistrationSchema, asianSize).success).toBe(true);

    const usSize = { ...validMember, jerseySize: 'US 11XL (Asian 11XL / CH 64")' };
    expect(validateBody(MemberRegistrationSchema, usSize).success).toBe(true);
  });

  it("rejects missing jerseySize", () => {
    const invalid = { ...validMember, jerseySize: "" };
    expect(validateBody(MemberRegistrationSchema, invalid).success).toBe(false);
  });

  it("rejects invalid email", () => {
    const invalid = { ...validMember, email: "not-an-email" };
    const result = validateBody(MemberRegistrationSchema, invalid);
    expect(result.success).toBe(false);
  });

  it("rejects short phone number", () => {
    const invalid = { ...validMember, phoneNumber: "123" };
    const result = validateBody(MemberRegistrationSchema, invalid);
    expect(result.success).toBe(false);
  });
});

describe("EventCreationSchema", () => {
  const validEvent = {
    title: "Community Cleanup",
    description: "Cleanup event",
    date: "2026-09-01",
    time: "08:00",
    location: "Taraba River",
    category: "cleanup",
    driveImageUrls: [],
    createdBy: "Bako Danladi",
    createdById: "mem_1",
    maxCapacity: 50,
  };

  it("accepts valid event data", () => {
    const result = validateBody(EventCreationSchema, validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const invalid = { ...validEvent, title: "" };
    const result = validateBody(EventCreationSchema, invalid);
    expect(result.success).toBe(false);
  });

  it("accepts a category not in the preset list (falls back to raw text)", () => {
    const custom = { ...validEvent, category: "invalid" };
    const result = validateBody(EventCreationSchema, custom);
    expect(result.success).toBe(true);
  });

  it("rejects a non-string, non-array category", () => {
    const invalid = { ...validEvent, category: 12345 };
    const result = validateBody(EventCreationSchema, invalid);
    expect(result.success).toBe(false);
  });
});

describe("ApprovalDecisionSchema", () => {
  it("accepts approve", () => {
    const result = validateBody(ApprovalDecisionSchema, { action: "approve" });
    expect(result.success).toBe(true);
  });

  it("accepts reject with notes", () => {
    const result = validateBody(ApprovalDecisionSchema, { action: "reject", adminNotes: "Blurry" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = validateBody(ApprovalDecisionSchema, { action: "maybe" });
    expect(result.success).toBe(false);
  });
});

describe("AIQuerySchema", () => {
  it("accepts valid query", () => {
    const result = validateBody(AIQuerySchema, { userQuery: "Who is attending?" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = validateBody(AIQuerySchema, { userQuery: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string query", () => {
    const result = validateBody(AIQuerySchema, { userQuery: 123 });
    expect(result.success).toBe(false);
  });
});

describe("LoginCredentialSchema", () => {
  it("accepts valid credential", () => {
    const result = validateBody(LoginCredentialSchema, { credential: "08012345678" });
    expect(result.success).toBe(true);
  });

  it("rejects empty credential", () => {
    const result = validateBody(LoginCredentialSchema, { credential: "" });
    expect(result.success).toBe(false);
  });
});

