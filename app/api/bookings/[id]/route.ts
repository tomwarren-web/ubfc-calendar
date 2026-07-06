import { NextRequest, NextResponse } from "next/server";
import { deleteBooking, findClashes, getBooking, updateBooking } from "@/lib/db";
import { parseBookingInput } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const bookingId = Number(id);
  if (!(await getBooking(bookingId))) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const input = parseBookingInput(body);
  if (typeof input === "string") {
    return NextResponse.json({ error: input }, { status: 400 });
  }

  if (input.pitchId !== null) {
    const clashes = await findClashes(
      input.pitchId,
      input.date,
      input.startMin,
      input.endMin,
      bookingId
    );
    if (clashes.length > 0) {
      return NextResponse.json({ error: "clash", clashes }, { status: 409 });
    }
  }

  return NextResponse.json(await updateBooking(bookingId, input));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const bookingId = Number(id);
  if (!(await getBooking(bookingId))) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  await deleteBooking(bookingId);
  return NextResponse.json({ ok: true });
}
