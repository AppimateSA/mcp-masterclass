import type { AuthInfo, CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import { audit, hashArgs } from "./audit";
import { recordUsage } from "./billing";
import { planFor } from "./plans";
import { checkRateLimit } from "./ratelimit";

/**
 * The commercial layer, in one wrapper. For every tool call:
 *   1. IDENTIFY  the customer from the verified access token
 *   2. LIMIT     by their plan (per minute, per day)
 *   3. RUN       the tool
 *   4. AUDIT     who / what / when / outcome / latency
 *   5. BILL      one unit of usage, only when the call succeeded
 */

export interface Customer {
  customerId: string; // "google:<sub>": stable even if the email changes
  email: string;
  name?: string;
  clientId: string; // which MCP client app made the call
  clientName?: string; // e.g. "Claude", "Visual Studio Code"
}

export function customerFrom(ctx: ServerContext): Customer {
  const auth = ctx.http?.authInfo as AuthInfo | undefined;
  const extra = (auth?.extra ?? {}) as { sub?: string; email?: string; name?: string; clientName?: string };
  if (!auth || !extra.sub) throw new Error("Unauthenticated call reached a metered tool");
  return { customerId: extra.sub, email: extra.email ?? "", name: extra.name, clientId: auth.clientId, clientName: extra.clientName };
}

export function metered<Args, R extends CallToolResult>(
  tool: string,
  handler: (args: Args, ctx: ServerContext) => Promise<R>,
  opts: { billable?: boolean } = {},
) {
  const billable = opts.billable ?? true;

  return async (args: Args, ctx: ServerContext): Promise<R | CallToolResult> => {
    const started = Date.now();
    const customer = customerFrom(ctx);
    const plan = await planFor(customer.customerId, customer.email);
    const base = {
      ts: new Date().toISOString(),
      requestId: ctx.mcpReq.id,
      customerId: customer.customerId,
      email: customer.email,
      clientId: customer.clientId,
      clientName: customer.clientName ?? "unknown",
      tool,
      argsSha256: await hashArgs(args),
      plan: plan.id,
    };

    if (billable) {
      const limit = await checkRateLimit(customer.customerId, plan);
      if (!limit.allowed) {
        await audit({ ...base, outcome: "rate_limited", latencyMs: Date.now() - started });
        // A tool-level error (isError) rather than a protocol error, so the
        // model can read it and tell the user what happened and what to do.
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                `Rate limit reached on the ${plan.label} plan (${limit.limit === "minute" ? `${plan.perMinute} calls per minute` : `${plan.perDay} calls per day`}). ` +
                `Try again in ${limit.retryAfterSeconds} seconds` +
                (plan.id === "free" ? ", or upgrade to Pro for higher limits." : "."),
            },
          ],
        };
      }
    }

    try {
      const result = await handler(args, ctx);
      const outcome = result.isError ? "error" : "ok";
      await audit({ ...base, outcome, latencyMs: Date.now() - started });
      if (billable && outcome === "ok") await recordUsage({ customerId: customer.customerId, email: customer.email, tool, plan });
      return result;
    } catch (err) {
      await audit({ ...base, outcome: "error", latencyMs: Date.now() - started });
      throw err;
    }
  };
}
