import { describe, expect, it } from "vitest";
import {
  calculateAverageSpend,
  calculateConversionRate,
  calculateRebookingRate,
  filterFollowUpCustomers,
  getDaysSinceVisit,
} from "../../src/lib/analytics/kpi";

describe("calculateConversionRate", () => {
  it("matches the docs/TESTING.md example", () => {
    expect(calculateConversionRate(7, 24)).toBeCloseTo(29.17);
  });

  it("returns 0 when there are no consultations", () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
  });

  it("handles a perfect conversion", () => {
    expect(calculateConversionRate(10, 10)).toBe(100);
  });
});

describe("calculateRebookingRate", () => {
  it("computes a percentage", () => {
    expect(calculateRebookingRate(12, 30)).toBe(40);
  });

  it("returns 0 with no purchasers", () => {
    expect(calculateRebookingRate(0, 0)).toBe(0);
  });
});

describe("calculateAverageSpend", () => {
  it("averages the amounts", () => {
    expect(calculateAverageSpend([100, 200, 300])).toBe(200);
  });

  it("returns 0 for an empty list", () => {
    expect(calculateAverageSpend([])).toBe(0);
  });

  it("rounds to two decimal places", () => {
    expect(calculateAverageSpend([10, 10, 10.01])).toBeCloseTo(10);
  });
});

describe("getDaysSinceVisit", () => {
  const now = new Date("2026-08-30T00:00:00Z");

  it("counts whole days", () => {
    expect(getDaysSinceVisit("2026-08-20", now)).toBe(10);
  });

  it("clamps future dates to 0", () => {
    expect(getDaysSinceVisit("2026-09-10", now)).toBe(0);
  });
});

describe("filterFollowUpCustomers", () => {
  const now = new Date("2026-08-30T00:00:00Z");

  it("keeps only lapsed, not-rebooked customers", () => {
    const customers = [
      { last_visit: "2026-01-01", rebooked: false }, // lapsed, not rebooked -> keep
      { last_visit: "2026-01-01", rebooked: true }, // lapsed but rebooked -> drop
      { last_visit: "2026-08-15", rebooked: false }, // recent -> drop
    ];
    expect(filterFollowUpCustomers(customers, 90, now)).toEqual([
      { last_visit: "2026-01-01", rebooked: false },
    ]);
  });
});
