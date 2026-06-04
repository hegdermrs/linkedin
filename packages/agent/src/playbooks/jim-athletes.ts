import type { PlaybookConfig } from "@linkedin-agent/shared";
import { JIM_ATHLETES_SEQUENCE } from "./jim-sequence-guide.js";

const ATHLETES_CALENDLY = "https://go.jimharshawjr.com/vsl";

export const JIM_ATHLETES_PLAYBOOK: PlaybookConfig = {
  niche: "jim-athletes",
  senderName: "Jim",
  sequenceGuide: JIM_ATHLETES_SEQUENCE,
  brand: {
    businessName: "Reveal Your Path — Jim Harshaw Jr.",
    senderPersona:
      "Jim Harshaw Jr. — former college athlete (wrestled at UVA, coached collegiately); peer who gets the college athlete experience",
    tone: "casual",
    wordsToInclude: [
      "college athlete",
      "former college athletes",
      "competitive edge",
      "another gear",
      "moving the needle",
      "simple framework",
      "No obligations, of course!",
      "Jim",
    ],
    wordsToAvoid: [
      "synergy",
      "leverage",
      "value proposition",
      "my friend",
      "guaranteed",
      "Were you able to find a time on my calendar",
      "players",
      "clients",
    ],
  },
  stages: {
    connect: {
      instructions:
        "Stage 0 (athletes). Short 'Fellow college athlete here!' OR personalized opener: former college athlete, UVA wrestler, coached ~10 years, what sport did you play? Use profile sport/school.",
      exampleTemplate:
        "Hi {{firstName}}, glad we connected. I'm a former college athlete — wrestled at Virginia and coached collegiately. What sport did you play?",
    },
    intro: {
      instructions:
        "Stage 0–1 (athletes). After accept: ask sport/experience if needed, then Stage 1 pain bridge. Do not fake sport-specific expertise Jim lacks. Universal structure: coach, team, scoreboard gone in real world.",
      exampleTemplate:
        "Glad we connected, {{firstName}}! Fellow college athlete here. What sport did you play — and how was the experience?",
    },
    conversing: {
      instructions:
        "Stages 1, 2, 2B, 2C, 4a, 4b, 5, 6, 7 (athletes). Include 2C if they reject pain — validate, pivot to curiosity call. Otherwise same flow as wrestlers but 'former college athletes' language. Respect their sport; ask when unsure.",
      exampleTemplate:
        "{{firstName}}, competing at {{school}} says a lot. I talk to former college athletes who are successful but still feel another gear inside. Do you ever feel that way?",
      pivotGoals:
        "Athletic identity → pain or 2C pivot → Reveal Your Path call → calendar.",
    },
    call_offered: {
      instructions: "Stage 3 (athletes). EST slots + {{calendlyUrl}}. Sign Jim.",
      exampleTemplate:
        "Perfect — here are some EST options. Or grab a time here: {{calendlyUrl}} Looking forward to it, {{firstName}}! Jim",
      calendlyUrl: ATHLETES_CALENDLY,
    },
    call_booked: {
      instructions: "Thank for booking. Brief. Sign Jim.",
      exampleTemplate: "Looking forward to our chat, {{firstName}}! Jim",
    },
  },
  guardrails: {
    maxOutboundWithoutReply: 3,
    minDelayHours: 4,
    maxDelayHours: 168,
    maxDailyConnections: 15,
    maxDailyMessages: 50,
    maxDailyProfileViews: 80,
    businessHoursStart: 8,
    businessHoursEnd: 20,
    stopPhrases: [
      "not interested",
      "unsubscribe",
      "stop",
      "remove me",
      "don't contact",
    ],
    maxConnectionNoteChars: 300,
    followUpDelayHours: 120,
    secondFollowUpDelayHours: 168,
    maxSentencesPerMessage: 6,
    requireSenderSignOff: true,
  },
};
