import type { PlaybookConfig } from "@linkedin-agent/shared";

export type AgentStage =
  | "imported"
  | "profile_analyzed"
  | "connect_sent"
  | "connected"
  | "connect_ignored"
  | "intro_sent"
  | "conversing"
  | "call_offered"
  | "call_booked"
  | "opted_out";

const STAGE_TO_KEY: Partial<
  Record<AgentStage, keyof PlaybookConfig["stages"]>
> = {
  profile_analyzed: "connect",
  connect_sent: "connect",
  connected: "intro",
  intro_sent: "intro",
  conversing: "conversing",
  call_offered: "call_offered",
  call_booked: "call_booked",
};

export function compileSystemPrompt(
  agencyBasePrompt: string,
  playbook: PlaybookConfig,
  stage: AgentStage
): string {
  const stageKey = STAGE_TO_KEY[stage] ?? "conversing";
  const stageConfig = playbook.stages[stageKey];

  return [
    agencyBasePrompt,
    "",
    "## Brand & Voice",
    `Business: ${playbook.brand.businessName}`,
    `Persona: ${playbook.brand.senderPersona}`,
    `Tone: ${playbook.brand.tone}`,
    playbook.brand.wordsToInclude.length
      ? `Include when natural: ${playbook.brand.wordsToInclude.join(", ")}`
      : "",
    playbook.brand.wordsToAvoid.length
      ? `Never say: ${playbook.brand.wordsToAvoid.join(", ")}`
      : "",
    "",
    `## Current stage: ${stageKey}`,
    stageConfig.instructions,
    `Example template: ${stageConfig.exampleTemplate}`,
    stageKey === "conversing" && "pivotGoals" in stageConfig
      ? `Pivot goals: ${(stageConfig as { pivotGoals?: string }).pivotGoals ?? ""}`
      : "",
    stageKey === "call_offered"
      ? `Calendly URL: ${playbook.stages.call_offered.calendlyUrl || "(not set)"}`
      : "",
    "",
    "## Output format",
    "Respond with valid JSON only:",
    `{"nextStage":"...","messageText":"...","reasoning":"...","confidence":0.0-1.0,"shouldEscalateToHuman":false}`,
    "nextStage must be a valid prospect stage. messageText is what to send on LinkedIn.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
