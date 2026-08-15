import { describe, it, expect, vi } from "vitest";
import { Logger, createLogger, logger } from "../lib/logger";

describe("Logger", () => {
  it("does not log below threshold", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const l = new Logger("Test", "warn");
    l.debug("should not appear");
    l.info("should not appear");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs warn and error above threshold", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const l = new Logger("Test", "warn");
    l.warn("a warning");
    l.error("an error", new Error("boom"));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("includes prefix in output", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const l = new Logger("MyPrefix", "info");
    l.info("hello");
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain("[MyPrefix]");
    expect(output).toContain("hello");
    spy.mockRestore();
  });

  it("includes timestamp", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const l = new Logger("", "info");
    l.info("msg");
    const output = spy.mock.calls[0][0] as string;
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    spy.mockRestore();
  });

  it("serializes Error objects", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const l = new Logger("", "error");
    const err = new Error("fail");
    l.error("failed", err);
    const output = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.error.message).toBe("fail");
    expect(parsed.error.name).toBe("Error");
    spy.mockRestore();
  });

  it("createLogger returns a new instance", () => {
    const l1 = createLogger("A");
    const l2 = createLogger("B");
    expect(l1).toBeInstanceOf(Logger);
    expect(l2).toBeInstanceOf(Logger);
    expect(l1).not.toBe(l2);
  });
});
