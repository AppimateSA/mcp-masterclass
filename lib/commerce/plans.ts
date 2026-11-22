import { store } from "./store";

/**
 * Plans: what a customer may do and what it costs. Prices are examples for
 * the "Sell and price" session; set your own.
 *
 *  free  - a quota to try the server, no charge
 *  pro   - higher limits, billed per tool call (usage-based)
 *
 * A customer's plan is read from the store key `plan:<customerId>`. In
 * production a billing webhook (Paystack, Stripe, Yoco...) sets it when a
 * subscription starts or ends. For the workshop, PRO_EMAILS in the
 * environment upgrades listed accounts.
 */
export interface Plan {
  id: "free" | "pro";
  label: string;
  perMinute: number;
  perDay: number;
  priceZarPerCall: number;
}

export const PLANS: Record<Plan["id"], Plan> = {
  free: { id: "free", label: "Free", perMinute: 10, perDay: 100, priceZarPerCall: 0 },
  pro: { id: "pro", label: "Pro (usage-based)", perMinute: 60, perDay: 10_000, priceZarPerCall: 0.05 },
};

export async function planFor(customerId: string, email?: string): Promise<Plan> {
  const proEmails = (process.env.PRO_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim());
  if (email && proEmails.includes(email.toLowerCase())) return PLANS.pro;
  const stored = await store.get(`plan:${customerId}`);
  return stored === "pro" ? PLANS.pro : PLANS.free;
}
