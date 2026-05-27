import { z } from "zod";

export const StageKeySchema = z.enum([
  "connect",
  "intro",
  "conversing",
  "call_offered",
  "call_booked",
]);

export const PlaybookConfigSchema = z.object({
  brand: z.object({
    businessName: z.string(),
    senderPersona: z.string(),
    tone: z.enum(["casual", "balanced", "formal"]).default("casual"),
    wordsToInclude: z.array(z.string()).default([]),
    wordsToAvoid: z.array(z.string()).default([]),
  }),
  stages: z.object({
    connect: z.object({
      instructions: z.string(),
      exampleTemplate: z.string(),
    }),
    intro: z.object({
      instructions: z.string(),
      exampleTemplate: z.string(),
    }),
    conversing: z.object({
      instructions: z.string(),
      exampleTemplate: z.string(),
      pivotGoals: z.string().optional(),
    }),
    call_offered: z.object({
      instructions: z.string(),
      exampleTemplate: z.string(),
      calendlyUrl: z.string().optional().default(""),
    }),
    call_booked: z.object({
      instructions: z.string(),
      exampleTemplate: z.string(),
    }),
  }),
  guardrails: z.object({
    maxOutboundWithoutReply: z.number().int().min(1).max(10).default(3),
    minDelayHours: z.number().min(0).default(4),
    maxDelayHours: z.number().min(1).default(48),
    maxDailyConnections: z.number().int().min(1).default(15),
    maxDailyMessages: z.number().int().min(1).default(50),
    maxDailyProfileViews: z.number().int().min(1).default(80),
    businessHoursStart: z.number().int().min(0).max(23).default(9),
    businessHoursEnd: z.number().int().min(0).max(23).default(17),
    stopPhrases: z.array(z.string()).default([
      "not interested",
      "unsubscribe",
      "stop",
      "remove me",
    ]),
    maxConnectionNoteChars: z.number().int().default(300),
  }),
});

export type PlaybookConfig = z.infer<typeof PlaybookConfigSchema>;

export const AgentReplySchema = z.object({
  nextStage: z.enum([
    "imported",
    "profile_analyzed",
    "connect_sent",
    "connected",
    "connect_ignored",
    "intro_sent",
    "conversing",
    "call_offered",
    "call_booked",
    "opted_out",
  ]),
  messageText: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  shouldEscalateToHuman: z.boolean(),
});

export type AgentReply = z.infer<typeof AgentReplySchema>;

export const ProfileSummarySchema = z.object({
  hooks: z.array(z.string()),
  tone: z.string(),
  doNotMention: z.array(z.string()),
  suggestedOpener: z.string(),
  wrestlingAngle: z.string().optional(),
  headline: z.string().optional(),
  about: z.string().optional(),
});

export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;
