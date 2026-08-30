// Intentional demo patterns (docs/DATABASE.md). The seed generator turns these into 100
// customers whose aggregate numbers tell the story the demo scenarios in docs/PROJECT_SPEC.md
// depend on. Do not randomise these away — the "money shot" is CoolSculpting converting far
// worse than everything else.

export interface TreatmentPattern {
  treatment: string;
  /** Number of customer records for this treatment. The four counts sum to 100. */
  count: number;
  /** Fraction of records whose consultation reached "completed". */
  consultationCompletionRate: number;
  /** Fraction of completed consultations that become a purchase. */
  purchaseConversionRate: number;
  /** Fraction of purchasers who rebook. */
  rebookingRate: number;
  /** Inclusive [min, max] spend for a purchaser. */
  priceRange: [number, number];
  /** Inclusive [min, max] satisfaction score (1-5 scale). */
  satisfactionRange: [number, number];
}

export const TREATMENT_PATTERNS: readonly TreatmentPattern[] = [
  // The demo centrepiece: lots of interest, weak conversion.
  {
    treatment: "CoolSculpting",
    count: 30,
    consultationCompletionRate: 0.9,
    purchaseConversionRate: 0.28,
    rebookingRate: 0.35,
    priceRange: [1800, 3600],
    satisfactionRange: [3.2, 4.4],
  },
  // Strong performer: converts well and rebooks well.
  {
    treatment: "Botox",
    count: 28,
    consultationCompletionRate: 0.95,
    purchaseConversionRate: 0.72,
    rebookingRate: 0.8,
    priceRange: [350, 950],
    satisfactionRange: [4.2, 5.0],
  },
  // Converts moderately, but people don't come back.
  {
    treatment: "HydraFacial",
    count: 22,
    consultationCompletionRate: 0.9,
    purchaseConversionRate: 0.55,
    rebookingRate: 0.3,
    priceRange: [180, 420],
    satisfactionRange: [4.0, 4.9],
  },
  // Good conversion, weaker satisfaction.
  {
    treatment: "Laser Hair Removal",
    count: 20,
    consultationCompletionRate: 0.9,
    purchaseConversionRate: 0.62,
    rebookingRate: 0.5,
    priceRange: [600, 1500],
    satisfactionRange: [3.0, 4.0],
  },
] as const;

export const TOTAL_CUSTOMERS = TREATMENT_PATTERNS.reduce((n, p) => n + p.count, 0);

export const PROVIDERS = ["Dr. Reyes", "Dr. Santos", "Nurse Cruz", "Dr. Lim"] as const;

export const FIRST_NAMES = [
  "Maria", "Ana", "Josefa", "Cristina", "Rosario", "Luz", "Teresa", "Elena",
  "Grace", "Joy", "Angelica", "Patricia", "Isabel", "Carmen", "Divina", "Rowena",
  "Jasmine", "Katrina", "Mabel", "Nerissa",
] as const;

export const LAST_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Torres",
  "Flores", "Ramos", "Villanueva", "Aquino", "Castillo", "Salazar", "Domingo", "Navarro",
  "Panganiban", "Delos Reyes", "Espiritu", "Gonzales",
] as const;
