import { describe, it, expect } from "vitest";
import { ALL_115_UNITY_SCHOOLS, UNITY_SCHOOLS_LIST, UNITY_SCHOOLS_COUNT } from "./unitySchools";

describe("Unity Schools Canonical List", () => {
  it("should contain exactly 115 Federal Unity Colleges as of 2026", () => {
    expect(ALL_115_UNITY_SCHOOLS.length).toBe(115);
    expect(UNITY_SCHOOLS_LIST.length).toBe(115);
    expect(UNITY_SCHOOLS_COUNT).toBe(115);
  });

  it("should have unique IDs and unique school names", () => {
    const ids = new Set(ALL_115_UNITY_SCHOOLS.map((s) => s.id));
    expect(ids.size).toBe(115);

    const names = new Set(ALL_115_UNITY_SCHOOLS.map((s) => s.name));
    expect(names.size).toBe(115);

    const shortNames = new Set(ALL_115_UNITY_SCHOOLS.map((s) => s.shortName));
    expect(shortNames.size).toBe(115);
  });

  it("should cover all 6 geopolitical zones", () => {
    const zones = new Set(ALL_115_UNITY_SCHOOLS.map((s) => s.zone));
    expect(zones.size).toBe(6);
    expect(zones.has("North-Central")).toBe(true);
    expect(zones.has("North-East")).toBe(true);
    expect(zones.has("North-West")).toBe(true);
    expect(zones.has("South-East")).toBe(true);
    expect(zones.has("South-South")).toBe(true);
    expect(zones.has("South-West")).toBe(true);
  });
});
