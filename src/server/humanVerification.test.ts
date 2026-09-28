import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/config", () => ({ config: { turnstileSecretKey: "test-secret" } }));

import { isHumanVerificationConfigured, verifyHuman } from "../../server/humanVerification";

const mockFetch = (impl: (...args: any[]) => any) => vi.stubGlobal("fetch", vi.fn(impl));

afterEach(() => vi.unstubAllGlobals());

describe("verifyHuman", () => {
  it("is configured when a secret is set", () => {
    expect(isHumanVerificationConfigured()).toBe(true);
  });

  it("rejects a missing, empty, non-string or oversized token without calling Cloudflare", async () => {
    mockFetch(() => { throw new Error("should not be called"); });
    expect(await verifyHuman(undefined)).toBe(false);
    expect(await verifyHuman("")).toBe(false);
    expect(await verifyHuman(12345)).toBe(false);
    expect(await verifyHuman("x".repeat(3000))).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts a token Cloudflare marks successful, sending secret, token and client IP", async () => {
    mockFetch(async () => ({ json: async () => ({ success: true }) }));
    expect(await verifyHuman("tok", "1.2.3.4")).toBe(true);
    const body = (fetch as any).mock.calls[0][1].body as URLSearchParams;
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("rejects a token Cloudflare marks unsuccessful", async () => {
    mockFetch(async () => ({ json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) }));
    expect(await verifyHuman("tok")).toBe(false);
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    mockFetch(async () => { throw new Error("network down"); });
    expect(await verifyHuman("tok")).toBe(false);
  });
});
