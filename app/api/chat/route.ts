import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { updateCompanyBrain, buildFullCompanyContext } from "@/lib/company-context";
import { trackUsage } from "@/lib/track-usage";
import { checkQuota } from "@/lib/quota";
import {
  findSheet, readSheet, writeSheet, appendRow,
  findExcel, readExcel, writeExcel,
  sendEmail, searchEmails,
  createActionItem, addCalendarEvent,
  findTranscript, readTranscriptContent,
  createFactoryQuoteJob, getQuickBooksInvoices,
} from "./tools";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SONNET = "claude-sonnet-4-5";
const HAIKU = "claude-haiku-4-5-20251001";

// ── TOOL DEFINITIONS ───────────────────────────────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "find_sheet",
    description: "Find a Google Sheet by name in Google Drive",
    input_schema: { type: "object" as const, properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "read_sheet",
    description: "Read data from a Google Sheet",
    input_schema: { type: "object" as const, properties: { spreadsheetId: { type: "string" }, range: { type: "string" } }, required: ["spreadsheetId"] },
  },
  {
    name: "write_sheet",
    description: "Write or update data in a Google Sheet",
    input_schema: { type: "object" as const, properties: { spreadsheetId: { type: "string" }, range: { type: "string" }, values: { type: "array", items: { type: "array" } } }, required: ["spreadsheetId", "range", "values"] },
  },
  {
    name: "append_row",
    description: "Append a new row to a Google Sheet",
    input_schema: { type: "object" as const, properties: { spreadsheetId: { type: "string" }, range: { type: "string" }, values: { type: "array", items: { type: "array" } } }, required: ["spreadsheetId", "range", "values"] },
  },
  {
    name: "find_excel",
    description: "Find a Microsoft Excel file by name in OneDrive",
    input_schema: { type: "object" as const, properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "read_excel",
    description: "Read data from a Microsoft Excel file",
    input_schema: { type: "object" as const, properties: { fileId: { type: "string" }, sheet: { type: "string" } }, required: ["fileId"] },
  },
  {
    name: "write_excel",
    description: "Write data to a Microsoft Excel file",
    input_schema: { type: "object" as const, properties: { fileId: { type: "string" }, sheet: { type: "string" }, address: { type: "string" }, values: { type: "array", items: { type: "array" } } }, required: ["fileId", "sheet", "address", "values"] },
  },
  {
    name: "send_email",
    description: "Send an email via Gmail or Outlook",
    input_schema: { type: "object" as const, properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, provider: { type: "string", enum: ["gmail", "outlook", "auto"] } }, required: ["to", "subject", "body"] },
  },
  {
    name: "search_emails",
    description: "Search emails by keyword, contact, or subject",
    input_schema: { type: "object" as const, properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"] },
  },
  {
    name: "create_action_item",
    description: "Create an action item in the Action Tracker",
    input_schema: { type: "object" as const, properties: { title: { type: "string" }, description: { type: "string" }, dueDate: { type: "string" }, priority: { type: "string", enum: ["low", "medium", "high", "critical"] } }, required: ["title", "description"] },
  },
  {
    name: "add_calendar_event",
    description: "Add an event to Google Calendar or Outlook Calendar",
    input_schema: { type: "object" as const, properties: { title: { type: "string" }, start: { type: "string" }, end: { type: "string" }, description: { type: "string" }, provider: { type: "string", enum: ["google", "outlook", "auto"] } }, required: ["title", "start", "end"] },
  },
  {
    name: "find_transcript",
    description: "Find meeting transcripts in Google Drive or OneDrive",
    input_schema: { type: "object" as const, properties: { query: { type: "string" } }, required: [] },
  },
  {
    name: "read_transcript",
    description: "Read the content of a meeting transcript file",
    input_schema: { type: "object" as const, properties: { fileId: { type: "string" }, source: { type: "string", enum: ["google", "microsoft"] } }, required: ["fileId", "source"] },
  },
  {
    name: "create_factory_quote_job",
    description: "Create a new factory quote job",
    input_schema: { type: "object" as const, properties: { jobName: { type: "string" }, factories: { type: "array", items: { type: "object" } }, orderDetails: { type: "object" } }, required: ["jobName", "factories"] },
  },
  {
    name: "get_quickbooks_invoices",
    description: "Get invoices from QuickBooks",
    input_schema: { type: "object" as const, properties: { status: { type: "string", enum: ["all", "overdue", "paid", "unpaid"] } }, required: [] },
  },
  {
    name: "request_approval",
    description: "Request user approval before executing a significant action. Use before write_sheet, write_excel, send_email, or any destructive action.",
    input_schema: { type: "object" as const, properties: { action: { type: "string" }, details: { type: "string" } }, required: ["action", "details"] },
  },
];

// ── EXECUTE TOOL ───────────────────────────────────────────────────────────
async function executeTool(name: string, input: any, userId: string): Promise<any> {
  switch (name) {
    case "find_sheet": return findSheet(userId, input.name);
    case "read_sheet": return readSheet(userId, input.spreadsheetId, input.range);
    case "write_sheet": return writeSheet(userId, input.spreadsheetId, input.range, input.values);
    case "append_row": return appendRow(userId, input.spreadsheetId, input.range, input.values);
    case "find_excel": return findExcel(userId, input.name);
    case "read_excel": return readExcel(userId, input.fileId, input.sheet);
    case "write_excel": return writeExcel(userId, input.fileId, input.sheet, input.address, input.values);
    case "send_email": return sendEmail(userId, input.to, input.subject, input.body, input.provider || "auto");
    case "search_emails": return searchEmails(userId, input.query, input.maxResults);
    case "create_action_item": return createActionItem(userId, input.title, input.description, input.dueDate, input.priority);
    case "add_calendar_event": return addCalendarEvent(userId, input.title, input.start, input.end, input.description, input.provider);
    case "find_transcript": return findTranscript(userId, input.query);
    case "read_transcript": return readTranscriptContent(userId, input.fileId, input.source);
    case "create_factory_quote_job": return createFactoryQuoteJob(userId, input.jobName, input.factories, input.orderDetails || {});
    case "get_quickbooks_invoices": return getQuickBooksInvoices(userId, input.status);
    case "request_approval": return { awaitingApproval: true, action: input.action, details: input.details };
    default: return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(request: NextRequest) {
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

    const { messages, approvedAction, pendingTools, userId: passedUserId } = await request.json();

    // If this is an approval execution — run the tools directly, no Claude needed
    if (approvedAction && pendingTools?.length) {
      const results = [];
      for (const tool of pendingTools) {
        const result = await executeTool(tool.name, tool.input, user.id);
        results.push({ tool: tool.name, result });
      }
      // Use Haiku just for the summary
      const summaryRes = await anthropic.messages.create({
        model: HAIKU,
        max_tokens: 500,
        system: "You are Jimmy, an AI COO. Summarize what was just executed in 1-2 sentences. Be specific with numbers.",
        messages: [{ role: "user", content: `These actions were just executed: ${JSON.stringify(results)}. Summarize what was done.` }],
      });
      trackUsage(user.id, "chat", HAIKU, summaryRes.usage.input_tokens, summaryRes.usage.output_tokens).catch(() => {});
      const summary = summaryRes.content[0].type === "text" ? summaryRes.content[0].text : "Done.";
      return NextResponse.json({ message: summary });
    }

    const quota = await checkQuota(user.id, "chat");
    if (!quota.allowed) {
      return NextResponse.json({
        error: "quota_exceeded",
        reason: quota.reason,
        tokensRemaining: quota.tokensRemaining,
        message: quota.reason === "daily_limit" ? "Daily token limit reached." : "Monthly token limit reached. Purchase more tokens to continue.",
      }, { status: 402 });
    }

    const { data: profile } = await supabaseAdmin.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle();
    const { data: snapshot } = await supabaseAdmin.from("context_cache").select("context, cached_at").eq("user_id", user.id).maybeSingle();
    const { data: recentEvents } = await supabaseAdmin
      .from("company_events")
      .select("created_at, source, event_type, analysis, importance, recommended_action, dollar_amount, action_required, raw_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });

    let companyContext = "";
    if (profile) {
      companyContext += `COMPANY: ${profile.company_name || "Unknown"}\nFOUNDATION: ${profile.company_brief || ""}\n${profile.company_brain ? `KNOWLEDGE:\n${profile.company_brain}` : ""}`;
    }
    if (snapshot?.context && snapshot.context.length > 200) {
      companyContext += `\n\nBRAIN SNAPSHOT:\n${snapshot.context}`;
    } else {
      const liveContext = await buildFullCompanyContext(user.id);
      companyContext += `\n\nLIVE BUSINESS DATA:\n${liveContext.slice(0, 2500)}`;
    }
    if (recentEvents?.length) {
      const actionItems = recentEvents.filter((e: any) => e.action_required);
      if (actionItems.length) {
        companyContext += `\n\nURGENT ACTIONS:\n${actionItems.slice(0, 5).map((e: any) => `⚠️ [${e.source}] ${e.analysis} → ${e.recommended_action}`).join("\n")}`;
      }
      companyContext += `\n\nRECENT EVENTS:\n${recentEvents.map((e: any) =>
        `[${new Date(e.created_at).toLocaleString()}] ${e.source} — ${e.event_type}\n${e.analysis}${e.dollar_amount ? ` | $${e.dollar_amount}` : ""}${e.recommended_action ? `\n→ ${e.recommended_action}` : ""}`
      ).join("\n\n")}`;
    }

    const systemPrompt = `You are Jimmy, the AI COO of this business. Today is ${today}.

You are a brilliant, direct operator who not only advises but ACTS. You have tools to read/write spreadsheets, send emails, manage calendars, create action items, and more across both Google Workspace and Microsoft 365.

HOW TO BEHAVE:
- If asked to do something, do it — don't just describe how to do it
- If you need more info to complete a task, ask ONE specific question
- Before writing to any sheet, sending any email, or doing anything irreversible — use request_approval first
- After approval, execute immediately
- Be specific — name files, amounts, dates, exact numbers
- Keep responses tight — no fluff

TOOL USE RULES:
- Always find_sheet or find_excel before reading/writing (you need the ID)
- For stocks: read the sheet first to find the right row, calculate new values, then request_approval with exact changes, then write
- For emails: draft the full email body, request_approval showing the complete draft, then send
- For calendar: show the exact events you're about to add, request_approval, then add them
- If both Google and Microsoft are connected, ask which provider to use

BRAIN UPDATE RULE:
If the user tells you something new, end with:
BRAIN_UPDATE: [one sentence to remember]

${companyContext || "No integrations connected yet."}`;

    // ── COST-OPTIMIZED AGENTIC LOOP ────────────────────────────────────────
    // Budget: Sonnet max 2 calls (plan + optional rescue)
    //         Haiku max 5 calls (up to 4 work steps + 1 summary)
    //         Free tools: unlimited

    let currentMessages = [...messages];
    let sonnetCalls = 0;
    let haikuCalls = 0;
    let totalSonnetIn = 0, totalSonnetOut = 0;
    let totalHaikuIn = 0, totalHaikuOut = 0;
    let finalText = "";
    let pendingApproval: { action: string; details: string } | null = null;
    let toolResults: string[] = []; // accumulate results for summary
    let needsRescue = false;

    const MAX_SONNET = 2;
    const MAX_HAIKU = 5;

    for (let i = 0; i < 8; i++) {
      // Decide which model to use
      // Sonnet: first call (plan) and rescue call if something broke
      // Haiku: everything else (work steps + summary)
      const isFirstCall = i === 0;
      const useModel = (isFirstCall || needsRescue) && sonnetCalls < MAX_SONNET ? SONNET : HAIKU;
      needsRescue = false;

      if (useModel === SONNET && sonnetCalls >= MAX_SONNET) break;
      if (useModel === HAIKU && haikuCalls >= MAX_HAIKU) break;

      await new Promise(r => setTimeout(r, i > 0 ? 500 : 0));

      const response = await anthropic.messages.create({
        model: useModel,
        max_tokens: useModel === SONNET ? 2000 : 1500,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      });

      if (useModel === SONNET) {
        sonnetCalls++;
        totalSonnetIn += response.usage.input_tokens;
        totalSonnetOut += response.usage.output_tokens;
      } else {
        haikuCalls++;
        totalHaikuIn += response.usage.input_tokens;
        totalHaikuOut += response.usage.output_tokens;
      }

      const textBlocks = response.content.filter(b => b.type === "text");
      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b: any) => b.text).join("\n");
      }

      if (response.stop_reason === "end_turn") break;

      const toolUses = response.content.filter(b => b.type === "tool_use");
      if (toolUses.length === 0) break;

      currentMessages.push({ role: "assistant", content: response.content });

      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        if (toolUse.type !== "tool_use") continue;

        if (toolUse.name === "request_approval") {
          pendingApproval = { action: (toolUse.input as any).action, details: (toolUse.input as any).details };

          // Collect all pending tool calls AFTER approval so we can execute them directly
          const pendingTools = toolUses
            .filter(t => t.type === "tool_use" && t.name !== "request_approval")
            .map(t => t.type === "tool_use" ? { name: t.name, input: t.input } : null)
            .filter(Boolean);

          if (totalSonnetIn > 0) trackUsage(user.id, "chat", SONNET, totalSonnetIn, totalSonnetOut).catch(() => {});
          if (totalHaikuIn > 0) trackUsage(user.id, "chat", HAIKU, totalHaikuIn, totalHaikuOut).catch(() => {});

          return NextResponse.json({
            message: finalText || `I'm ready to proceed. Here's what I'll do:`,
            pendingApproval,
            pendingTools,
            conversationState: currentMessages,
          });
        }

        const result = await executeTool(toolUse.name, toolUse.input, user.id);

        // Check if tool returned an error — flag for rescue
        if (result?.error) {
          needsRescue = true;
        }

        toolResults.push(`${toolUse.name}: ${JSON.stringify(result).slice(0, 300)}`);
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages.push({ role: "user", content: toolResultBlocks });
    }

    // Track usage
    if (totalSonnetIn > 0) trackUsage(user.id, "chat", SONNET, totalSonnetIn, totalSonnetOut).catch(() => {});
    if (totalHaikuIn > 0) trackUsage(user.id, "chat", HAIKU, totalHaikuIn, totalHaikuOut).catch(() => {});

    let displayText = finalText;
    const brainUpdateMatch = finalText.match(/BRAIN_UPDATE:\s*(.+?)$/m);
    if (brainUpdateMatch) {
      displayText = finalText.replace(/\nBRAIN_UPDATE:.+$/m, "").trim();
      updateCompanyBrain(user.id, brainUpdateMatch[1]).catch(() => {});
    }

    return NextResponse.json({ message: displayText });
  } catch (err) {
    return NextResponse.json({ error: "Failed to process request", details: String(err) }, { status: 500 });
  }
}
