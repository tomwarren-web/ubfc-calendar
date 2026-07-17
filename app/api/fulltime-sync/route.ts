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

// Temporary connectivity diagnostic: checks whether FA Full-Time is reachable
// from this runtime at all, with a control fetch for comparison.
export async function GET(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const results: Record<string, string> = {};
  const probe = async (name: string, url: string, headers?: Record<string, string>) => {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      const body = await res.text();
      results[name] = `HTTP ${res.status}, ${body.length} bytes`;
    } catch (err) {
      results[name] = `FAILED: ${String(err)} ${(err as Error)?.cause ? "cause: " + String((err as Error & { cause?: unknown }).cause) : ""}`;
    }
  };
  await probe("control-example.com", "https://example.com");
  await probe("fa-plain", "https://fulltime.thefa.com/displayTeam.html?divisionseason=30425424&teamID=836078784");
  await probe(
    "fa-browser-headers",
    "https://fulltime.thefa.com/displayTeam.html?divisionseason=30425424&teamID=836078784",
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
    }
  );
  return NextResponse.json(results);
}
