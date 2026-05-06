---
paths:
  - "src/components/**"
  - "src/app/**/page.tsx"
---
# Component & UI Conventions

- Server Components by default. Only add `"use client"` when the component needs interactivity (useState, useEffect, onClick, etc.).
- CSS uses custom design system variables, NOT raw Tailwind colors. Use: `var(--accent)`, `var(--surface-primary)`, `var(--surface-secondary)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--border-primary)`, `var(--border-subtle)`.
- Named exports only (no default exports except page.tsx files which Next.js requires).
- Component file naming: PascalCase (e.g., `ScoreCard.tsx`, `RewriteEditor.tsx`).
- All user-facing text must use `t()` from `I18nContext`. Add keys to BOTH `en.json` and `es.json` in `src/lib/i18n/`.
- AppContext (`src/context/AppContext.tsx`, 1,171 lines) is the central state. Use its methods (`generateResults`, `regenerateSection`, `setUserOptimized`, `resetSection`) rather than duplicating logic.
- Icons come from the shared `Icons` component in `src/components/ui/`.
- BrandLogo component for all logo usage — never inline SVGs.
- Follow the existing component directory structure: ui/ (primitives), layout/ (structure), landing/ (marketing), input/ (data entry), results/ (scores), studio/ (editing), checkout/ (payment), blog/ (content), admin/ (management), feedback/ (user feedback).
