import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { emails } = await request.json();

    const emailSummary = emails.map((e: { from: string; subject: string; snippet: string; isUnread: boolean }) =>
      `From: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.snippet}\nUnread: ${e.isUnread}`
    ).join("\n\n---\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are an AI COO assistant. Analyze these recent emails and give a business intelligence briefing. Be concise and actionable. Identify: key action items, important business conversations, any issues or alerts, and what to prioritize today.\n\nEmails:\n\n${emailSummary}`
      }]
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ analysis: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
