-- ============================================================
-- Phase 4.2 Security: Enable RLS on all public tables
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
--
-- WHY: NEXT_PUBLIC_SUPABASE_ANON_KEY is exposed client-side.
-- Without RLS, anyone can read/write all tables via PostgREST.
--
-- HOW IT WORKS:
-- - Prisma uses SUPABASE_SERVICE_ROLE_KEY (server-side only)
-- - service_role bypasses RLS by design → NO Prisma operations affected
-- - Supabase Auth uses the auth schema → NOT affected by public RLS
-- - Anon key holders get NOTHING from PostgREST after this runs
-- ============================================================

-- ── Enable RLS on all public tables ──────────────────────────

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_registry    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts         ENABLE ROW LEVEL SECURITY;

-- ── Service role policies (Prisma server-side access) ────────
-- service_role key bypasses RLS, but explicit policies are best practice.
-- Anon/authenticated users get NO access unless a policy grants it.

CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.audits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.exports
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.prompt_registry
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.generation_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.analytics_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.error_logs
  FOR ALL USING (auth.role() = 'service_role');

-- ── Blog posts: service_role full access + public read ───────
-- Blog content is public — anon users may read published posts.

CREATE POLICY "Service role full access" ON public.blog_posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read blog posts" ON public.blog_posts
  FOR SELECT USING (true);

-- ============================================================
-- VERIFY after running:
--   Database → Linter → confirm all RLS warnings resolved
-- ============================================================

-- ── FUTURE (Phase 3.1 user dashboards) ───────────────────────
-- Uncomment when user-owned data views are implemented:
--
-- CREATE POLICY "Users read own audits" ON public.audits
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users read own exports" ON public.exports
--   FOR SELECT USING (audit_id IN (
--     SELECT id FROM public.audits WHERE user_id = auth.uid()
--   ));
-- ============================================================
