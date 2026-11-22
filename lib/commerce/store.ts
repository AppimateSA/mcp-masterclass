/**
 * A tiny key-value store for counters, audit events and plans.
 *
 * With UPSTASH_REDIS_REST_URL / _TOKEN (or Vercel's KV_REST_API_URL / _TOKEN,
 * added by the Upstash integration in the Vercel Marketplace) it uses Redis
 * over HTTPS, which is shared by every serverless instance.
 * Without them it falls back to memory, which is fine on a laptop but is
 * per-instance on Vercel, so limits and usage would not add up.
 */

type Cmd = (string | number)[];

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const storeKind: "redis" | "memory" = url && token ? "redis" : "memory";

async function redis<T = unknown>(commands: Cmd[]): Promise<T[]> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const out = (await res.json()) as { result?: T; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result as T;
  });
}

// ── in-memory fallback ─────────────────────────────────────────────────────
const mem = new Map<string, { value: unknown; expires?: number }>();
const live = (k: string) => {
  const e = mem.get(k);
  if (e?.expires && e.expires < Date.now()) {
    mem.delete(k);
    return undefined;
  }
  return e;
};

export const store = {
  /** Increment a counter; set its TTL when first created. Returns the new value. */
  async incr(key: string, by = 1, ttlSeconds?: number): Promise<number> {
    if (storeKind === "redis") {
      const cmds: Cmd[] = [["INCRBY", key, by]];
      if (ttlSeconds) cmds.push(["EXPIRE", key, ttlSeconds, "NX"]);
      const [value] = await redis<number>(cmds);
      return value;
    }
    const e = live(key);
    const value = ((e?.value as number) ?? 0) + by;
    mem.set(key, { value, expires: e?.expires ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined) });
    return value;
  },

  async get(key: string): Promise<string | null> {
    if (storeKind === "redis") return (await redis<string | null>([["GET", key]]))[0];
    const v = live(key)?.value;
    return v === undefined ? null : String(v);
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (storeKind === "redis") {
      await redis([ttlSeconds ? ["SET", key, value, "EX", ttlSeconds] : ["SET", key, value]]);
      return;
    }
    mem.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
  },

  /** Set only if absent. Returns true if this call set it (used for single-use codes). */
  async setOnce(key: string, ttlSeconds: number): Promise<boolean> {
    if (storeKind === "redis") return (await redis<string | null>([["SET", key, "1", "NX", "EX", ttlSeconds]]))[0] === "OK";
    if (live(key)) return false;
    mem.set(key, { value: "1", expires: Date.now() + ttlSeconds * 1000 });
    return true;
  },

  /** Push to a capped list (newest first). */
  async pushCapped(key: string, value: string, max: number): Promise<void> {
    if (storeKind === "redis") {
      await redis([["LPUSH", key, value], ["LTRIM", key, 0, max - 1]]);
      return;
    }
    const list = ((live(key)?.value as string[]) ?? []).slice(0, max - 1);
    mem.set(key, { value: [value, ...list] });
  },

  async list(key: string, count: number): Promise<string[]> {
    if (storeKind === "redis") return (await redis<string[]>([["LRANGE", key, 0, count - 1]]))[0] ?? [];
    return ((live(key)?.value as string[]) ?? []).slice(0, count);
  },
};
