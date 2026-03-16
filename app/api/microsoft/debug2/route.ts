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

    const [recentRes, myFilesRes, searchRes] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me/drive/recent?$top=25", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root:/My Files:/children?$top=50", { headers }),
      fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='Book')?$top=25", { headers }),
    ]);

    const [recent, myFiles, search] = await Promise.all([
      recentRes.json(), myFilesRes.json(), searchRes.json()
    ]);

    return NextResponse.json({
      recent_count: recent.value?.length,
      recent_files: recent.value?.map((f: any) => f.name),
      recent_error: recent.error || null,
      myfiles_count: myFiles.value?.length,
      myfiles_files: myFiles.value?.map((f: any) => f.name),
      myfiles_error: myFiles.error || null,
      search_count: search.value?.length,
      search_files: search.value?.map((f: any) => f.name),
      search_error: search.error || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
