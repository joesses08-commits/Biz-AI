import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { computeMetrics } from "@/lib/metrics";
import { buildSystemPrompt } from "@/lib/prompt";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Load live business metrics
   const metrics = await computeMetrics();
if (!metrics) {
  return NextResponse.json(
    { error: "No business data found. Please upload CSV files first." },
    { status: 400 }
  );
}
    // Build the data-aware system prompt
    const systemPrompt = buildSystemPrompt(metrics);

    // Stream the response from Claude
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1500,
  system: systemPrompt,
  messages: messages.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  })),
});

const text = response.content[0].type === "text" ? response.content[0].text : "";
return NextResponse.json({ response: text });