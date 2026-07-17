import type { BookingWithNames } from "./types";
import { formatMin } from "./time";

const SITE = "https://ubfc-calendar.netlify.app";

type ChangeAction = "added" | "edited" | "removed";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function describe(b: BookingWithNames): string {
  const when = `${formatDate(b.date)}, ${formatMin(b.startMin)}–${formatMin(b.endMin)}`;
  const where = b.pitchName ?? "Off-site / no pitch";
  const kind = b.type === "fixture" ? "Fixture" : "Training";
  const detail = b.title ? ` — ${b.title}` : "";
  return `${b.teamName} · ${kind}${detail}\n${when}\n${where}\nBooked by ${b.bookedBy}`;
}

function describeHtml(b: BookingWithNames): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const when = `${formatDate(b.date)}, ${formatMin(b.startMin)}–${formatMin(b.endMin)}`;
  const where = b.pitchName ?? "Off-site / no pitch";
  const kind = b.type === "fixture" ? "Fixture" : "Training";
  const rows: Array<[string, string]> = [
    ["Team", b.teamName],
    ["Type", kind],
    ...(b.title ? ([["Details", b.title]] as Array<[string, string]>) : []),
    ["When", when],
    ["Location", where],
    ["Booked by", b.bookedBy],
  ];
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;vertical-align:top;">${label}</td>` +
        `<td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${esc(value)}</td></tr>`
    )
    .join("");
}

/**
 * Emails a booking-change notification. Fire-and-forget from the caller's point
 * of view: any failure is logged and swallowed so it never breaks the booking
 * operation itself. No-ops if email isn't configured.
 */
export async function notifyBookingChange(
  action: ChangeAction,
  booking: BookingWithNames
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_NOTIFY_EMAIL ?? process.env.NUDGE_EMAIL;
  if (!apiKey || !to) return;

  const verb = { added: "added", edited: "edited", removed: "removed" }[action];
  const accent = { added: "#16a34a", edited: "#f5e731", removed: "#dc2626" }[action];
  const accentText = action === "edited" ? "#002e4c" : "#ffffff";

  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
      <div style="background: #002e4c; border-bottom: 4px solid #f5e731; padding: 16px 20px; border-radius: 10px 10px 0 0;">
        <span style="color: #ffffff; font-size: 17px; font-weight: bold;">⚽ UBFC Calendar</span>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
        <span style="display:inline-block; background:${accent}; color:${accentText}; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; padding:4px 10px; border-radius:999px; margin-bottom:14px;">
          Booking ${verb}
        </span>
        <table style="border-collapse:collapse; margin-bottom:18px;">${describeHtml(booking)}</table>
        <a href="${SITE}" style="display:inline-block; background:#f5e731; color:#002e4c; text-decoration:none; font-weight:bold; font-size:14px; padding:10px 18px; border-radius:8px;">
          Open calendar →
        </a>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NUDGE_FROM ?? "UBFC Calendar <onboarding@resend.dev>",
        to: [to],
        subject: `UBFC Calendar — booking ${verb}: ${booking.teamName}, ${formatDate(booking.date)}`,
        html: emailHtml,
        text: `Booking ${verb}:\n\n${describe(booking)}\n\nOpen calendar: ${SITE}`,
      }),
    });
    if (!res.ok) {
      console.error("notifyBookingChange: Resend error", res.status, await res.text());
    }
  } catch (err) {
    console.error("notifyBookingChange: failed to send", err);
  }
}
