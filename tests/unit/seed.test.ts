import { describe, expect, it } from "vitest";
import { generateCustomers } from "../../src/lib/seed/generate";
import {
  TOTAL_CUSTOMERS,
  TREATMENT_PATTERNS,
} from "../../src/lib/seed/patterns";
import {
  calculateConversionRate,
  calculateRebookingRate,
  filterFollowUpCustomers,
} from "../../src/lib/analytics/kpi";

const REFERENCE_DATE = "2026-08-30";

describe("generateCustomers", () => {
  const customers = generateCustomers();

  it("produces the target record count", () => {
    expect(customers).toHaveLength(TOTAL_CUSTOMERS);
    expect(TOTAL_CUSTOMERS).toBe(100);
  });

  it("is deterministic across runs", () => {
    expect(generateCustomers()).toEqual(generateCustomers());
  });

  it("respects the per-treatment record counts", () => {
    for (const pattern of TREATMENT_PATTERNS) {
      const count = customers.filter((c) => c.treatment === pattern.treatment).length;
      expect(count).toBe(pattern.count);
    }
  });

  it("keeps field invariants consistent", () => {
    for (const c of customers) {
      expect(c.satisfaction_score).toBeGreaterThanOrEqual(1);
      expect(c.satisfaction_score).toBeLessThanOrEqual(5);
      expect(c.amount_spent).toBeGreaterThanOrEqual(0);
      if (c.purchase_status === "purchased") {
        expect(c.consultation_status).toBe("completed");
        expect(c.amount_spent).toBeGreaterThan(0);
      } else {
        expect(c.amount_spent).toBe(0);
      }
      if (c.rebooked) {
        expect(c.purchase_status).toBe("purchased");
      }
    }
  });

  it("makes CoolSculpting the weakest-converting treatment (the demo money shot)", () => {
    const rateByTreatment = new Map<string, number>();
    for (const pattern of TREATMENT_PATTERNS) {
      const rows = customers.filter((c) => c.treatment === pattern.treatment);
      const completed = rows.filter((c) => c.consultation_status === "completed").length;
      const purchased = rows.filter((c) => c.purchase_status === "purchased").length;
      rateByTreatment.set(pattern.treatment, calculateConversionRate(purchased, completed));
    }

    const coolSculpting = rateByTreatment.get("CoolSculpting")!;
    const others = [...rateByTreatment.entries()].filter(([t]) => t !== "CoolSculpting");
    for (const [, rate] of others) {
      expect(coolSculpting).toBeLessThan(rate);
    }
  });

  it("makes Botox the strongest-rebooking treatment", () => {
    const rebookRate = (treatment: string): number => {
      const rows = customers.filter((c) => c.treatment === treatment);
      const purchasers = rows.filter((c) => c.purchase_status === "purchased").length;
      const rebooked = rows.filter((c) => c.rebooked).length;
      return calculateRebookingRate(rebooked, purchasers);
    };

    const botox = rebookRate("Botox");
    for (const pattern of TREATMENT_PATTERNS) {
      if (pattern.treatment === "Botox") continue;
      expect(botox).toBeGreaterThan(rebookRate(pattern.treatment));
    }
  });

  it("contains a meaningful follow-up cluster (>90 days, not rebooked)", () => {
    const now = new Date(`${REFERENCE_DATE}T00:00:00Z`);
    const followUp = filterFollowUpCustomers(customers, 90, now);
    expect(followUp.length).toBeGreaterThanOrEqual(15);
    expect(followUp.length).toBeLessThan(customers.length);
  });

  it("shifts last_visit dates when the reference date is overridden", () => {
    const shifted = generateCustomers({ referenceDate: "2025-01-01" });
    expect(shifted.map((c) => c.treatment)).toEqual(customers.map((c) => c.treatment));
    expect(shifted[0].last_visit).not.toBe(customers[0].last_visit);
  });
});
