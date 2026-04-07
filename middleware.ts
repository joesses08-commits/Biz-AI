import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Check if designer — redirect to PLM instead of dashboard
    const { data: profile } = await supabaseAdmin.from("profiles").select("is_designer").eq("id", user.id).single();
    if (profile?.is_designer) {
      return NextResponse.redirect(new URL("/plm", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Restrict designers to allowed routes only
  if (user) {
    const { data: profile } = await supabaseAdmin.from("profiles").select("is_designer").eq("id", user.id).single();
    if (profile?.is_designer) {
      const allowedPaths = ["/plm", "/workflows", "/settings"];
      const isAllowed = allowedPaths.some(p => request.nextUrl.pathname.startsWith(p));
      if (!isAllowed) {
        return NextResponse.redirect(new URL("/plm", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
