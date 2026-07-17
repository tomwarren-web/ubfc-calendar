import { NextRequest, NextResponse } from "next/server";
import { emailSyncReport, runFullTimeSync, type TeamPage } from "@/lib/fulltime-sync";
import { FULLTIME_TEAMS } from "@/lib/fulltime";

function authorised(request: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  const provided =
    request.nextUrl.searchParams.get("key") ?? request.headers.get("x-sync-key");
  return Boolean(secret) && provided === secret;
}

// Runs a sync. The GitHub Actions fetcher POSTs { pages: [{appTeam, html}] }
// because the FA's WAF blocks requests from Netlify/AWS IPs; a bare POST
// (no body) attempts direct fetching, for manual runs from unblocked networks.
export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let pages: TeamPage[] | undefined;
  const body = await request.json().catch(() => null);
  if (body && Array.isArray(body.pages)) {
    pages = body.pages.filter(
      (p: unknown): p is TeamPage =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as TeamPage).appTeam === "string" &&
        typeof (p as TeamPage).html === "string"
    );
  }

  const report = await runFullTimeSync(pages);
  await emailSyncReport(report);
  return NextResponse.json(report);
}

// Tells the external fetcher which FA Full-Time pages to pull.
export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return NextResponse.json(FULLTIME_TEAMS.map(({ appTeam, url }) => ({ appTeam, url })));
}
