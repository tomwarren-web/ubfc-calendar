import { NextRequest, NextResponse } from "next/server";
import { backfillMatchReports } from "@/lib/db";

function authorised(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-sync-key");
  return Boolean(process.env.SYNC_SECRET) && key === process.env.SYNC_SECRET;
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const from = typeof body.from === "string" ? body.from : "2026-08-01";
  const to = typeof body.to === "string" ? body.to : "2099-12-31";
  const created = await backfillMatchReports(from, to);
  return NextResponse.json({ created, from, to });
}
