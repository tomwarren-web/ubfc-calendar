import { NextRequest, NextResponse } from "next/server";
import {
  getBookings,
  getMatchContacts,
  lookupOppositionEmail,
  upsertMatchContacts,
  type MatchContacts,
} from "@/lib/db";
import { deriveOpposition, isConfirmableHomeFixture } from "@/lib/matchday";
import { addDays, toDateStr } from "@/lib/time";

// Upcoming home fixtures (next 28 days) with their confirmation contacts.
// Opposition emails pre-fill from the season directory when not yet saved.
export async function GET() {
  const from = toDateStr(new Date());
  const to = toDateStr(addDays(new Date(), 28));
  const bookings = await getBookings(from, to);

  const homeFixtures = bookings.filter(isConfirmableHomeFixture);
  const contacts = await getMatchContacts(homeFixtures.map((b) => b.id));
  const byId = new Map(contacts.map((c) => [c.bookingId, c]));

  const result = [];
  for (const b of homeFixtures) {
    let c = byId.get(b.id);
    if (!c) {
      const oppositionName = deriveOpposition(b.title);
      c = {
        bookingId: b.id,
        refereeName: "",
        refereeEmail: "",
        oppositionName,
        oppositionEmail: oppositionName ? await lookupOppositionEmail(oppositionName) : "",
        league: "",
        notes: "",
      };
    }
    // Other home games the same day feed the "also at home" line
    const sameDay = homeFixtures.filter((o) => o.date === b.date && o.id !== b.id);
    result.push({ booking: b, contacts: c, sameDayHomeGames: sameDay });
  }

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.bookingId !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const mc: MatchContacts = {
    bookingId: body.bookingId,
    refereeName: String(body.refereeName ?? ""),
    refereeEmail: String(body.refereeEmail ?? ""),
    oppositionName: String(body.oppositionName ?? ""),
    oppositionEmail: String(body.oppositionEmail ?? ""),
    league: String(body.league ?? ""),
    notes: String(body.notes ?? ""),
  };
  await upsertMatchContacts(mc);
  return NextResponse.json({ ok: true });
}
