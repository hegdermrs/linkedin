import type { PlaybookConfig } from "@linkedin-agent/shared";
import type { JimStage } from "./jim-stage.js";

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

export interface CompilePromptOptions {
  jimStage?: JimStage;
  jimStageHint?: string;
}

export function compileSystemPrompt(
  agencyBasePrompt: string,
  playbook: PlaybookConfig,
  stage: AgentStage,
  options?: CompilePromptOptions
): string {
  const stageKey = STAGE_TO_KEY[stage] ?? "conversing";
  const stageConfig = playbook.stages[stageKey];
  const sender = playbook.senderName ?? "Jim";
  const isJim =
    playbook.niche?.startsWith("jim-") ||
    playbook.niche === "wrestlers" ||
    playbook.niche === "athletes";

  return [
    agencyBasePrompt,
    isJim
      ? `\nYou are writing AS ${sender}. Every messageText must sound like Jim Harshaw Jr. — warm, short, fellow athlete/wrestler. Sign as "${sender}" at the end.`
      : "",
    playbook.sequenceGuide ?? "",
    options?.jimStageHint ?? "",
    options?.jimStage
      ? `Target Jim sub-stage for this reply: ${options.jimStage}`
      : "",
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
    `## App pipeline stage: ${stage} (playbook key: ${stageKey})`,
    stageConfig.instructions,
    `Example (adapt, do not copy blindly): ${stageConfig.exampleTemplate}`,
    stageKey === "conversing" && "pivotGoals" in stageConfig
      ? `Pivot goals: ${(stageConfig as { pivotGoals?: string }).pivotGoals ?? ""}`
      : "",
    stageKey === "call_offered"
      ? `Calendar URL (include when scheduling): ${playbook.stages.call_offered.calendlyUrl || "(not set)"}`
      : "",
    "",
    "## Output format",
    "Respond with valid JSON only:",
    `{"jimStage":"0|1|2|2B|2C|3|4a|4b|5|6|7","nextStage":"...","messageText":"...","reasoning":"...","confidence":0.0-1.0,"shouldEscalateToHuman":false}`,
    "jimStage: which Jim conversation sub-stage you used.",
    "nextStage: prospect pipeline stage after sending.",
    "messageText: the exact LinkedIn DM (plain sentences, no bullets).",
    isJim
      ? "If unsure, warmer and shorter. Never exceed ~6 sentences unless explaining Reveal Your Path (2B)."
      : "",
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

/** Ensure Jim sign-off on outbound messages when playbook requires it. */
export function ensureSenderSignOff(
  messageText: string,
  senderName: string
): string {
  const trimmed = messageText.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(senderName.toLowerCase()) || lower.includes(`\n${senderName.toLowerCase()}`)) {
    return trimmed;
  }
  if (lower.endsWith("jim")) return trimmed;
  return `${trimmed}\n\n${senderName}`;
}
