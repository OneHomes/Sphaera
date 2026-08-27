type JanusMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Direct REST call to the Azure AI Foundry Responses API endpoint — no
// SDK dependency needed since we already have the full endpoint URL
// (including /responses). See lib/auth.ts-style env var pattern: values
// come from AZURE_AI_FOUNDRY_* env vars, never hardcoded.
export async function askJanus(messages: JanusMessage[]): Promise<string> {
  const endpoint = process.env.AZURE_AI_FOUNDRY_RESPONSES_ENDPOINT;
  const apiKey = process.env.AZURE_AI_FOUNDRY_API_KEY;
  const deployment = process.env.AZURE_AI_FOUNDRY_DEPLOYMENT_NAME;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error(
      "Azure AI Foundry environment variables are not configured"
    );
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model: deployment,
      input: messages,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Azure AI Foundry request failed (${res.status}): ${errorText}`
    );
  }

  const data = await res.json();

  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  // Fallback parse in case output_text convenience field isn't present
  // on the raw REST response shape.
  type OutputContentItem = { type: string; text?: string };
  type OutputItem = { content?: OutputContentItem[] };

  const textPart = (data.output as OutputItem[] | undefined)
    ?.flatMap((item) => item.content ?? [])
    .find((c) => c.type === "output_text");

  return textPart?.text ?? "Janus couldn't generate a response.";
}