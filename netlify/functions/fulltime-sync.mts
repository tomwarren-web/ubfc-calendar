import { emailSyncReport, runFullTimeSync } from "../../lib/fulltime-sync";

// Daily at 04:30 UTC — comfortably before the Monday 06:00 digest, so the
// weekly WhatsApp email always reflects the latest FA Full-Time data.
export default async () => {
  try {
    const report = await runFullTimeSync();
    console.log("fulltime-sync:", JSON.stringify(report));
    await emailSyncReport(report);
    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fulltime-sync failed:", err);
    await emailSyncReport({
      added: [],
      updated: [],
      removed: [],
      clashes: [],
      errors: [`Sync crashed: ${String(err)}`],
      checkedTeams: 0,
    });
    return new Response("sync failed", { status: 500 });
  }
};

export const config = {
  schedule: "30 4 * * *",
};
