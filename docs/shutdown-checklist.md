# ProfileScore Shutdown Checklist — Pause Costs, Keep Code

## 1. Supabase — Pause Project
Dashboard → Settings → General → Pause project
- Database goes offline, no reads/writes
- Data is PRESERVED (not deleted)
- Can unpause anytime (takes ~2 min to restore)
- Free for 90 days paused, after that Supabase may delete

## 2. Vercel — No action needed
- Hobby plan is free
- Deployments stay, but with Supabase paused the app will error on DB calls
- Optional: Settings → General → "Pause Project" if you want zero traffic

## 3. Apify — Disable
- Remove `APIFY_ENABLED=true` from Vercel env vars (set to `false`)
- Or just leave it — no cost unless scrapes are triggered
- Optional: revoke API token in Apify console to prevent accidental use

## 4. Anthropic API — No action needed
- Only charges per API call, no base cost
- With Supabase paused, no generations will run anyway

## 5. Creala — No action needed
- No base cost, only transaction fees
- Webhooks will fail (Supabase down) but that's fine when paused

## 6. Domain/DNS — Check
- If you have a custom domain, keep DNS active (cheap/free)
- Don't let the domain expire

## To Reactivate Later
1. Supabase: Dashboard → Unpause (2 min)
2. Run: `npx prisma db push` (verify schema is synced)
3. Verify: `curl https://profilescore.io/api/health`
4. Set `APIFY_ENABLED=true` in Vercel if needed
5. Test one generation end-to-end
