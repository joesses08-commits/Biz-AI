import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ connected: false });

    const headers = { Authorization: `Bearer ${conn.access_token}` };

    const [meRes, mailRes, driveRes, eventsRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/messages?$top=5", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/children?$top=5", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/events?$top=5", { headers }),
    ]);

    const [me, mail, drive, events] = await Promise.all([
      meRes.json(), mailRes.json(), driveRes.json(), eventsRes.json()
    ]);

    return NextResponse.json({
      me_error: me.error || null,
      me_email: me.mail || me.userPrincipalName,
      mail_error: mail.error || null,
      mail_count: mail.value?.length,
      drive_error: drive.error || null,
      drive_count: drive.value?.length,
      drive_files: drive.value?.map((f: any) => f.name),
      events_error: events.error || null,
      events_count: events.value?.length,
      token_expiry: conn.token_expiry,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
