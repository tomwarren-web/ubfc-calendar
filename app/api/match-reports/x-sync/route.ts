import { NextRequest, NextResponse } from "next/server";
import { enrichReportsFromX, X_ACCOUNT_HANDLE } from "@/lib/x-match-reports";

function authorised(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-sync-key");
  return Boolean(process.env.SYNC_SECRET) && key === process.env.SYNC_SECRET;
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const token = process.env.X_BEARER_TOKEN;
  if (!token) return NextResponse.json({ error: "X_BEARER_TOKEN is not configured", handle: X_ACCOUNT_HANDLE }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const from = typeof body.from === "string" ? body.from : "2026-08-01";
  const to = typeof body.to === "string" ? body.to : new Date().toISOString().slice(0, 10);
  const result = await enrichReportsFromX(token, from, to);
  return NextResponse.json({ handle: X_ACCOUNT_HANDLE, from, to, ...result });
}
