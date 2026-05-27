export type QueueJobName =
  | "analyze_profile"
  | "send_connect"
  | "poll_inbox"
  | "send_message"
  | "check_connection"
  | "orchestrate_tenant";

export interface QueueJobPayload {
  tenantId: string;
  prospectId?: string;
  linkedInAccountId?: string;
  messageText?: string;
  idempotencyKey?: string;
}
