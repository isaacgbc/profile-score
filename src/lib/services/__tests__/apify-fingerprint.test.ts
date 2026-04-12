import { describe, it, expect, beforeEach } from "vitest";
import { computeFingerprint } from "../apify-fingerprint";

describe("computeFingerprint", () => {
  beforeEach(() => {
    delete process.env.APIFY_FINGERPRINT_SALT;
  });

  it("returns a 64-char hex string", () => {
    const result = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs produce the same hash", () => {
    const a = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    const b = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    expect(a).toBe(b);
  });

  it("produces different hashes for different IPs", () => {
    const a = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    const b = computeFingerprint("5.6.7.8", "Mozilla/5.0");
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different user agents", () => {
    const a = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    const b = computeFingerprint("1.2.3.4", "Chrome/120");
    expect(a).not.toBe(b);
  });

  it("produces a valid hash when user agent is null", () => {
    const result = computeFingerprint("1.2.3.4", null);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a valid hash when user agent is undefined", () => {
    const result = computeFingerprint("1.2.3.4", undefined);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    // null and undefined should produce the same hash (both coerce to "")
    const fromNull = computeFingerprint("1.2.3.4", null);
    expect(result).toBe(fromNull);
  });

  it("produces different hashes when APIFY_FINGERPRINT_SALT changes", () => {
    process.env.APIFY_FINGERPRINT_SALT = "salt-one";
    const a = computeFingerprint("1.2.3.4", "Mozilla/5.0");

    process.env.APIFY_FINGERPRINT_SALT = "salt-two";
    const b = computeFingerprint("1.2.3.4", "Mozilla/5.0");

    expect(a).not.toBe(b);
  });

  it("uses default salt fallback when env var is not set", () => {
    // env var already deleted in beforeEach
    const result = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    // Should be deterministic with default salt
    const again = computeFingerprint("1.2.3.4", "Mozilla/5.0");
    expect(result).toBe(again);
  });
});
