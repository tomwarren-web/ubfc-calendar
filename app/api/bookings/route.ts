import { NextRequest, NextResponse } from "next/server";
import { createBooking, findClashes, getBookings } from "@/lib/db";
import { parseBookingInput } from "@/lib/validate";
import { notifyBookingChange } from "@/lib/notify";
import { cachedJson, purgeTags } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params are required" }, { status: 400 });
  }
  return cachedJson(await getBookings(from, to), "bookings");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const input = parseBookingInput(body);
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }

  if (input.pitchId !== null) {
    const clashes = await findClashes(input.pitchId, input.date, input.startMin, input.endMin);
    if (clashes.length > 0) {
      return NextResponse.json({ error: "clash", clashes }, { status: 409 });
    }
  }

  const created = await createBooking(input);
  await purgeTags(["bookings"]);
  await notifyBookingChange("added", created);
  return NextResponse.json(created, { status: 201 });
}
