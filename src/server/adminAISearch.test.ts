import { describe, it, expect } from "vitest";
import { AdminAISearchSchema, validateBody } from "../../server/validation";

describe("AdminAISearchSchema", () => {
  it("accepts valid query", () => {
    const result = validateBody(AdminAISearchSchema, { query: "August birthdays" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = validateBody(AdminAISearchSchema, { query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing query", () => {
    const result = validateBody(AdminAISearchSchema, {});
    expect(result.success).toBe(false);
  });

  it("rejects query that is too long", () => {
    const result = validateBody(AdminAISearchSchema, { query: "a".repeat(501) });
    expect(result.success).toBe(false);
  });
});
