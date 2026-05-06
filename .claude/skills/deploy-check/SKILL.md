---
name: deploy-check
description: Runs a comprehensive pre-deployment verification checklist before pushing to production. Use before deploying, before committing major changes, or when asked to verify the build is ready for production.
allowed-tools: Read, Bash(npm run build), Bash(npm run lint), Bash(npx tsc --noEmit), Bash(npx prisma generate), Bash(git diff *), Bash(git status), Bash(grep:*)
---

# Pre-Deploy Verification

## Checklist (run in order, stop on first failure)

1. **Prisma client is current:**
   ```bash
   npx prisma generate
   ```

2. **TypeScript compiles clean:**
   ```bash
   npx tsc --noEmit
   ```

3. **ESLint passes:**
   ```bash
   npm run lint
   ```

4. **Full build succeeds:**
   ```bash
   npm run build
   ```

5. **i18n completeness check:**
   ```bash
   node -e "const en=require('./src/lib/i18n/en.json');const es=require('./src/lib/i18n/es.json');console.log('EN keys:',Object.keys(en).length,'ES keys:',Object.keys(es).length);if(Object.keys(en).length!==Object.keys(es).length)console.log('WARNING: i18n key mismatch!')"
   ```

6. **No .env secrets in code:**
   ```bash
   grep -r "ANTHROPIC_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|ADMIN_SECRET\|CREALA_WEBHOOK_SECRET" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env" | grep -v ".example"
   ```

7. **No console.log left behind:**
   ```bash
   grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "error-logger" | grep -v "node_modules" | head -20
   ```

8. **Git status clean:**
   ```bash
   git status
   git diff --stat
   ```

9. **Report results** to the user with pass/fail for each step.
