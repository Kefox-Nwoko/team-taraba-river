import { describe, expect, it } from "vitest";
import { driveSessionOriginHeader } from "../../server/mediaPipeline";

describe("driveSessionOriginHeader", () => {
  it("passes a browser origin through so Drive allows the page to read the upload reply", () => {
    expect(driveSessionOriginHeader("https://team-taraba-river.web.app")).toEqual({ Origin: "https://team-taraba-river.web.app" });
    expect(driveSessionOriginHeader("http://localhost:3001")).toEqual({ Origin: "http://localhost:3001" });
  });

  it("sends nothing for a missing or malformed origin", () => {
    expect(driveSessionOriginHeader(undefined)).toEqual({});
    expect(driveSessionOriginHeader("")).toEqual({});
    expect(driveSessionOriginHeader("null")).toEqual({});
    expect(driveSessionOriginHeader("https://evil.example/path")).toEqual({});
    expect(driveSessionOriginHeader(["https://a.example"])).toEqual({});
  });
});
