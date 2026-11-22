import type { Plan } from "./plans";
import { store } from "./store";

/**
 * Usage metering for billing. Every successful, billable tool call adds one
 * unit to the customer's monthly counter (total and per tool).
 *
 * To charge real money, send the same event to your billing provider's meter:
 * set BILLING_METER_URL and this posts each usage event there (for example a
 * small function that forwards to Stripe Billing Meters, or that totals usage
 * for a monthly Paystack/Yoco invoice). Failures never block the tool call.
 */
export function billingPeriod(now = new Date()) {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

export async function recordUsage(opts: { customerId: string; email: string; tool: string; plan: Plan; units?: number }) {
  const units = opts.units ?? 1;
  const period = billingPeriod();
  const ttl = 60 * 60 * 24 * 400; // keep ~13 months for invoices and disputes

  await store.incr(`usage:${opts.customerId}:${period}`, units, ttl);
  await store.incr(`usage:${opts.customerId}:${period}:${opts.tool}`, units, ttl);

  const meterUrl = process.env.BILLING_METER_URL;
  if (meterUrl && opts.plan.priceZarPerCall > 0) {
    // Awaited (with a short timeout): serverless functions may freeze once the response is sent.
    await fetch(meterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BILLING_METER_TOKEN ?? ""}` },
      body: JSON.stringify({
        event: "mcp.tool_call",
        customer: opts.customerId,
        tool: opts.tool,
        units,
        unitPriceZar: opts.plan.priceZarPerCall,
        period,
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(1500),
    }).catch((err) => console.error("billing meter post failed", err));
  }
}

export async function usageSummary(customerId: string, plan: Plan) {
  const period = billingPeriod();
  const calls = Number((await store.get(`usage:${customerId}:${period}`)) ?? 0);
  return {
    period,
    calls,
    estimatedChargeZar: Math.round(calls * plan.priceZarPerCall * 100) / 100,
  };
}
