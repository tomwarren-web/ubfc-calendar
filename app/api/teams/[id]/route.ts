import { NextRequest, NextResponse } from "next/server";
import { deleteTeam } from "@/lib/db";
import { purgeTags } from "@/lib/cache";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteTeam(Number(id));
  await purgeTags(["teams", "bookings"]);
  return NextResponse.json({ ok: true });
}
