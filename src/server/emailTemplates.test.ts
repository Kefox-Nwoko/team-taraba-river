import { describe, it, expect } from "vitest";
import {
  buildMonthlyDigestEmailHtml,
  buildDailyEveAlertEmailHtml,
  buildTestEmailHtml,
} from "../../server/emailTemplates";
import { ParsedCelebrant } from "../../server/birthdayService";
import { Member } from "../../src/types";

describe("emailTemplates", () => {
  const mockMember = {
    id: "mem_1",
    title: "Engr.",
    firstName: "Kefox",
    surname: "Nwoko",
    fullName: "Kefox Nwoko",
    email: "kefox@example.com",
    phoneNumber: "08012345678",
    whatsappNumber: "08012345678",
    schoolName: "FGC Wukari",
    gradYear: "2004",
    occupation: "Software Architect",
    estateName: "Jalingo City",
    role: "member",
  } as unknown as Member;

  const mockCelebrant: ParsedCelebrant = {
    member: mockMember,
    day: 16,
    month: 9,
    monthName: "September",
    formattedDate: "Sep 16",
    daysUntil: 1,
  };

  it("builds a valid Monthly Digest HTML email with simple name list", () => {
    const result = buildMonthlyDigestEmailHtml({
      monthName: "September",
      year: 2026,
      celebrants: [mockCelebrant],
      adminRecipientEmail: "tarabateam@gmail.com",
    });

    expect(result.subject).toContain("Upcoming Birthday Celebrants for September 2026");
    expect(result.html).toContain("Kefox Nwoko");
    expect(result.html).toContain("September 16");
    expect(result.html).not.toContain("https://wa.me");
    expect(result.text).toContain("Kefox Nwoko — September 16");
  });

  it("builds a valid Daily 24-Hour Eve Alert email with simple name list", () => {
    const result = buildDailyEveAlertEmailHtml({
      tomorrowDate: new Date(2026, 8, 16),
      celebrants: [mockCelebrant],
      adminRecipientEmail: "tarabateam@gmail.com",
    });

    expect(result.subject).toContain("Birthday Tomorrow: Kefox Nwoko");
    expect(result.html).toContain("Kefox Nwoko");
    expect(result.html).not.toContain("https://wa.me");
    expect(result.text).toContain("Kefox Nwoko");
  });

  it("builds a valid Test Connection email", () => {
    const result = buildTestEmailHtml("tarabateam@gmail.com");
    expect(result.subject).toContain("Birthday Reminder System Connected");
    expect(result.html).toContain("tarabateam@gmail.com");
    expect(result.html).toContain("12:00 PM WAT");
  });
});
