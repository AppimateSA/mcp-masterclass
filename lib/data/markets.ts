/**
 * SAMPLE DATA, for teaching only. These are illustrative numbers, not real
 * market prices. In the Build studio, swap this file for a real source
 * (a municipal fresh-produce market feed, a co-op spreadsheet, an API).
 *
 * Every record carries `asOf` and `source` so the server can report
 * provenance and freshness (see the "Operate and observe" session).
 */

export const DATA_AS_OF = "2026-11-20";
export const DATA_SOURCE = "sample-data (illustrative, not real prices)";

export const MARKETS = [
  { id: "jhb", name: "Johannesburg Fresh Produce Market", province: "Gauteng" },
  { id: "tsh", name: "Tshwane Fresh Produce Market", province: "Gauteng" },
  { id: "cpt", name: "Cape Town Market", province: "Western Cape" },
  { id: "dbn", name: "Durban Fresh Produce Market", province: "KwaZulu-Natal" },
  { id: "eln", name: "East London Fresh Produce Market", province: "Eastern Cape" },
] as const;

export type MarketId = (typeof MARKETS)[number]["id"];

export const CROPS = ["tomatoes", "potatoes", "onions", "cabbage", "carrots", "spinach"] as const;
export type Crop = (typeof CROPS)[number];

/** Average price in ZAR per kg, by crop and market (sample values). */
const PRICE_TABLE: Record<Crop, Record<MarketId, number>> = {
  tomatoes: { jhb: 14.2, tsh: 13.8, cpt: 15.9, dbn: 14.9, eln: 15.4 },
  potatoes: { jhb: 8.1, tsh: 7.9, cpt: 9.2, dbn: 8.6, eln: 8.8 },
  onions: { jhb: 9.4, tsh: 9.1, cpt: 10.3, dbn: 9.8, eln: 10.1 },
  cabbage: { jhb: 5.2, tsh: 5.0, cpt: 6.1, dbn: 5.6, eln: 5.3 },
  carrots: { jhb: 7.6, tsh: 7.3, cpt: 8.4, dbn: 7.9, eln: 8.2 },
  spinach: { jhb: 18.5, tsh: 17.9, cpt: 19.8, dbn: 18.2, eln: 17.6 },
};

export interface PriceQuote {
  crop: Crop;
  marketId: MarketId;
  marketName: string;
  priceZarPerKg: number;
  asOf: string;
  source: string;
}

export function getQuote(crop: Crop, marketId: MarketId): PriceQuote {
  const market = MARKETS.find((m) => m.id === marketId)!;
  return {
    crop,
    marketId,
    marketName: market.name,
    priceZarPerKg: PRICE_TABLE[crop][marketId],
    asOf: DATA_AS_OF,
    source: DATA_SOURCE,
  };
}

export function getAllQuotes(crop: Crop): PriceQuote[] {
  return MARKETS.map((m) => getQuote(crop, m.id));
}
