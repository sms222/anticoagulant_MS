import { createServerClient } from "./server";

// A visit timer left running past this long is treated as the pharmacist
// having forgotten to end the appointment, not a genuinely long visit. There's
// no background worker in this deployment to sweep these on a schedule, so
// this runs opportunistically wherever appointment data is read (the
// dashboard queue and the patient page) — each read self-heals anything
// that's gone stale since the last read, rather than relying on a cron job
// that doesn't exist here.
const STALE_VISIT_MS = 2 * 60 * 60 * 1000;

export async function autoStopStaleVisits(supabase: ReturnType<typeof createServerClient>) {
  const cutoff = new Date(Date.now() - STALE_VISIT_MS).toISOString();
  const { data: stale } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "with_pharmacist")
    .lt("visit_started_at", cutoff);
  if (!stale || stale.length === 0) return;
  // Discarded, not banked — a >2h runaway timer is treated as bad data, not
  // a real visit duration, so it's reset to zero rather than preserved.
  await supabase
    .from("appointments")
    .update({ status: "checked_in", visit_started_at: null, visit_elapsed_seconds: 0 })
    .in(
      "id",
      stale.map((s) => s.id)
    );
}
