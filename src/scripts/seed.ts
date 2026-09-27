// Seeds one clinic and 100 deterministic demo customers (docs/DATABASE.md).
// Idempotent: it upserts the clinic by name and replaces that clinic's customers each run.
// Usage: `npm run seed` (requires migrations already applied — `npm run db:migrate`).
import "./env";

import { createAdminClient } from "../lib/supabase/admin";
import { generateCustomers } from "../lib/seed/generate";
import { TOTAL_CUSTOMERS } from "../lib/seed/patterns";
import { DEFAULT_DEMO_CLINIC_ID } from "../lib/demo-clinic";
import { z } from "zod";

const CLINIC_NAME = process.env.SEED_CLINIC_NAME ?? "V-Unite Aesthetic Clinic";
const CLINIC_ID = z.string().uuid().parse(
  process.env.NEXT_PUBLIC_CLINIC_ID ?? DEFAULT_DEMO_CLINIC_ID,
);
const BATCH_SIZE = 100;

async function main(): Promise<void> {
  const supabase = createAdminClient();

  const existing = await supabase
    .from("clinics")
    .select("id, name, demo_synthetic")
    .eq("id", CLINIC_ID)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data && !existing.data.demo_synthetic && process.env.SEED_REPLACE_EXISTING !== "1") {
    throw new Error(
      "Refusing to replace customers in an unverified clinic. Review its data, then set SEED_REPLACE_EXISTING=1 for this one seed run.",
    );
  }

  if (!existing.data) {
    const sameName = await supabase.from("clinics").select("id").eq("name", CLINIC_NAME).maybeSingle();
    if (sameName.error) throw sameName.error;
    if (sameName.data) {
      throw new Error(
        `Clinic name already exists under a different ID. Set NEXT_PUBLIC_CLINIC_ID to ${sameName.data.id} before seeding.`,
      );
    }
    const inserted = await supabase
      .from("clinics")
      .insert({ id: CLINIC_ID, name: CLINIC_NAME, demo_synthetic: false })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
  }

  const unmarked = await supabase.from("clinics").update({ demo_synthetic: false }).eq("id", CLINIC_ID);
  if (unmarked.error) throw unmarked.error;

  const cleared = await supabase.from("customers").delete().eq("clinic_id", CLINIC_ID);
  if (cleared.error) throw cleared.error;

  const rows = generateCustomers().map((c) => ({ ...c, clinic_id: CLINIC_ID }));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("customers").insert(batch);
    if (error) throw error;
  }

  const marked = await supabase.from("clinics").update({ demo_synthetic: true }).eq("id", CLINIC_ID);
  if (marked.error) throw marked.error;

  console.log(
    `seeded ${rows.length} customers (expected ${TOTAL_CUSTOMERS}) for clinic "${CLINIC_NAME}" (${CLINIC_ID})`,
  );
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
