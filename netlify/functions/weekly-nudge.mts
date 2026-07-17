import { composeWeekShareText, whatsAppShareUrl } from "../../lib/share";
import { addDays, formatWeekLabel, startOfWeek, toDateStr } from "../../lib/time";
import type { BookingWithNames } from "../../lib/types";

const SITE = "https://ubfc-calendar.netlify.app";

// Runs every Monday morning (06:00 UTC — 7am UK in summer, 6am in winter) and
// emails the week's events with a one-tap "Send to WhatsApp" link.
export default async () => {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NUDGE_EMAIL;
  if (!apiKey || !to) {
    console.log("weekly-nudge: RESEND_API_KEY / NUDGE_EMAIL not configured — skipping");
    return new Response("not configured", { status: 200 });
  }

  const weekStart = startOfWeek(new Date());
  const from = toDateStr(weekStart);
  const until = toDateStr(addDays(weekStart, 6));
  const res = await fetch(`${SITE}/api/bookings?from=${from}&to=${until}`);
  if (!res.ok) {
    console.error("weekly-nudge: failed to fetch bookings", res.status);
    return new Response("failed to fetch bookings", { status: 500 });
  }
  const bookings = (await res.json()) as BookingWithNames[];

  const text = composeWeekShareText(bookings, weekStart);
  const waUrl = whatsAppShareUrl(text);
  const digestHtml = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <div style="background: #002e4c; border-bottom: 4px solid #f5e731; padding: 16px 20px; border-radius: 10px 10px 0 0;">
        <span style="color: #ffffff; font-size: 18px; font-weight: bold;">⚽ UBFC Calendar — weekly digest</span>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
        <a href="${waUrl}"
           style="display: block; background: #25D366; color: #ffffff; text-align: center; padding: 14px; border-radius: 10px; font-size: 16px; font-weight: bold; text-decoration: none; margin-bottom: 20px;">
          Send to WhatsApp group →
        </a>
        <p style="font-size: 13px; color: #64748b; margin-top: 0;">
          Tap the button on your phone — WhatsApp opens with the message below already filled in.
          Just pick the group and press send.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; font-size: 14px; line-height: 1.6;">
          ${digestHtml}
        </div>
      </div>
    </div>`;

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Sandbox sender until the club domain is verified in Resend; then set
      // NUDGE_FROM to e.g. "UBFC Calendar <calendar@upperbeedingfc.co.uk>".
      from: process.env.NUDGE_FROM ?? "UBFC Calendar <onboarding@resend.dev>",
      to: [to],
      subject: `UBFC weekly digest — ${formatWeekLabel(weekStart)}`,
      html: emailHtml,
      text: `${text}\n\nSend to WhatsApp: ${waUrl}`,
    }),
  });

  if (!send.ok) {
    console.error("weekly-nudge: Resend error", send.status, await send.text());
    return new Response("email send failed", { status: 500 });
  }
  console.log("weekly-nudge: digest emailed to", to);
  return new Response("sent", { status: 200 });
};

export const config = {
  schedule: "0 6 * * 1",
};
