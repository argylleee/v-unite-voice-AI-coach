import type { SeedCustomer } from "../../types/customer";
import {
  FIRST_NAMES,
  LAST_NAMES,
  PROVIDERS,
  TREATMENT_PATTERNS,
} from "./patterns";

// Fixed seed so re-running the generator never quietly changes the demo story (docs/DATABASE.md).
const RANDOM_SEED = 0x5e_ed_12_34;

// Reference "today" for the generated last_visit dates. Fixed so the lapsed-customer cluster
// stays put regardless of when the seed script is actually run.
const REFERENCE_DATE = "2026-08-30";

/** Deterministic PRNG (mulberry32). Returns a float in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface GenerateOptions {
  /** Override the reference date used for last_visit calculations (ISO `YYYY-MM-DD`). */
  referenceDate?: string;
}

/**
 * Generate the full deterministic demo customer set (100 records) with the intentional
 * conversion / rebooking / recency patterns from docs/DATABASE.md.
 */
export function generateCustomers(options: GenerateOptions = {}): SeedCustomer[] {
  const rand = mulberry32(RANDOM_SEED);
  const referenceDate = options.referenceDate ?? REFERENCE_DATE;
  const customers: SeedCustomer[] = [];
  let index = 0;

  for (const pattern of TREATMENT_PATTERNS) {
    for (let n = 0; n < pattern.count; n += 1, index += 1) {
      const first = pick(rand, FIRST_NAMES);
      const last = pick(rand, LAST_NAMES);
      const provider = pick(rand, PROVIDERS);

      const consultationCompleted = rand() < pattern.consultationCompletionRate;
      const consultation_status = consultationCompleted
        ? "completed"
        : rand() < 0.5
          ? "no_show"
          : "scheduled";

      const purchased =
        consultationCompleted && rand() < pattern.purchaseConversionRate;
      const purchase_status = purchased ? "purchased" : "not_purchased";

      const [minPrice, maxPrice] = pattern.priceRange;
      const amount_spent = purchased
        ? round(minPrice + rand() * (maxPrice - minPrice), 2)
        : 0;

      const rebooked = purchased && rand() < pattern.rebookingRate;

      // ~40% of not-rebooked customers land in the ">90 days, no rebooking" follow-up cluster.
      const lapsed = !rebooked && rand() < 0.4;
      const daysAgo = lapsed
        ? 95 + Math.floor(rand() * 240)
        : 1 + Math.floor(rand() * 88);
      const last_visit = addDays(referenceDate, -daysAgo);

      const [minSat, maxSat] = pattern.satisfactionRange;
      const satisfaction_score = round(minSat + rand() * (maxSat - minSat), 1);

      customers.push({
        name: `${first} ${last}`,
        email: `${first}.${last}.${index + 1}@example.com`
          .toLowerCase()
          .replace(/\s+/g, ""),
        phone: `+63917${String(1_000_000 + Math.floor(rand() * 8_999_999))}`,
        treatment: pattern.treatment,
        provider,
        consultation_status,
        purchase_status,
        amount_spent,
        last_visit,
        rebooked,
        satisfaction_score,
        notes: null,
      });
    }
  }

  return customers;
}
