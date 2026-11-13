// List prices (USD) used to put a cost on each usage row when it's written.
// They are estimates: the Azure bill on the costs page is the real number.
// Check them against https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/
// and .../speech-services/ when a model or region changes.
export const PRICES_CHECKED = "2026-11-13";

// Per 1M tokens: [input, cached input, output]. Matched by the longest prefix
// of the model name the API reports (e.g. "gpt-4.1-2025-04-14" → "gpt-4.1").
const LLM_PER_MILLION: Record<string, [number, number, number]> = {
  "gpt-4o-mini": [0.15, 0.075, 0.6],
  "gpt-4o": [2.5, 1.25, 10],
  "gpt-4.1-nano": [0.1, 0.025, 0.4],
  "gpt-4.1-mini": [0.4, 0.1, 1.6],
  "gpt-4.1": [2, 0.5, 8],
  "gpt-5-nano": [0.05, 0.005, 0.4],
  "gpt-5-mini": [0.25, 0.025, 2],
  "gpt-5": [1.25, 0.125, 10],
  "o4-mini": [1.1, 0.275, 4.4],
  "o3": [2, 0.5, 8],
};

export function llmCost(model: string | null, input: number, cached: number, output: number): number | null {
  if (!model) return null;
  const name = model.toLowerCase();
  const key = Object.keys(LLM_PER_MILLION)
    .filter((k) => name.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const [inP, cachedP, outP] = LLM_PER_MILLION[key];
  return ((input - cached) * inP + cached * cachedP + output * outP) / 1_000_000;
}

// Azure Speech, real-time speech to text (Standard): per audio hour.
export const SPEECH_PER_HOUR = 1.0;
export const speechCost = (seconds: number) => (seconds / 3600) * SPEECH_PER_HOUR;

// Blob storage per GB-month (GRS). Recordings sit in Hot for 30 days, then
// Cold, then Archive after 180 days (lifecycle rule "recordings-tiering").
export const STORAGE_PER_GB_MONTH = { hot: 0.046, cold: 0.0082, archive: 0.0036 };
export const storageCostPerMonth = (bytes: number, tier: keyof typeof STORAGE_PER_GB_MONTH = "hot") =>
  (bytes / 1024 ** 3) * STORAGE_PER_GB_MONTH[tier];
