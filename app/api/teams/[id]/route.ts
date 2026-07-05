import { NextRequest, NextResponse } from "next/server";
import { deleteTeam } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteTeam(Number(id));
  return NextResponse.json({ ok: true });
}
