---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "src/lib/eval/**"
---
# Testing Conventions

- Test files colocated with source: `ComponentName.test.tsx` next to `ComponentName.tsx`.
- Unit tests for services, schemas, and utilities. Integration tests for API routes.
- Mock LLM responses for orchestrator tests — never make real API calls in tests.
- Use the existing eval harness in `src/lib/eval/` for LLM output quality testing.
- When adding new features, write the test file FIRST with expected behavior, then implement.
- Admin endpoint tests must include auth check (both valid and invalid token scenarios).
- Test i18n: verify both "en" and "es" locale paths produce valid results.
