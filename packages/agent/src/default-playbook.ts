import type { PlaybookConfig } from "@linkedin-agent/shared";

export const DEFAULT_WRESTLER_PLAYBOOK: PlaybookConfig = {
  brand: {
    businessName: "Athlete Career Coaching",
    senderPersona: "former college wrestler who helps athletes transition careers",
    tone: "casual",
    wordsToInclude: ["wrestling", "athlete", "grit"],
    wordsToAvoid: ["guaranteed", "free money", "limited time offer"],
  },
  stages: {
    connect: {
      instructions:
        "Write a short connection note (max 300 chars). Reference their wrestling or college athlete background with one specific profile hook. Sound like a fellow athlete, not a salesperson.",
      exampleTemplate:
        "Hey {{firstName}}, fellow college athlete here — saw you wrestled at {{school}}. Would love to connect!",
    },
    intro: {
      instructions:
        "Thank them for connecting. Ask an open question about their wrestling experience. Keep it warm and under 400 characters.",
      exampleTemplate:
        "Glad we connected, {{firstName}}! How was your wrestling experience?",
    },
    conversing: {
      instructions:
        "Empathize with their reply. Ask one light follow-up question. Only pivot toward a call if they show positive engagement (2+ friendly replies). Never be pushy.",
      exampleTemplate:
        "That's awesome — {{wrestlingHook}}. What are you focused on now after competing?",
      pivotGoals:
        "Understand their current goals, build rapport, then naturally suggest a short call.",
    },
    call_offered: {
      instructions:
        "Offer a brief 15-min call to share how you've helped other athletes. Include the Calendly link once. Keep under 500 characters.",
      exampleTemplate:
        "Would love to hear more on a quick call — here's my calendar: {{calendlyUrl}}",
      calendlyUrl: "",
    },
    call_booked: {
      instructions: "Thank them for booking. Confirm enthusiasm. No further selling.",
      exampleTemplate:
        "Looking forward to our chat, {{firstName}}! Talk soon.",
    },
  },
  guardrails: {
    maxOutboundWithoutReply: 3,
    minDelayHours: 4,
    maxDelayHours: 48,
    maxDailyConnections: 15,
    maxDailyMessages: 50,
    maxDailyProfileViews: 80,
    businessHoursStart: 9,
    businessHoursEnd: 17,
    stopPhrases: ["not interested", "unsubscribe", "stop", "remove me", "don't contact"],
    maxConnectionNoteChars: 300,
  },
};
