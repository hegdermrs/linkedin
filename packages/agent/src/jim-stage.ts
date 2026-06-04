import type { MessageContext } from "./llm.js";

export type JimStage =
  | "0"
  | "1"
  | "2"
  | "2B"
  | "2C"
  | "3"
  | "4a"
  | "4b"
  | "5"
  | "6"
  | "7";

export interface InferJimStageInput {
  messages: MessageContext[];
  prospectStage: string;
  outboundCount: number;
  followUpCount: number;
  hasCalendlyInThread: boolean;
  niche: string;
}

function lastInbound(messages: MessageContext[]): MessageContext | undefined {
  return [...messages].reverse().find((m) => m.direction === "inbound");
}

function lastOutbound(messages: MessageContext[]): MessageContext | undefined {
  return [...messages].reverse().find((m) => m.direction === "outbound");
}

function textHasPainConfirmation(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(yes|yeah|yep|definitely|all the time|always|100%|for sure)\b/.test(t) &&
    t.length < 120
  );
}

function textAsksWhatIsThis(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /what is this/.test(t) ||
    /sales framework/.test(t) ||
    /management coaching/.test(t) ||
    /what do you (do|offer)/.test(t) ||
    /tell me more about/.test(t) && /program|coaching|framework/.test(t)
  );
}

function textRejectsPain(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /don'?t feel that way/.test(t) ||
    /not really/.test(t) && /feel/.test(t) ||
    /i'?m good/.test(t) ||
    /don'?t relate/.test(t)
  );
}

function textWantsSchedule(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(yes|sure|sounds good|let'?s do it|i'?m open|book|schedule|calendar)\b/.test(
      t
    ) && /call|chat|time|meet/.test(t)
  );
}

function textSharesAthleticBackground(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /wrestl/.test(t) ||
    /played/.test(t) ||
    /college/.test(t) && /(sport|team|athlet)/.test(t) ||
    /varsity/.test(t) ||
    /d1|division i|ncaa/.test(t) ||
    /coached/.test(t)
  );
}

/** Heuristic Jim sub-stage — LLM still receives full sequence guide to refine. */
export function inferJimStage(input: InferJimStageInput): JimStage {
  const { messages, prospectStage, outboundCount, followUpCount, hasCalendlyInThread, niche } =
    input;
  const inbound = lastInbound(messages);
  const inboundText = inbound?.text ?? "";

  if (prospectStage === "call_booked") return "7";
  if (prospectStage === "call_offered" || textWantsSchedule(inboundText)) {
    return "3";
  }

  if (inbound) {
    if (textAsksWhatIsThis(inboundText)) return "2B";
    if (
      (niche === "jim-athletes" || niche === "athletes") &&
      textRejectsPain(inboundText)
    ) {
      return "2C";
    }
    if (textHasPainConfirmation(inboundText)) return "2";
    if (hasCalendlyInThread && !textWantsSchedule(inboundText)) return "5";
    if (textSharesAthleticBackground(inboundText) && outboundCount >= 1) {
      return "1";
    }
  }

  if (
    hasCalendlyInThread &&
    outboundCount > 0 &&
    !inbound
  ) {
    return "5";
  }

  if (outboundCount === 0) {
    if (prospectStage === "profile_analyzed" || prospectStage === "connect_sent") {
      return "0";
    }
    if (prospectStage === "connected") return "0";
  }

  if (!inbound && outboundCount > 0) {
    if (followUpCount >= 1) return "4b";
    return "4a";
  }

  if (prospectStage === "intro_sent" || prospectStage === "conversing") {
    return inbound ? "1" : "4a";
  }

  return "1";
}

export function jimStageHint(stage: JimStage, niche: string): string {
  const athleteOnly = stage === "2C" ? " (athletes niche only)" : "";
  return `Inferred Jim sub-stage: ${stage}${athleteOnly}. Follow that stage in the sequence guide for ${niche}.`;
}
