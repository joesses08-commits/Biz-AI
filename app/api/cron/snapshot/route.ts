// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // DISABLED - old vision feature
  return Response.json({ success: true, skipped: true });
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hour = nowET.getHours();
  const minute = nowET.getMinutes();

  const isCleaning = hour === 6 && minute <= 10;
  const snapshotWindows = [{h:7,m:0},{h:10,m:0},{h:12,m:30},{h:14,m:30},{h:16,m:0},{h:19,m:0}];
  const isSnapshot = snapshotWindows.some(w => hour === w.h && Math.abs(minute - w.m) <= 10);

  if (!isCleaning && !isSnapshot) {
    return NextResponse.json({ message: "Not a scheduled time", skipped: true });
  }

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  if (!users?.users?.length) return NextResponse.json({ processed: 0 });

  let processed = 0;
  for (const user of users.users) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-action": isCleaning ? "clean" : "update",
        },
      });
      processed++;
    } catch { continue; }
  }

  return NextResponse.json({ success: true, processed, action: isCleaning ? "clean" : "update" });
}
