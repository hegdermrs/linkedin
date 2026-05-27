import type { PlaybookConfig } from "@linkedin-agent/shared";
import type { AgentStage } from "./compile-prompt.js";

const PROFANITY_PATTERN =
  /\b(damn|hell|shit|fuck|asshole)\b/i;

const BANNED_CLAIMS_PATTERN =
  /\b(guaranteed returns|free money|100% profit|medical advice|financial advice)\b/i;

export interface GuardrailContext {
  playbook: PlaybookConfig;
  stage: AgentStage;
  lastInboundText?: string;
  outboundCount: number;
  messageText: string;
  hasCalendlyInThread: boolean;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  forceStage?: AgentStage;
}

export function checkInboundOptOut(
  text: string,
  stopPhrases: string[]
): boolean {
  const lower = text.toLowerCase();
  return stopPhrases.some((p) => lower.includes(p.toLowerCase()));
}

export function applyGuardrails(ctx: GuardrailContext): GuardrailResult {
  const { playbook, messageText, stage, outboundCount, lastInboundText } = ctx;
  const g = playbook.guardrails;

  if (lastInboundText && checkInboundOptOut(lastInboundText, g.stopPhrases)) {
    return { allowed: false, reason: "Prospect opted out", forceStage: "opted_out" };
  }

  if (checkInboundOptOut(messageText, g.stopPhrases)) {
    return { allowed: false, reason: "Message contains opt-out language" };
  }

  if (PROFANITY_PATTERN.test(messageText)) {
    return { allowed: false, reason: "Profanity blocked" };
  }

  if (BANNED_CLAIMS_PATTERN.test(messageText)) {
    return { allowed: false, reason: "Banned claims blocked" };
  }

  for (const word of playbook.brand.wordsToAvoid) {
    if (word && messageText.toLowerCase().includes(word.toLowerCase())) {
      return { allowed: false, reason: `Blocked word: ${word}` };
    }
  }

  const calendlyUrl = playbook.stages.call_offered.calendlyUrl;
  const hasCalendly =
    calendlyUrl && messageText.includes(calendlyUrl);

  if (hasCalendly && stage !== "call_offered" && stage !== "conversing") {
    return { allowed: false, reason: "Calendly only allowed when offering call" };
  }

  if (hasCalendly && ctx.hasCalendlyInThread && stage !== "call_offered") {
    return { allowed: false, reason: "Calendly already sent in thread" };
  }

  if (
    (stage === "connect_sent" || stage === "profile_analyzed") &&
    messageText.length > g.maxConnectionNoteChars
  ) {
    return {
      allowed: false,
      reason: `Exceeds ${g.maxConnectionNoteChars} char connection limit`,
    };
  }

  if (
    outboundCount >= g.maxOutboundWithoutReply &&
    !lastInboundText &&
    stage !== "connect_sent" &&
    stage !== "profile_analyzed"
  ) {
    return { allowed: false, reason: "Max outbound without reply reached" };
  }

  return { allowed: true };
}

export function isWithinBusinessHours(
  playbook: PlaybookConfig,
  timezone: string,
  now = new Date()
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    const { businessHoursStart, businessHoursEnd } = playbook.guardrails;
    return hour >= businessHoursStart && hour < businessHoursEnd;
  } catch {
    return true;
  }
}
