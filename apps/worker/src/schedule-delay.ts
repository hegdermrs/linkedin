import type { PlaybookConfig } from "@linkedin-agent/shared";

export function nextDelayHours(
  playbook: PlaybookConfig,
  opts: {
    hasInboundEver: boolean;
    followUpCount: number;
  }
): number {
  const g = playbook.guardrails;
  if (opts.hasInboundEver) {
    return g.minDelayHours;
  }
  if (opts.followUpCount >= 2) {
    return g.secondFollowUpDelayHours ?? 168;
  }
  if (opts.followUpCount >= 1) {
    return g.followUpDelayHours ?? 120;
  }
  return g.minDelayHours;
}
