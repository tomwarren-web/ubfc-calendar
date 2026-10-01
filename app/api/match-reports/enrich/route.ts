import { NextRequest, NextResponse } from "next/server";
import { enrichMatchReport } from "@/lib/db";

function authorised(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-sync-key");
  return Boolean(process.env.SYNC_SECRET) && key === process.env.SYNC_SECRET;
}

interface EnrichmentItem {
  sourceRef: string;
  lineup?: string[];
  substitutes?: string[];
  goalscorers?: string[];
  sourcePosts?: string[];
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return NextResponse.json({ error: "items array required" }, { status: 400 });
  const items = body.items.filter((item: unknown): item is EnrichmentItem => {
    if (!item || typeof item !== "object") return false;
    return /^fulltime:\d+$/.test(String((item as EnrichmentItem).sourceRef || ""));
  });
  for (const item of items) {
    await enrichMatchReport(item.sourceRef, {
      lineup: Array.isArray(item.lineup) ? item.lineup.map(String) : [],
      substitutes: Array.isArray(item.substitutes) ? item.substitutes.map(String) : [],
      goalscorers: Array.isArray(item.goalscorers) ? item.goalscorers.map(String) : [],
      sourcePosts: Array.isArray(item.sourcePosts) ? item.sourcePosts.map(String) : [],
    });
  }
  return NextResponse.json({ updated: items.length });
}
