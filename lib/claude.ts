import Anthropic from "@anthropic-ai/sdk";
import { trackUsage } from "@/lib/track-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface CallClaudeParams {
  userId: string;
  feature: string;
  model?: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
}

export async function callClaude({
  userId,
  feature,
  model = "claude-sonnet-4-5",
  system,
  messages,
  maxTokens = 8096,
}: CallClaudeParams): Promise<Anthropic.Message> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  });

  // Always track — this runs before returning, no way to skip it
  trackUsage(
    userId,
    feature,
    model,
    response.usage.input_tokens,
    response.usage.output_tokens
  ).catch((err) => console.error("Track usage failed:", err));

  return response;
}
