import { NextRequest, NextResponse } from "next/server";
import { emailSyncReport, runFullTimeSync } from "@/lib/fulltime-sync";

// Manual "sync now" trigger, protected by SYNC_SECRET. The daily scheduled
// function does the routine work; this exists for on-demand runs and testing.
export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const provided =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-sync-key");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const report = await runFullTimeSync();
  await emailSyncReport(report);
  return NextResponse.json(report);
}
