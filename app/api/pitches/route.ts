import { NextRequest, NextResponse } from "next/server";
import { addPitch, getPitches } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await getPitches());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Pitch name is required" }, { status: 400 });
  try {
    return NextResponse.json(await addPitch(name), { status: 201 });
  } catch {
    return NextResponse.json({ error: "A pitch with that name already exists" }, { status: 409 });
  }
}
