import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const publicPaths = [
    "/", "/login", "/reset-password", "/auth", "/privacy", "/terms", "/portal", "/reset-pin",
    "/api/gmail/connect", "/api/gmail/callback", "/api/gmail/push", "/api/gmail/sync",
    "/api/microsoft/connect", "/api/microsoft/callback", "/api/microsoft/sync", "/api/microsoft/files", "/api/microsoft/push",
    "/api/quickbooks/connect", "/api/quickbooks/callback", "/api/quickbooks/sync",
    "/api/google/sync", "/api/stripe/connect", "/api/stripe/callback",
    "/api/briefing", "/api/webhook", "/api/events/process", "/api/events/snapshot",
    "/api/workflows/factory-quote", "/api/plm", "/api/portal", "/api/warehouse",
  ];

  const isPublic = publicPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/") || request.nextUrl.pathname.startsWith(path)
  );
  // Subdomain routing
  const host = request.headers.get("host") || "";
  if (host.startsWith("portal.") || host.startsWith("factory.") || host.startsWith("warehouse.")) {
    if (request.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }
  if (host.startsWith("team.")) {
    if (request.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  if (isPublic) return NextResponse.next();

  // Check session age — force logout after 8 hours
  const sessionCreated = request.cookies.get("session_created")?.value;
  const now = Date.now();
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  if (sessionCreated && now - parseInt(sessionCreated) > EIGHT_HOURS) {
    const logoutUrl = new URL("/login?reason=timeout", request.url);
    const res = NextResponse.redirect(logoutUrl);
    res.cookies.delete("session_created");
    return res;
  }

  let response = NextResponse.next({ request: { headers: request.headers } });
  if (!sessionCreated) {
    response.cookies.set("session_created", String(now), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    });
  }

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
