import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const publicPaths = [
    "/login", "/reset-password", "/auth", "/privacy", "/terms", "/portal", "/reset-pin",
    "/api/gmail/connect", "/api/gmail/callback", "/api/gmail/push", "/api/gmail/sync",
    "/api/microsoft/connect", "/api/microsoft/callback", "/api/microsoft/sync", "/api/microsoft/files", "/api/microsoft/push",
    "/api/quickbooks/connect", "/api/quickbooks/callback", "/api/quickbooks/sync",
    "/api/google/sync", "/api/stripe/connect", "/api/stripe/callback",
    "/api/briefing", "/api/webhook", "/api/events/process", "/api/events/snapshot",
    "/api/workflows/factory-quote", "/api/plm", "/api/portal",
  ];

  const isPublic = publicPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/") || request.nextUrl.pathname.startsWith(path)
  );
  if (isPublic) return NextResponse.next();

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
