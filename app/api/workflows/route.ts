import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: pending }, { data: userWorkflows }, { data: history }] = await Promise.all([
      supabaseAdmin.from("pending_actions").select("*").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_workflows").select("*").eq("user_id", user.id),
      supabaseAdmin.from("pending_actions").select("*").eq("user_id", user.id).neq("status", "pending").order("created_at", { ascending: false }).limit(20),
    ]);

    return NextResponse.json({
      pending: pending || [],
      userWorkflows: userWorkflows || [],
      history: history || [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, actionId, workflowType, enabled, settings } = await req.json();

    if (action === "approve" || action === "reject") {
      const { data: pendingAction } = await supabaseAdmin
        .from("pending_actions").select("*").eq("id", actionId).eq("user_id", user.id).single();
      if (!pendingAction) return NextResponse.json({ error: "Action not found" }, { status: 404 });

      if (action === "reject") {
        await supabaseAdmin.from("pending_actions").update({ status: "rejected" }).eq("id", actionId);
        return NextResponse.json({ success: true });
      }

      const payload = pendingAction.payload;
      let result;
      try {
        const cookieHeader = cookieStore.getAll().map((c: {name: string; value: string}) => `${c.name}=${c.value}`).join("; ");
        if (pendingAction.action_type === "send_email_gmail") {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/send`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader }, body: JSON.stringify(payload) });
          result = await res.json();
        } else if (pendingAction.action_type === "send_email_outlook") {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/microsoft/mail/send`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader }, body: JSON.stringify(payload) });
          result = await res.json();
        } else if (pendingAction.action_type === "create_sheet" || pendingAction.action_type === "update_sheet") {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google/sheets/write`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader }, body: JSON.stringify(payload) });
          result = await res.json();
        } else if (pendingAction.action_type === "create_action_item") {
          await supabaseAdmin.from("action_items").insert({ user_id: user.id, ...payload });
          result = { success: true };
        }
        await supabaseAdmin.from("pending_actions").update({ status: result?.error ? "failed" : "executed" }).eq("id", actionId);
        return NextResponse.json({ success: !result?.error, error: result?.error });
      } catch (execErr) {
        await supabaseAdmin.from("pending_actions").update({ status: "failed" }).eq("id", actionId);
        return NextResponse.json({ error: String(execErr) }, { status: 500 });
      }
    }

    if (action === "toggle") {
      const { data: existing } = await supabaseAdmin.from("user_workflows").select("*").eq("user_id", user.id).eq("workflow_type", workflowType).single();
      if (existing) {
        await supabaseAdmin.from("user_workflows").update({ enabled }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("user_workflows").insert({ user_id: user.id, workflow_type: workflowType, enabled, settings: settings || {} });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "save_settings") {
      const { data: existing } = await supabaseAdmin.from("user_workflows").select("*").eq("user_id", user.id).eq("workflow_type", workflowType).single();
      if (existing) {
        await supabaseAdmin.from("user_workflows").update({ settings }).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("user_workflows").insert({ user_id: user.id, workflow_type: workflowType, enabled: false, settings });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
