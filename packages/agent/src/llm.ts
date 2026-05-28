import OpenAI from "openai";
import {
  AgentReplySchema,
  ProfileSummarySchema,
  type AgentReply,
  type PlaybookConfig,
  type ProfileSummary,
} from "@linkedin-agent/shared";
import { compileSystemPrompt, interpolateTemplate } from "./compile-prompt.js";
import { applyGuardrails } from "./guardrails.js";
import type { AgentStage } from "./compile-prompt.js";

export interface LlmConfig {
  provider: string;
  model: string;
  apiKey: string;
  /** OpenAI-compatible API base (e.g. DeepSeek: https://api.deepseek.com) */
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
  hasCalendlyInThread: boolean;
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
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return response.choices[0]?.message?.content ?? "{}";
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
  }
): Promise<ProfileSummary> {
  const system = `${agencyBasePrompt}\n\nExtract wrestling/athlete hooks for outreach. Respond JSON only with: hooks (string[]), tone, doNotMention (string[]), suggestedOpener (max 300 chars), wrestlingAngle, headline, about.`;
  const user = JSON.stringify(profileData, null, 2);
  const raw = await chatJson(config, system, user);
  const parsed = ProfileSummarySchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;
  return ProfileSummarySchema.parse({
    hooks: ["college athlete", "wrestling background"],
    tone: "casual",
    doNotMention: [],
    suggestedOpener: `Hey ${profileData.firstName ?? "there"}, fellow college athlete here — would love to connect!`,
    wrestlingAngle: "athlete background",
    headline: profileData.headline,
    about: profileData.about,
  });
}

export async function generateReply(
  config: LlmConfig,
  input: GenerateReplyInput
): Promise<AgentReply & { guardrailBlocked?: boolean; guardrailReason?: string }> {
  const system = compileSystemPrompt(
    input.agencyBasePrompt,
    input.playbook,
    input.stage
  );

  const vars: Record<string, string> = {
    firstName: input.prospect.firstName ?? "there",
    lastName: input.prospect.lastName ?? "",
    school: input.prospect.school ?? "your program",
    wrestlingHook:
      input.profileSummary?.wrestlingAngle ??
      input.profileSummary?.hooks?.[0] ??
      "your athletic background",
    calendlyUrl: input.playbook.stages.call_offered.calendlyUrl ?? "",
  };

  const user = JSON.stringify(
    {
      stage: input.stage,
      profileSummary: input.profileSummary,
      recentMessages: input.messages.slice(-10),
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
      nextStage: input.stage === "profile_analyzed" ? "connect_sent" : "conversing",
      messageText: interpolateTemplate(template, vars),
      reasoning: "Fallback template due to parse error",
      confidence: 0.5,
      shouldEscalateToHuman: false,
    };
  }

  reply.messageText = interpolateTemplate(reply.messageText, vars);

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
    hasCalendlyInThread: false,
  });
}
