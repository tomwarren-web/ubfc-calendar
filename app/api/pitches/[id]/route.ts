import { NextRequest, NextResponse } from "next/server";
import { deletePitch } from "@/lib/db";
import { purgeTags } from "@/lib/cache";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await deletePitch(Number(id));
  await purgeTags(["pitches", "bookings"]);
  return NextResponse.json({ ok: true });
}
