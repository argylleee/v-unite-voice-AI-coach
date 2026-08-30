// Seeds one clinic and 100 deterministic demo customers (docs/DATABASE.md).
// Idempotent: it upserts the clinic by name and replaces that clinic's customers each run.
// Usage: `npm run seed` (requires migrations already applied — `npm run db:migrate`).
import "./env";

import { createAdminClient } from "../lib/supabase/admin";
import { generateCustomers } from "../lib/seed/generate";
import { TOTAL_CUSTOMERS } from "../lib/seed/patterns";

const CLINIC_NAME = process.env.SEED_CLINIC_NAME ?? "V-Unite Aesthetic Clinic";
const BATCH_SIZE = 100;

async function main(): Promise<void> {
  const supabase = createAdminClient();

  const existing = await supabase
    .from("clinics")
    .select("id")
    .eq("name", CLINIC_NAME)
    .maybeSingle();
  if (existing.error) throw existing.error;

  let clinicId = existing.data?.id as string | undefined;
  if (!clinicId) {
    const inserted = await supabase
      .from("clinics")
      .insert({ name: CLINIC_NAME })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;
    clinicId = inserted.data.id as string;
  }

  const cleared = await supabase.from("customers").delete().eq("clinic_id", clinicId);
  if (cleared.error) throw cleared.error;

  const rows = generateCustomers().map((c) => ({ ...c, clinic_id: clinicId }));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("customers").insert(batch);
    if (error) throw error;
  }

  console.log(
    `seeded ${rows.length} customers (expected ${TOTAL_CUSTOMERS}) for clinic "${CLINIC_NAME}" (${clinicId})`,
  );
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
