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
    if (!user) return NextResponse.json({ error: "Not authenticated", note: "No user session" }, { status: 401 });

    const { data: conn } = await supabase.from("microsoft_connections").select("*").eq("user_id", user.id).single();
    if (!conn) return NextResponse.json({ error: "No Microsoft connection found", user_id: user.id });

    const headers = { Authorization: `Bearer ${conn.access_token}` };

    const [meRes, mailRes, driveRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/messages?$top=3", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/children?$top=5", { headers }),
    ]);

    const [me, mail, drive] = await Promise.all([meRes.json(), mailRes.json(), driveRes.json()]);

    return NextResponse.json({
      bizai_user_id: user.id,
      connection_user_id: conn.user_id,
      token_preview: conn.access_token?.slice(0, 50),
      me_result: me.error || { email: me.mail || me.userPrincipalName, name: me.displayName },
      mail_result: mail.error || { count: mail.value?.length },
      drive_result: drive.error || { count: drive.value?.length, files: drive.value?.map((f: any) => f.name) },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
