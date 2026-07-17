import type { BookingWithNames } from "./types";
import { formatMin, formatWeekLabel, toDateStr, weekDays } from "./time";

const SITE_URL = "https://ubfc-calendar.netlify.app";

/**
 * Compose the displayed week's events as a WhatsApp-formatted message
 * (asterisks = bold). Identical bookings covering several pitches (e.g. cricket
 * ground closures) are collapsed into a single line.
 */
export function composeWeekShareText(
  bookings: BookingWithNames[],
  weekStart: Date
): string {
  const lines: string[] = [`⚽ *UBFC — ${formatWeekLabel(weekStart)}*`];

  for (const day of weekDays(weekStart)) {
    const dateStr = toDateStr(day);
    const dayBookings = bookings
      .filter((b) => b.date === dateStr)
      .sort((a, b) => a.startMin - b.startMin);

    // Collapse duplicates that differ only by pitch (cricket blocks both pitches)
    const grouped = new Map<string, { booking: BookingWithNames; pitches: (string | null)[] }>();
    for (const b of dayBookings) {
      const key = `${b.startMin}|${b.endMin}|${b.teamId}|${b.type}|${b.title ?? ""}`;
      const entry = grouped.get(key);
      if (entry) entry.pitches.push(b.pitchName);
      else grouped.set(key, { booking: b, pitches: [b.pitchName] });
    }

    if (grouped.size === 0) continue;

    lines.push("");
    lines.push(
      `*${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}*`
    );
    for (const { booking: b, pitches } of grouped.values()) {
      const time = `${formatMin(b.startMin)}–${formatMin(b.endMin)}`;
      const what = b.title
        ? `${b.teamName} — ${b.title}`
        : `${b.teamName} ${b.type === "training" ? "training" : "fixture"}`;
      let where = "";
      if (pitches.length > 1) where = " (all pitches)";
      else if (pitches[0]) where = ` (${pitches[0]})`;
      lines.push(`• ${time} ${what}${where}`);
    }
  }

  if (lines.length === 1) lines.push("", "No events this week.");
  lines.push("", `Full calendar: ${SITE_URL}`);
  return lines.join("\n");
}

/** WhatsApp share URL with the message pre-filled. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
