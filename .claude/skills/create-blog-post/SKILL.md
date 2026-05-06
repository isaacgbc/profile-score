---
name: create-blog-post
description: Creates a new bilingual (EN/ES) blog post for ProfileScore.io. Use when writing blog content, SEO articles, LinkedIn optimization guides, or CV tips targeting the LATAM Spanish-speaking market.
argument-hint: <topic> e.g. "How to optimize your LinkedIn headline in 2026"
allowed-tools: Read, Write, Edit, Bash(grep:*), Bash(curl:*)
---

# Create Blog Post

When creating a blog post about `$ARGUMENTS`:

## Steps

1. **Read existing blog posts** for format and quality baseline:
   - Read `src/lib/blog/posts.ts` for content patterns
   - Read `prisma/schema.prisma` for the BlogPost model fields
   - Read `src/app/blog/[slug]/page.tsx` for how posts render

2. **Generate the slug** from the English title:
   - Lowercase, hyphens, no special chars: `how-to-optimize-linkedin-headline-2026`

3. **Write the post** with these requirements:
   - **English version**: title, content (markdown), metaDescription, excerpt
   - **Spanish version**: titleEs, contentEs, metaDescriptionEs, excerptEs
   - Content must be SEO-optimized: target long-tail keywords relevant to LinkedIn/CV optimization
   - Include internal links to ProfileScore features (`/features`, `/pricing`)
   - Include a CTA: "Try ProfileScore free" or similar
   - Tags array for categorization

4. **SEO checklist:**
   - Title: 50-60 chars, keyword-rich
   - Meta description: 150-160 chars
   - H2/H3 headers with keywords
   - "Last updated" date for GEO freshness signal

5. **Create via admin API** or add directly to the BlogPost table via Prisma Studio.

6. **Verify:** Check that the post renders at `/blog/<slug>` in both locales.
