import type { LlmConfig } from "./llm.js";

export interface ThreadSample {
  prospectId: string;
  stage: string;
  messages: { direction: string; text: string }[];
  outcome?: "booked" | "replied" | "ghosted" | "opted_out";
}

export interface PlaybookInsightResult {
  summary: string;
  suggestedChanges: string[];
  strengths: string[];
  risks: string[];
}

/** Phase 4: analyze stored threads and suggest playbook tweaks (admin review). */
export async function analyzeConversationInsights(
  config: LlmConfig,
  samples: ThreadSample[],
  currentPlaybookSummary: string
): Promise<PlaybookInsightResult> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    temperature: 0.4,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You analyze LinkedIn outreach threads for Jim Harshaw's voice (warm, short, fellow athlete, Reveal Your Path).
Suggest improvements to playbook instructions — not wholesale rewrites.
Respond JSON: {"summary":"","suggestedChanges":[],"strengths":[],"risks":[]}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          { currentPlaybookSummary, sampleCount: samples.length, samples: samples.slice(0, 15) },
          null,
          2
        ),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as PlaybookInsightResult;
  } catch {
    return {
      summary: "Could not parse analysis.",
      suggestedChanges: [],
      strengths: [],
      risks: [],
    };
  }
}
