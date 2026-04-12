import { describe, it, expect } from "vitest";
import {
  scrapeLinkedinRequestSchema,
  harvestProfileSchema,
} from "@/lib/schemas/linkedin-profile";

describe("scrapeLinkedinRequestSchema", () => {
  it("Test 1: accepts a canonical linkedin.com/in/<handle> URL", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://linkedin.com/in/someuser",
    });
    expect(result.success).toBe(true);
  });

  it("Test 2: accepts trailing-slash URL", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://linkedin.com/in/someuser/",
    });
    expect(result.success).toBe(true);
  });

  it("Test 3: accepts URL with query params (normalization strips them later)", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://linkedin.com/in/user?trk=abc",
    });
    expect(result.success).toBe(true);
  });

  it("Test 4: rejects non-linkedin host (SSRF protection)", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://google.com/in/user",
    });
    expect(result.success).toBe(false);
  });

  it("Test 5: rejects data: URI (SSRF protection)", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "data:text/html,<script>alert(1)</script>",
    });
    expect(result.success).toBe(false);
  });

  it("Test 6: rejects javascript: URI", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("Test 7: rejects protocol-relative URL //linkedin.com/in/user", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "//linkedin.com/in/user",
    });
    expect(result.success).toBe(false);
  });

  it("Test 8: rejects non /in/ path (company page)", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://linkedin.com/company/foo",
    });
    expect(result.success).toBe(false);
  });

  it("Test 9: rejects URLs over 500 characters", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "x".repeat(600),
    });
    expect(result.success).toBe(false);
  });

  it("Test 9b: rejects host-spoofing attack evil.com/linkedin.com/in/user", () => {
    // Guard against T-01-04: cache poisoning / host confusion
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://evil.com/linkedin.com/in/user",
    });
    expect(result.success).toBe(false);
  });

  it("emits i18n key 'apify.error.invalidUrl' on validation failure", () => {
    const result = scrapeLinkedinRequestSchema.safeParse({
      url: "https://google.com/in/user",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("apify.error.invalidUrl");
    }
  });
});

describe("harvestProfileSchema", () => {
  it("Test 10: accepts a minimal profile shape", () => {
    const result = harvestProfileSchema.safeParse({
      headline: "Engineer",
      about: "About text",
      experience: [],
    });
    expect(result.success).toBe(true);
  });

  it("Test 11: accepts an empty object (all fields optional — drift tolerance)", () => {
    const result = harvestProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("Test 12: preserves unknown fields via passthrough", () => {
    const parsed = harvestProfileSchema.parse({
      headline: "Engineer",
      unknownField: "x",
    }) as { unknownField?: string };
    expect(parsed.unknownField).toBe("x");
  });
});
