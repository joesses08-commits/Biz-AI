import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 20;

function isImportantEmail(subject: string, snippet: string, fromAddress: string, isSent: boolean): boolean {
  const text = `${subject} ${snippet}`.toLowerCase();
  const from = fromAddress.toLowerCase();
  if (from.includes("noreply") || from.includes("no-reply") || from.includes("newsletter") || from.includes("mailer")) return false;
  if (text.includes("unsubscribe") || text.includes("newsletter") || text.includes("promotional")) return false;
  if (isSent) return true;
  const businessKeywords = ["invoice", "payment", "contract", "proposal", "deal", "order", "shipment", "urgent", "follow up", "meeting", "schedule", "offer", "quote", "agreement", "deadline", "overdue", "balance", "deposit", "$", "price", "cost", "budget", "revenue", "client", "customer", "partner"];
  if (businessKeywords.some(k => text.includes(k))) return true;
  if (subject.toLowerCase().startsWith("re:") || subject.toLowerCase().startsWith("fwd:")) return true;
  return false;
}

async function buildBrainSection(userId: string, source: string, dataText: string, companyContext: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    system: `You are a Chief Operating Officer building an intelligent knowledge base about a business from their historical data.

Read all the data carefully and write a comprehensive, specific summary that captures:
- Key clients, partners, vendors — who they are and the relationship status
- Financial patterns — revenue trends, outstanding amounts, payment behavior
- Ongoing deals, projects, or negotiations — status and next steps
- Recurring themes, problems, or opportunities
- Important people and their roles in the business
- Any urgent or unresolved items

Be SPECIFIC — use real names, real amounts, real dates. This summary will be the AI COO's permanent knowledge base.
Write in flowing paragraphs, not bullet points.`,
    messages: [{
      role: "user",
      content: `COMPANY: ${companyContext}
SOURCE: ${source}

DATA:
${dataText.slice(0, 10000)}

Write the knowledge summary now.`
    }],
  });

  trackUsage(userId, "snapshot", "claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function POST(request: NextRequest) {
  // DISABLED - old vision feature
  return Response.json({ success: true, skipped: true });
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

    const { jobId } = await request.json();

    const { data: job } = await supabaseAdmin
      .from("backfill_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.status === "done") return NextResponse.json({ done: true, jobId });

    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const companyContext = `${profile?.company_name || ""}: ${profile?.company_brief || ""}`;

    if (job.source === "gmail") {
      // Get next unprocessed batch
      const { data: batch } = await supabaseAdmin
        .from("backfill_queue")
        .select("*")
        .eq("job_id", jobId)
        .eq("processed", false)
        .limit(BATCH_SIZE);

      if (!batch?.length) {
        // All processed — build final summary
        // Use correct Supabase filter syntax
        const { data: allRows } = await supabaseAdmin
          .from("backfill_queue")
          .select("item_data")
          .eq("job_id", jobId)
          .eq("processed", true);

        // Filter in JS — more reliable than Supabase JSON filtering
        const emailTexts = (allRows || [])
          .map((r: any) => r.item_data?.summary)
          .filter((s: any) => s && typeof s === "string" && s.length > 0);

        if (emailTexts.length > 0) {
          const brainSection = await buildBrainSection(user.id, "Gmail", emailTexts.join("\n"), companyContext);

          if (brainSection) {
            const existingBrain = profile?.company_brain || "";
            const newBrain = existingBrain + "\n\n=== GMAIL HISTORY ===\n" + brainSection;

            await supabaseAdmin.from("company_profiles").upsert({
              user_id: user.id,
              company_brain: newBrain,
              updated_at: new Date().toISOString(),
            });
          }
        }

        await supabaseAdmin.from("backfill_jobs").update({
          status: "done",
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);

        // Trigger snapshot rebuild
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/events/snapshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": user.id },
        }).catch(() => {});

        return NextResponse.json({ done: true, jobId, emailsAnalyzed: emailTexts.length });
      }

      // Process this batch
      const token = batch[0].item_data?.token;

      for (const item of batch) {
        try {
          const isSent = item.item_data?.isSent || false;
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.item_id}?format=minimal`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];

          const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          const subject = getHeader("subject") || "(No subject)";
          const from = getHeader("from") || "";
          const date = getHeader("date") || "";
          const snippet = msgData.snippet || "";

          let summary = null;
          if (isImportantEmail(subject, snippet, from, isSent)) {
            summary = `${isSent ? "SENT" : "RECEIVED"} | ${date} | FROM: ${from} | SUBJECT: ${subject} | ${snippet.slice(0, 150)}`;
          }

          await supabaseAdmin.from("backfill_queue").update({
            processed: true,
            item_data: { isSent, summary },
          }).eq("id", item.id);

        } catch {
          // Mark as processed even if failed
          await supabaseAdmin.from("backfill_queue").update({
            processed: true,
            item_data: { ...item.item_data, summary: null },
          }).eq("id", item.id);
        }
      }

      // Update job progress
      const newProcessed = (job.processed_items || 0) + batch.length;
      await supabaseAdmin.from("backfill_jobs").update({
        processed_items: newProcessed,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      const total = job.total_items || 1;
      const pct = Math.round((newProcessed / total) * 100);

      return NextResponse.json({
        done: false,
        jobId,
        processed: newProcessed,
        total,
        pct,
        batchSize: batch.length,
      });
    }

    return NextResponse.json({ done: true, jobId });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
