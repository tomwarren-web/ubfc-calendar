import { NextRequest, NextResponse } from "next/server";
import { addTeam, getTeams } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await getTeams());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const colour =
    typeof body?.colour === "string" && /^#[0-9a-fA-F]{6}$/.test(body.colour)
      ? body.colour
      : "#2563eb";
  if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  try {
    return NextResponse.json(await addTeam(name, colour), { status: 201 });
  } catch {
    return NextResponse.json({ error: "A team with that name already exists" }, { status: 409 });
  }
}
