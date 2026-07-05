import { NextRequest, NextResponse } from "next/server";
import { deletePitch } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  deletePitch(Number(id));
  return NextResponse.json({ ok: true });
}
