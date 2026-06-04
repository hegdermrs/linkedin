import OpenAI from "openai";
import {
  AgentReplySchema,
  ProfileSummarySchema,
  type AgentReply,
  type PlaybookConfig,
  type ProfileSummary,
} from "@linkedin-agent/shared";
import {
  compileSystemPrompt,
  ensureSenderSignOff,
  interpolateTemplate,
} from "./compile-prompt.js";
import { applyGuardrails } from "./guardrails.js";
import type { AgentStage } from "./compile-prompt.js";
import { inferJimStage, jimStageHint } from "./jim-stage.js";

export interface LlmConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface MessageContext {
  direction: "inbound" | "outbound";
  text: string;
  sentAt: string;
}

export interface GenerateReplyInput {
  agencyBasePrompt: string;
  playbook: PlaybookConfig;
  stage: AgentStage;
  profileSummary?: ProfileSummary | null;
  messages: MessageContext[];
  prospect: {
    firstName?: string | null;
    lastName?: string | null;
    school?: string | null;
  };
  outboundCount: number;
  followUpCount?: number;
  hasCalendlyInThread: boolean;
  campaignNiche?: string;
}

function getOpenAI(config: LlmConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

async function chatJson(
  config: LlmConfig,
  system: string,
  user: string
): Promise<string> {
  const client = getOpenAI(config);
  const response = await client.chat.completions.create({
    model: config.model,
    temperature: config.temperature ?? 0.65,
    max_tokens: config.maxTokens ?? 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return response.choices[0]?.message?.content ?? "{}";
}

function isJimPlaybook(playbook: PlaybookConfig): boolean {
  const n = playbook.niche ?? "";
  return (
    n.startsWith("jim-") || n === "wrestlers" || n === "athletes"
  );
}

function profileSummarizePrompt(
  agencyBasePrompt: string,
  playbook: PlaybookConfig
): string {
  const wrestlers =
    playbook.niche === "jim-wrestlers" || playbook.niche === "wrestlers";
  const athletes =
    playbook.niche === "jim-athletes" || playbook.niche === "athletes";

  if (wrestlers) {
    return `${agencyBasePrompt}

Extract hooks for Jim Harshaw outreach to FORMER WRESTLERS. Use Education, Experience, headline, about.
Find: school, conference, wrestling level, coaching connections, Pittsburgh/UVA/commonalities with Jim.
suggestedOpener: Stage 0 Jim voice (fellow wrestler, short).
JSON only: hooks[], tone, doNotMention[], suggestedOpener, wrestlingAngle, sport (if any), athleteHook, commonalities[], backgroundType (e.g. college_all_american, hs_only, coach), headline, about`;
  }
  if (athletes) {
    return `${agencyBasePrompt}

Extract hooks for Jim outreach to FORMER COLLEGE ATHLETES (any sport). Do not invent wrestling background for prospect.
suggestedOpener: Stage 0 — fellow college athlete, ask sport if unknown.
JSON only: hooks[], tone, doNotMention[], suggestedOpener, sport, athleteHook, wrestlingAngle (only if wrestler), commonalities[], backgroundType, headline, about`;
  }

  return `${agencyBasePrompt}

Extract athlete/wrestler hooks for outreach. JSON only: hooks[], tone, doNotMention[], suggestedOpener, wrestlingAngle, sport, athleteHook, headline, about`;
}

export async function summarizeProfile(
  config: LlmConfig,
  agencyBasePrompt: string,
  playbook: PlaybookConfig,
  profileData: {
    firstName?: string;
    headline?: string;
    about?: string;
    experience?: string;
    education?: string;
    location?: string;
  }
): Promise<ProfileSummary> {
  const system = profileSummarizePrompt(agencyBasePrompt, playbook);
  const user = JSON.stringify(profileData, null, 2);
  const raw = await chatJson(config, system, user);
  const parsed = ProfileSummarySchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;

  const opener = isJimPlaybook(playbook)
    ? playbook.niche?.includes("athlete")
      ? `Hi ${profileData.firstName ?? "there"}, fellow college athlete here — would love to connect!`
      : `Hi ${profileData.firstName ?? "there"}, fellow wrestler here — glad we connected!`
    : `Hey ${profileData.firstName ?? "there"}, fellow college athlete here — would love to connect!`;

  return ProfileSummarySchema.parse({
    hooks: ["college athlete background"],
    tone: "casual",
    doNotMention: [],
    suggestedOpener: opener,
    wrestlingAngle: "athlete background",
    headline: profileData.headline,
    about: profileData.about,
  });
}

export async function generateReply(
  config: LlmConfig,
  input: GenerateReplyInput
): Promise<AgentReply & { guardrailBlocked?: boolean; guardrailReason?: string }> {
  const niche =
    input.playbook.niche ?? input.campaignNiche ?? "generic";
  const inferred = inferJimStage({
    messages: input.messages,
    prospectStage: input.stage,
    outboundCount: input.outboundCount,
    followUpCount: input.followUpCount ?? 0,
    hasCalendlyInThread: input.hasCalendlyInThread,
    niche,
  });

  const system = compileSystemPrompt(
    input.agencyBasePrompt,
    input.playbook,
    input.stage,
    {
      jimStage: inferred,
      jimStageHint: isJimPlaybook(input.playbook)
        ? jimStageHint(inferred, niche)
        : undefined,
    }
  );

  const hook =
    input.profileSummary?.athleteHook ??
    input.profileSummary?.wrestlingAngle ??
    input.profileSummary?.hooks?.[0] ??
    "your athletic background";

  const vars: Record<string, string> = {
    firstName: input.prospect.firstName ?? "there",
    lastName: input.prospect.lastName ?? "",
    school: input.prospect.school ?? "your program",
    wrestlingHook: hook,
    calendlyUrl: input.playbook.stages.call_offered.calendlyUrl ?? "",
  };

  const user = JSON.stringify(
    {
      appStage: input.stage,
      inferredJimStage: inferred,
      profileSummary: input.profileSummary,
      recentMessages: input.messages.slice(-12),
      outboundCount: input.outboundCount,
      followUpCount: input.followUpCount ?? 0,
      templateVars: vars,
    },
    null,
    2
  );

  const raw = await chatJson(config, system, user);
  let reply: AgentReply;
  try {
    reply = AgentReplySchema.parse(JSON.parse(raw));
  } catch {
    const stageKey =
      input.stage === "profile_analyzed" ? "connect" : "conversing";
    const template =
      input.playbook.stages[
        stageKey as keyof typeof input.playbook.stages
      ].exampleTemplate;
    reply = {
      jimStage: inferred,
      nextStage:
        input.stage === "profile_analyzed" ? "connect_sent" : "conversing",
      messageText: interpolateTemplate(template, vars),
      reasoning: "Fallback template due to parse error",
      confidence: 0.5,
      shouldEscalateToHuman: false,
    };
  }

  reply.messageText = interpolateTemplate(reply.messageText, vars);

  if (
    input.playbook.guardrails.requireSenderSignOff &&
    input.playbook.senderName
  ) {
    reply.messageText = ensureSenderSignOff(
      reply.messageText,
      input.playbook.senderName
    );
  }

  const lastInbound = [...input.messages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const guard = applyGuardrails({
    playbook: input.playbook,
    stage: input.stage,
    messageText: reply.messageText,
    outboundCount: input.outboundCount,
    lastInboundText: lastInbound?.text,
    hasCalendlyInThread: input.hasCalendlyInThread,
    jimStage: reply.jimStage ?? inferred,
  });

  if (!guard.allowed) {
    return {
      ...reply,
      messageText: "",
      shouldEscalateToHuman: true,
      guardrailBlocked: true,
      guardrailReason: guard.reason,
      nextStage: guard.forceStage ?? reply.nextStage,
    };
  }

  return reply;
}

export async function previewReply(
  config: LlmConfig,
  agencyBasePrompt: string,
  playbook: PlaybookConfig,
  fakeProfile: ProfileSummary
): Promise<AgentReply> {
  return generateReply(config, {
    agencyBasePrompt,
    playbook,
    stage: "conversing",
    profileSummary: fakeProfile,
    messages: [
      {
        direction: "inbound",
        text: "Hey! Yeah I wrestled in college, it was a grind but loved it.",
        sentAt: new Date().toISOString(),
      },
    ],
    prospect: { firstName: "Alex", school: "Penn State" },
    outboundCount: 1,
    followUpCount: 0,
    hasCalendlyInThread: false,
    campaignNiche: playbook.niche,
  });
}
