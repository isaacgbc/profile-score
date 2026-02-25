/**
 * Next.js middleware — refreshes Supabase session on every request.
 *
 * CRITICAL CONSTRAINT: NO hard-gating on existing pages.
 * All pages stay fully accessible without login:
 *   - /, /input, /features, /pricing — free funnel
 *   - /results, /rewrite-studio — free preview + paid content
 *   - /checkout — payment flow
 *
 * Only redirect to /auth/login on subscriber-private pages:
 *   - /account, /saved-audits (future pages)
 *
 * All /api/*, /admin/*, /auth/* routes: pass through, no blocking.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that REQUIRE authentication (subscriber-private)
const AUTH_REQUIRED_ROUTES = ["/account", "/saved-audits"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (keeps cookies fresh)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only redirect on AUTH_REQUIRED_ROUTES (not existing pages)
  const pathname = request.nextUrl.pathname;
  const isAuthRequired = AUTH_REQUIRED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isAuthRequired && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
