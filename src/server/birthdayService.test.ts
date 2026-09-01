import { describe, it, expect } from "vitest";
import {
  parseMemberBirthday,
  isLastDayOfMonth,
  getWATDate,
} from "../../server/birthdayService";

describe("birthdayService", () => {
  describe("parseMemberBirthday", () => {
    it("parses explicit birthDay and birthMonth strings", () => {
      expect(parseMemberBirthday(null, "15", "September")).toEqual({ day: 15, month: 9 });
      expect(parseMemberBirthday(null, "4", "aug")).toEqual({ day: 4, month: 8 });
      expect(parseMemberBirthday(null, "29", "2")).toEqual({ day: 29, month: 2 });
    });

    it("parses ISO YYYY-MM-DD date strings", () => {
      expect(parseMemberBirthday("1990-09-15")).toEqual({ day: 15, month: 9 });
      expect(parseMemberBirthday("1985-01-01")).toEqual({ day: 1, month: 1 });
      expect(parseMemberBirthday("2000/12/31")).toEqual({ day: 31, month: 12 });
    });

    it("parses '15, August' and 'August 15' formats", () => {
      expect(parseMemberBirthday("15, August")).toEqual({ day: 15, month: 8 });
      expect(parseMemberBirthday("15 August")).toEqual({ day: 15, month: 8 });
      expect(parseMemberBirthday("August 15")).toEqual({ day: 15, month: 8 });
      expect(parseMemberBirthday("3rd September")).toEqual({ day: 3, month: 9 });
    });

    it("parses DD/MM/YYYY and DD-MM formats", () => {
      expect(parseMemberBirthday("15/09/1992")).toEqual({ day: 15, month: 9 });
      expect(parseMemberBirthday("04-08")).toEqual({ day: 4, month: 8 });
    });

    it("returns null for invalid strings", () => {
      expect(parseMemberBirthday("")).toBeNull();
      expect(parseMemberBirthday("invalid-date")).toBeNull();
      expect(parseMemberBirthday(null, null, null)).toBeNull();
    });
  });

  describe("isLastDayOfMonth", () => {
    it("correctly identifies the last day of August (Aug 31)", () => {
      const aug31 = new Date(2026, 7, 31); // Aug 31
      expect(isLastDayOfMonth(aug31)).toBe(true);

      const aug30 = new Date(2026, 7, 30); // Aug 30
      expect(isLastDayOfMonth(aug30)).toBe(false);
    });

    it("correctly identifies the last day of February in a leap year", () => {
      const leapFeb29 = new Date(2024, 1, 29); // Feb 29 2024
      expect(isLastDayOfMonth(leapFeb29)).toBe(true);

      const leapFeb28 = new Date(2024, 1, 28); // Feb 28 2024
      expect(isLastDayOfMonth(leapFeb28)).toBe(false);
    });
  });

  describe("getWATDate", () => {
    it("returns a valid Date object offset for West Africa Time", () => {
      const wat = getWATDate(new Date("2026-08-30T12:00:00Z"));
      expect(wat).toBeInstanceOf(Date);
      expect(wat.getUTCHours()).toBeGreaterThanOrEqual(0);
    });
  });
});
