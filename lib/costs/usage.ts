import { prisma } from "@/lib/prisma";
import { llmCost, speechCost, storageCostPerMonth } from "@/lib/costs/pricing";

// Who/what a paid request was for, so the costs page can break it down.
export type UsageContext = {
  feature: string;
  userId?: string | null;
  leadId?: string | null;
  callId?: string | null;
};

// Never lets cost tracking break the feature it's tracking.
async function save(data: Parameters<typeof prisma.usageEvent.create>[0]["data"]) {
  try {
    await prisma.usageEvent.create({ data });
  } catch (err) {
    console.error("usage tracking failed:", err);
  }
}

export function recordLlmUsage(
  ctx: UsageContext | undefined,
  usage: { model: string | null; inputTokens: number; cachedTokens: number; outputTokens: number; durationMs: number }
) {
  return save({
    service: "llm",
    feature: ctx?.feature ?? "janus",
    model: usage.model,
    inputTokens: usage.inputTokens,
    cachedTokens: usage.cachedTokens,
    outputTokens: usage.outputTokens,
    costUsd: llmCost(usage.model, usage.inputTokens, usage.cachedTokens, usage.outputTokens),
    durationMs: usage.durationMs,
    userId: ctx?.userId ?? null,
    leadId: ctx?.leadId ?? null,
    callId: ctx?.callId ?? null,
  });
}

export function recordSpeechUsage(ctx: UsageContext, seconds: number) {
  return save({
    service: "speech",
    feature: ctx.feature,
    model: "azure-speech-realtime",
    quantity: seconds,
    unit: "audio_seconds",
    costUsd: speechCost(seconds),
    userId: ctx.userId ?? null,
    leadId: ctx.leadId ?? null,
    callId: ctx.callId ?? null,
  });
}

// Recordings are charged every month they're stored; the row holds the
// first month (Hot tier). The costs page also totals all storage held.
export function recordRecordingUsage(ctx: UsageContext, bytes: number) {
  return save({
    service: "recording",
    feature: ctx.feature,
    quantity: bytes,
    unit: "bytes",
    costUsd: storageCostPerMonth(bytes),
    userId: ctx.userId ?? null,
    leadId: ctx.leadId ?? null,
    callId: ctx.callId ?? null,
  });
}
