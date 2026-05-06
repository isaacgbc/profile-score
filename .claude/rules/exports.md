---
paths:
  - "src/lib/services/export-generator.ts"
  - "src/app/api/exports/**"
  - "src/components/checkout/**"
  - "src/components/studio/ExportPanel*"
---
# Export System Rules

- 5 export modules: results-summary, full-audit, updated-cv, cover-letter, linkedin-updates.
- Plan gating is in `src/lib/services/export-gating.ts`. Starter gets results-summary only. Recommended gets all 5.
- Export pipeline: polish pass (Haiku refinement) → sanitize → generate PDF/DOCX → upload to Supabase Storage → return signed URL.
- PDF generation uses pdf-lib. DOCX generation uses docx package.
- Polish pass failures degrade gracefully: emoji-stripped raw text is used instead.
- Export records are persisted in the Export model with status tracking (pending → completed → failed).
- Signed URLs from Supabase Storage have expiry. Don't cache them indefinitely.
