import { store } from "./store";

/**
 * Audit trail: one structured line per tool call, answering "who called what,
 * through which client, when, with what outcome, how fast".
 *
 * - Goes to stdout as JSON (Vercel Logs, or any log drain: Datadog, Axiom...)
 * - Also kept per customer (last 200) so the customer can see their own history
 * - Arguments are hashed, not stored: you can prove two calls were identical
 *   without keeping personal data you don't need (POPIA data minimisation)
 */
export interface AuditEvent {
  ts: string;
  requestId: string | number;
  customerId: string;
  email: string;
  clientId: string;
  clientName: string;
  tool: string;
  argsSha256: string;
  outcome: "ok" | "error" | "rate_limited";
  latencyMs: number;
  plan: string;
}

export async function hashArgs(args: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(args ?? {})));
  return Buffer.from(digest).toString("hex").slice(0, 16);
}

export async function audit(event: AuditEvent): Promise<void> {
  console.log(JSON.stringify({ type: "mcp.audit", ...event }));
  try {
    await store.pushCapped(`audit:${event.customerId}`, JSON.stringify(event), 200);
  } catch (err) {
    console.error("audit store write failed", err); // never fail the tool call because of the audit sink
  }
}

export async function recentAudit(customerId: string, count = 10): Promise<AuditEvent[]> {
  return (await store.list(`audit:${customerId}`, count)).map((s) => JSON.parse(s) as AuditEvent);
}
