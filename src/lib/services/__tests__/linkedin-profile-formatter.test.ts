import { describe, it, expect } from "vitest";
import {
  profileToSectionRecord,
  profileToMarkdown,
} from "@/lib/services/linkedin-profile-formatter";
import type { HarvestProfile } from "@/lib/schemas/linkedin-profile";

// Fixtures: real Apify probe data (Bill Gates) and synthetic minimal profile
import sampleData from "./fixtures/apify-profile-sample.json";
import minimalData from "./fixtures/apify-profile-minimal.json";

// The fixture files are arrays (dataset response format); use index 0.
const sampleProfile = sampleData[0] as unknown as HarvestProfile;
const minimalProfile = minimalData[0] as unknown as HarvestProfile;

describe("profileToSectionRecord", () => {
  it("Test 1: returns an object with at least `headline` and `experience` keys", () => {
    const result = profileToSectionRecord(sampleProfile);
    expect(result).toHaveProperty("headline");
    expect(result).toHaveProperty("experience");
  });

  it("Test 2: headline equals sampleProfile.headline trimmed (non-empty)", () => {
    const result = profileToSectionRecord(sampleProfile);
    expect(result.headline).toBe(sampleProfile.headline!.trim());
    expect(result.headline!.length).toBeGreaterThan(0);
  });

  it("Test 3: summary equals sampleProfile.about trimmed when about is present", () => {
    const result = profileToSectionRecord(sampleProfile);
    expect(result.summary).toBe(sampleProfile.about!.trim());
  });

  it("Test 4: experience contains each experience entry's title and company in order", () => {
    const result = profileToSectionRecord(sampleProfile);
    const exp = result.experience!;
    for (const entry of sampleProfile.experience!) {
      const title = (
        ((entry as Record<string, unknown>).position as string) ??
        ((entry as Record<string, unknown>).title as string) ??
        ""
      ).trim();
      const company = (
        ((entry as Record<string, unknown>).company as string) ??
        ((entry as Record<string, unknown>).companyName as string) ??
        ""
      ).trim();
      if (title) expect(exp).toContain(title);
      if (company) expect(exp).toContain(company);
    }
  });

  it("Test 5: minimal profile has headline and experience only — missing sections are OMITTED, not empty strings", () => {
    const result = profileToSectionRecord(minimalProfile);
    expect(result).toHaveProperty("headline");
    expect(result).toHaveProperty("experience");
    // These sections are not present in the minimal fixture and must be absent
    expect("summary" in result).toBe(false);
    expect("education" in result).toBe(false);
    expect("skills" in result).toBe(false);
    expect("certifications" in result).toBe(false);
    expect("recommendations" in result).toBe(false);
  });

  it("Test 6: skills includes each skill name", () => {
    // Bill Gates sample has empty skills — use a hand-built fixture
    const profileWithSkills: HarvestProfile = {
      headline: "Test",
      skills: [
        { name: "JavaScript", endorsementCount: 42 },
        { name: "TypeScript", endorsementCount: 15 },
      ],
    } as unknown as HarvestProfile;
    const result = profileToSectionRecord(profileWithSkills);
    expect(result.skills).toContain("JavaScript");
    expect(result.skills).toContain("TypeScript");
  });

  it("Test 7: recommendations contains at most the first 3 recommendations (per D-18)", () => {
    const profileWithRecs: HarvestProfile = {
      headline: "Test",
      recommendations: [
        { author: "Alice", text: "Great colleague" },
        { author: "Bob", text: "Amazing leader" },
        { author: "Carol", text: "Top performer" },
        { author: "Dave", text: "This should be excluded" },
        { author: "Eve", text: "Also excluded" },
      ],
    } as unknown as HarvestProfile;
    const result = profileToSectionRecord(profileWithRecs);
    expect(result.recommendations).toContain("Alice");
    expect(result.recommendations).toContain("Bob");
    expect(result.recommendations).toContain("Carol");
    expect(result.recommendations).not.toContain("Dave");
    expect(result.recommendations).not.toContain("Eve");
  });

  it("Test 13: empty profile returns empty object — never throws", () => {
    const result = profileToSectionRecord({} as HarvestProfile);
    expect(result).toEqual({});
  });

  it("Test 14: field drift handling — position/title, company/companyName, dateRange/duration", () => {
    // Uses `position` instead of `title`, `companyName` instead of `company`
    const driftProfile: HarvestProfile = {
      headline: "Drift Test",
      experience: [
        {
          position: "Engineer",
          companyName: "FooCorp",
          dateRange: "2020 - 2023",
          description: "Did stuff",
        },
      ],
    } as unknown as HarvestProfile;
    const result = profileToSectionRecord(driftProfile);
    expect(result.experience).toContain("Engineer");
    expect(result.experience).toContain("FooCorp");
    expect(result.experience).toContain("2020 - 2023");

    // Uses `title` instead of `position`, `company` instead of `companyName`, `duration` instead of `dateRange`
    const driftProfile2: HarvestProfile = {
      headline: "Drift Test 2",
      experience: [
        {
          title: "Designer",
          company: "BarInc",
          duration: "2018 - 2020",
          description: "Designed things",
        },
      ],
    } as unknown as HarvestProfile;
    const result2 = profileToSectionRecord(driftProfile2);
    expect(result2.experience).toContain("Designer");
    expect(result2.experience).toContain("BarInc");
    expect(result2.experience).toContain("2018 - 2020");
  });

  it("Test 15: experience entries flattened to '{title} — {company} ({dateRange})\\n{description}' joined by '\\n\\n'", () => {
    const profile: HarvestProfile = {
      headline: "Test",
      experience: [
        {
          position: "Lead",
          companyName: "Alpha",
          dateRange: "2021 - 2023",
          description: "Led the team",
        },
        {
          position: "Dev",
          companyName: "Beta",
          dateRange: "2019 - 2021",
          description: "Wrote code",
        },
      ],
    } as unknown as HarvestProfile;
    const result = profileToSectionRecord(profile);
    const entries = result.experience!.split("\n\n");
    expect(entries.length).toBe(2);
    expect(entries[0]).toContain("Lead");
    expect(entries[0]).toContain("Alpha");
    expect(entries[0]).toContain("2021 - 2023");
    expect(entries[0]).toContain("Led the team");
    expect(entries[1]).toContain("Dev");
    expect(entries[1]).toContain("Beta");
  });
});

describe("profileToMarkdown", () => {
  it("Test 8: starts with '# {headline}'", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md.startsWith(`# ${sampleProfile.headline}`)).toBe(true);
  });

  it("Test 9: contains '## About' followed by about text", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md).toContain("## About");
    expect(md).toContain(sampleProfile.about!);
  });

  it("Test 10: contains '## Experience' header and '### {title} — {company}' for each entry", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md).toContain("## Experience");
    for (const entry of sampleProfile.experience!) {
      const title = (
        ((entry as Record<string, unknown>).position as string) ??
        ((entry as Record<string, unknown>).title as string) ??
        ""
      ).trim();
      const company = (
        ((entry as Record<string, unknown>).company as string) ??
        ((entry as Record<string, unknown>).companyName as string) ??
        ""
      ).trim();
      if (title && company) {
        expect(md).toContain(`### ${title} — ${company}`);
      }
    }
  });

  it("Test 11: minimal profile does NOT contain '## About' (missing field skipped)", () => {
    const md = profileToMarkdown(minimalProfile);
    expect(md).not.toContain("## About");
  });

  it("Test 12: empty profile returns empty string or just whitespace — never throws", () => {
    const md = profileToMarkdown({} as HarvestProfile);
    expect(md.trim()).toBe("");
  });
});
