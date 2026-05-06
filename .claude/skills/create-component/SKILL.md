---
name: create-component
description: Scaffolds a new React component with proper i18n, CSS variables, and project patterns. Use when creating new UI components, new page sections, or new interactive features. Also use when adding new pages to the app.
argument-hint: <component-name> e.g. "UserDashboard" or "ScoreShareCard"
allowed-tools: Read, Write, Edit, Bash(grep:*), Bash(find:*)
---

# Create Component

When creating component `$ARGUMENTS`:

## Steps

1. **Determine placement** based on component type:
   - Primitive/reusable UI → `src/components/ui/`
   - Layout/structure → `src/components/layout/`
   - Landing page section → `src/components/landing/`
   - Input/data entry → `src/components/input/`
   - Results display → `src/components/results/`
   - Rewrite studio → `src/components/studio/`
   - Checkout/payment → `src/components/checkout/`
   - Blog → `src/components/blog/`
   - Admin → `src/components/admin/`
   - Feedback → `src/components/feedback/`

2. **Read similar existing components** in the target directory for patterns.

3. **Create component file** (`$ARGUMENTS.tsx`):
   - Server Component by default (no `"use client"` unless needed)
   - Named export only: `export function $ARGUMENTS() {}`
   - Use CSS variables for colors: `var(--accent)`, `var(--surface-primary)`, `var(--text-primary)`, etc.
   - NEVER use raw Tailwind color classes like `bg-blue-500`

4. **If interactive (needs `"use client"`):**
   - Import hooks from React: `import { useState } from "react"`
   - Use AppContext methods for state: `const { generateResults, ... } = useApp()`
   - Use I18nContext for text: `const { t } = useI18n()`

5. **Add i18n strings:**
   - Add ALL user-facing strings to `src/lib/i18n/en.json`
   - Add ALL user-facing strings to `src/lib/i18n/es.json`
   - Use the `t.sectionName.keyName` pattern matching existing keys

6. **Verify:** Run `npm run build` to confirm no type errors.
