// Deterministic business-metric helpers. These back the customer_analytics / customer_lookup /
// kpi_calculator tools in later phases (docs/AI_AGENT.md) and are unit-tested per docs/TESTING.md.
// The LLM must never compute these itself — that is the entire point of isolating them here.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Percentage of consultations that turned into a purchase, e.g. (7, 24) -> 29.17. */
export function calculateConversionRate(purchases: number, consultations: number): number {
  if (consultations <= 0) return 0;
  return round2((purchases / consultations) * 100);
}

/** Percentage of purchasing customers who rebooked, e.g. (12, 30) -> 40. */
export function calculateRebookingRate(rebooked: number, purchasers: number): number {
  if (purchasers <= 0) return 0;
  return round2((rebooked / purchasers) * 100);
}

/** Mean of the provided amounts. Empty input -> 0. */
export function calculateAverageSpend(amounts: number[]): number {
  if (amounts.length === 0) return 0;
  const total = amounts.reduce((sum, a) => sum + a, 0);
  return round2(total / amounts.length);
}

/** Whole days between `lastVisit` and `now` (default: current date). Future dates -> 0. */
export function getDaysSinceVisit(lastVisit: string | Date, now: Date = new Date()): number {
  const then = typeof lastVisit === "string" ? new Date(`${lastVisit}T00:00:00Z`) : lastVisit;
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return NaN;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

interface FollowUpCandidate {
  last_visit: string | Date;
  rebooked: boolean;
}

/** Customers who haven't visited in `>thresholdDays` and have not rebooked. */
export function filterFollowUpCustomers<T extends FollowUpCandidate>(
  customers: T[],
  thresholdDays = 90,
  now: Date = new Date(),
): T[] {
  return customers.filter(
    (c) => !c.rebooked && getDaysSinceVisit(c.last_visit, now) > thresholdDays,
  );
}
