import { NextRequest, NextResponse } from "next/server";
import { getMatchReports } from "@/lib/db";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") || "2026-08-01";
  const to = request.nextUrl.searchParams.get("to") || "2099-12-31";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return NextResponse.json({ error: "Dates must use YYYY-MM-DD" }, { status: 400 });
  const reports = await getMatchReports(from, to);
  return NextResponse.json({ reports, updatedAt: new Date().toISOString() }, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
      "Cache-Tag": "match-reports" },
  });
}
