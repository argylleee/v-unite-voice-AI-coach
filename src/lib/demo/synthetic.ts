import { createAdminClient } from "@/lib/supabase/admin";
import { demoClinicId } from "./visitor";

/** Fail closed until the configured public clinic has been explicitly seeded as synthetic. */
export async function requireSyntheticDemoClinic(): Promise<Response | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("clinics")
      .select("demo_synthetic")
      .eq("id", demoClinicId())
      .maybeSingle();
    if (error) throw error;
    if (data?.demo_synthetic === true) return null;
    return Response.json({ ok: false, error: "demo_data_unavailable" }, { status: 503 });
  } catch (err) {
    console.error("[demo] synthetic data check failed:", err);
    return Response.json({ ok: false, error: "demo_data_unavailable" }, { status: 503 });
  }
}
