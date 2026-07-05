import type { BookingInput } from "./db";

/** Returns a validated BookingInput, or an error message string. */
export function parseBookingInput(body: Record<string, unknown>): BookingInput | string {
  // pitchId of null (or 0) means "no pitch required" — training or an away/off-site
  // booking that appears on the calendar but can never clash.
  const pitchId = body.pitchId === null || body.pitchId === 0 ? null : Number(body.pitchId);
  const teamId = Number(body.teamId);
  const type = body.type;
  const date = body.date;
  const startMin = Number(body.startMin);
  const endMin = Number(body.endMin);
  const bookedBy = typeof body.bookedBy === "string" ? body.bookedBy.trim() : "";
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

  if (pitchId !== null && (!Number.isInteger(pitchId) || pitchId <= 0))
    return "A pitch must be selected";
  if (!Number.isInteger(teamId) || teamId <= 0) return "A team must be selected";
  if (type !== "fixture" && type !== "training") return "Type must be fixture or training";
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Invalid date";
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) return "Invalid times";
  if (startMin < 0 || endMin > 24 * 60 || endMin <= startMin)
    return "End time must be after start time";
  if (!bookedBy) return "Your name is required";

  return { pitchId, teamId, type, title, date, startMin, endMin, bookedBy };
}
