# PR2B: Prompt Quality Research Summary

> Internal reference for prompt tuning. Not for end users.

## Sources

| Source | URL | Type |
|--------|-----|------|
| LinkedIn Official Blog | https://www.linkedin.com/business/talent/blog/product-tips/linkedin-profile-tips | Official |
| LinkedIn Help - Profile Best Practices | https://www.linkedin.com/help/linkedin/answer/a522735 | Official |
| Austin Belcak (Cultivated Culture) | https://cultivatedculture.com/linkedin-profile-tips/ | Practitioner |
| Madeline Mann (Self Made Millennial) | https://www.youtube.com/@SelfMadeMillennial | Practitioner |
| Jeff Su | https://www.youtube.com/@JeffSu | Practitioner |
| Harvard OCS Resume Guide | https://ocs.fas.harvard.edu/resumes-cvs-cover-letters | Academic |
| MIT CAPD Resume Guide | https://capd.mit.edu/resources/resume-guide/ | Academic |
| Ladders Eye Tracking Study | https://www.theladders.com/career-advice/you-only-get-6-seconds-of-fame-make-it-count | Research |
| Richard van der Blom LinkedIn Report | https://www.yourleadmagnet.com/linkedin-algorithm-report | Data-backed |

---

## Top 10 Principles

1. **Specificity over generality**: Every piece of feedback must reference the user's actual text, not generic templates.
2. **Section-aware evaluation**: Headline, About, Experience, Skills, Education each have different best-practice criteria.
3. **Objective-driven framing**: Growth mode (visibility, thought leadership, network) vs Job mode (ATS, recruiter match, keyword density) require fundamentally different optimization.
4. **Accomplishments over duties**: "Led X, resulting in Y" beats "Responsible for X" every time. Detect duty-language patterns.
5. **Quantification is king**: Bullets without metrics are dramatically weaker. Flag unquantified achievements.
6. **First impressions dominate**: Headline and first 300 chars of About are the most-viewed. Weight scoring accordingly.
7. **Authentic human voice**: Rewrites must sound like the person wrote them, not like AI. Avoid corporate jargon and buzzword stacking.
8. **Actionable = WHAT + WHY + HOW**: Suggestions that say "improve your headline" are useless. Say what is wrong, why it hurts, and give a specific formula or rewrite.
9. **Prioritize impact**: Not all fixes are equal. Missing metrics in Experience > missing volunteer section. Signal priority.
10. **Platform-specific guidance**: LinkedIn and CV/resume have different norms (tone, length, media, keyword strategy). Never conflate them.

---

## Section-Specific Do/Don't

### Headline (LinkedIn)
| DO | DON'T |
|----|-------|
| Include target job title verbatim (for recruiter search) | Use only default "Title at Company" |
| Add value proposition: who you help + what result | Stack buzzwords: "Passionate \| Driven \| Innovative" |
| Include 1-2 hard skills or specializations | Use humor that obscures what you do |
| Use \| as separator for scannability | Exceed 220 chars |

### About / Summary
| DO | DON'T |
|----|-------|
| Hook in first 2 lines (visible before "see more") | Write in third person |
| Use first-person, conversational-but-professional tone | Open with "Results-driven professional" |
| Include 3-5 quantified achievements as bullets | Wall of text with no formatting |
| End with clear CTA (what you're looking for / how to reach you) | Leave section empty |
| Weave in keywords naturally | Stuff keywords artificially |

### Experience
| DO | DON'T |
|----|-------|
| Lead every bullet with a strong action verb | Start with "Responsible for" |
| Use CAR formula: Challenge-Action-Result | List duties without outcomes |
| Quantify: revenue, %, team size, users, timeline | Leave numbers vague ("improved efficiency") |
| Include scope: budget, team size, geography | Copy-paste job description |
| Show progression across roles | Include irrelevant roles from 15+ years ago |

### Skills
| DO | DON'T |
|----|-------|
| Fill all 50 slots on LinkedIn | Leave at default 5 |
| Pin top 3 aligned with target role | Pin most-endorsed (may be outdated) |
| Match exact terms from target job postings | Use creative synonyms ATS won't match |
| Seek endorsements from senior contacts | Ignore endorsement strategy |

### Education
| DO | DON'T |
|----|-------|
| Include relevant coursework, honors, GPA if strong (>3.5, <5 yrs) | Over-detail education if 10+ years experience |
| List certifications separately | Mix certifications with degree education |
| Highlight projects relevant to target role | Include high school if you have a degree |

### CV-Specific
| DO | DON'T |
|----|-------|
| Use standard section headings (Experience, Education, Skills) | Creative headings ATS can't parse |
| ATS-safe formatting (no tables/columns/text boxes) | Two-column layouts |
| 1 page for <10 years, 2 pages for 10-20 years | 3+ pages unless academic CV |
| Tailor to each application | One-size-fits-all resume |

---

## Growth Mode vs Job Mode Differences

| Dimension | Growth Mode | Job Mode |
|-----------|-------------|----------|
| **Headline** | Domain expertise + thought leadership | Exact target job title + key technical skills |
| **About** | Professional philosophy, what you bring | Target role, "currently exploring", loaded with keywords |
| **Experience framing** | Breadth of impact, leadership, innovation | Specific role-relevant accomplishments |
| **Keywords** | Broad industry terms | Exact-match terms from job postings |
| **Activity emphasis** | Content creation, engagement signals | Targeted outreach to hiring managers |
| **Scoring weight** | Visibility, personal brand strength | ATS compatibility, keyword match rate |
| **Suggestions tone** | "To increase your visibility..." | "To improve recruiter match rate..." |
| **Missing items** | Featured content, recommendations, posts | Open-to-work signal, target role keywords, certifications |

---

## Feedback Quality Framework

Each piece of feedback should follow:

```
1. WHAT: Name the specific element (e.g., "Your 2nd experience bullet")
2. ISSUE: Name the anti-pattern (e.g., "starts with 'Responsible for'")
3. WHY: Impact on the reader (e.g., "recruiters skip duty-language bullets")
4. HOW: Specific fix formula (e.g., "Start with: [Action verb] + [what] + [metric]")
5. PRIORITY: High / Medium / Low
```

### Anti-patterns to detect automatically:
- `"Responsible for"` → duty-language
- `"Results-driven"` / `"passionate"` / `"innovative"` without proof → buzzword stacking
- No numbers in experience bullets → unquantified
- Default LinkedIn headline (Title at Company) → default-headline
- Third-person About section → wrong-voice
- Empty sections → missing-section
- Skills < 10 on LinkedIn → underutilized-skills
