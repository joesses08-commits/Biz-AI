import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AuditAction =
  | "login" | "logout"
  | "plm_stage_update" | "plm_product_create" | "plm_product_kill"
  | "sample_request" | "sample_approve" | "sample_revise"
  | "po_generated" | "po_sent"
  | "rfq_sent" | "quote_uploaded"
  | "brain_built" | "snapshot_updated"
  | "integration_connected" | "integration_disconnected"
  | "pin_set" | "pin_verified" | "pin_failed"
  | "settings_updated" | "data_exported";

export async function auditLog(
  userId: string,
  action: AuditAction,
  details?: Record<string, any>,
  request?: NextRequest
) {
  try {
    const ip = request?.headers.get("x-forwarded-for") ||
               request?.headers.get("x-real-ip") ||
               "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action,
      details: details || {},
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let audit logging break the main flow
    console.error("Audit log error:", err);
  }
}
