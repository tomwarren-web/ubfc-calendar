import { NextRequest, NextResponse } from "next/server";
import { getBookings, getMatchResults } from "@/lib/db";

const PUBLIC_TEAMS = new Set(["First Team", "Reserve Team", "Sunday Team"]);
const CLUB_NAME = "Upper Beeding";

function localKickoff(date: string, startMin: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const hour = Math.floor(startMin / 60);
  const minute = startMin % 60;
  const initial = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(initial));
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const renderedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
  );
  return new Date(initial - (renderedAsUtc - initial)).toISOString();
}

function titleParts(title = "") {
  const home = /^\s*vs\b/i.test(title);
  const [matchPart, ...detailParts] = title.split(/\s+—\s+/);
  const opponent = matchPart
    .replace(/^\s*(?:vs|at)\s+/i, "")
    .replace(/\s*\((?:home|away)\).*$/i, "")
    .trim();
  const detail = detailParts.join(" — ");
  const [competition, ...venueParts] = detail.split(/,\s+/);
  return {
    home,
    opponent,
    competition: competition || "Fixture",
    awayVenue: venueParts.join(", "),
  };
}

export async function GET(request: NextRequest) {
  const today = new Date();
  const defaultFrom = new Date(
    Date.UTC(
      today.getUTCFullYear() - 1,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);
  const defaultTo = new Date(
    Date.UTC(
      today.getUTCFullYear() + 2,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);
  const from = request.nextUrl.searchParams.get("from") || defaultFrom;
  const to = request.nextUrl.searchParams.get("to") || defaultTo;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "Dates must use YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const [bookings, results] = await Promise.all([
    getBookings(from, to),
    getMatchResults(from, to),
  ]);
  const completedRefs = new Set(results.map((result) => result.sourceRef));
  const fixtures = bookings
    .filter(
      (booking) =>
        booking.type === "fixture" &&
        PUBLIC_TEAMS.has(booking.teamName) &&
        booking.sourceRef?.startsWith("fulltime:") &&
        !completedRefs.has(booking.sourceRef),
    )
    .map((booking) => {
      const parts = titleParts(booking.title || "");
      return {
        id: booking.sourceRef,
        date: localKickoff(booking.date, booking.startMin),
        team: booking.teamName,
        home: parts.home ? CLUB_NAME : parts.opponent,
        away: parts.home ? parts.opponent : CLUB_NAME,
        competition: parts.competition,
        venue:
          booking.pitchName ||
          parts.awayVenue ||
          (parts.home ? "Memorial Field" : "Away"),
        source: "UBFC Calendar / FA Full-Time",
      };
    });
  const completed = results
    .filter((result) => PUBLIC_TEAMS.has(result.teamName))
    .map((result) => ({
      id: result.sourceRef,
      date: localKickoff(result.date, result.startMin),
      team: result.teamName,
      home: result.homeTeam,
      away: result.awayTeam,
      competition: result.competition || "Fixture",
      venue: result.venue,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      source: "UBFC Calendar / FA Full-Time",
    }));

  return NextResponse.json(
    {
      matches: [...completed, ...fixtures],
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control":
          "public, durable, s-maxage=300, stale-while-revalidate=86400",
        "Netlify-Vary": "query",
        "Cache-Tag": "bookings,match-results",
      },
    },
  );
}
