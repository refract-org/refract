export type ProviderConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export function getProvider(): ProviderConfig | null {
  const endpoint =
    process.env.REFRACT_INFERENCE_ENDPOINT
    || (process.env.OPENAI_API_BASE
      ? (process.env.OPENAI_API_BASE.endsWith("/chat/completions")
        ? process.env.OPENAI_API_BASE
        : `${process.env.OPENAI_API_BASE}/chat/completions`)
      : "");
  if (!endpoint) return null;

  return {
    endpoint,
    apiKey: process.env.REFRACT_INFERENCE_API_KEY || process.env.OPENAI_API_KEY || "unused",
    model: process.env.REFRACT_INFERENCE_MODEL || process.env.INFERENCE_MODEL || "gemma4:26b",
  };
}

export async function callModel(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
