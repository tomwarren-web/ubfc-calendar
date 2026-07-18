import { getBookings, getMatchContacts } from "../../lib/db";
import { isConfirmableHomeFixture, mailtoDraft, renderConfirmation } from "../../lib/matchday";
import { addDays, formatMin, toDateStr } from "../../lib/time";

const SITE = "https://ubfc-calendar.netlify.app";

// Daily at 06:10 UTC: if any home fixture is exactly 5 days away, email the
// secretary its ready-to-send confirmation draft (mailto link opens the mail
// client with To/Subject/Body filled in, sent from the club's own mailbox).
export default async () => {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_NOTIFY_EMAIL ?? process.env.NUDGE_EMAIL;
  if (!apiKey || !to) return new Response("not configured", { status: 200 });

  const targetDate = toDateStr(addDays(new Date(), 5));
  const dayBookings = await getBookings(targetDate, targetDate);
  const homeFixtures = dayBookings.filter(isConfirmableHomeFixture);
  if (homeFixtures.length === 0) return new Response("no fixtures due", { status: 200 });

  const contacts = await getMatchContacts(homeFixtures.map((b) => b.id));
  const byId = new Map(contacts.map((c) => [c.bookingId, c]));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const sections = homeFixtures.map((b) => {
    const c = byId.get(b.id) ?? {
      bookingId: b.id,
      refereeName: "",
      refereeEmail: "",
      oppositionName: "",
      oppositionEmail: "",
      league: "",
      notes: "",
    };
    const rendered = renderConfirmation(b, c, homeFixtures);
    const recipients = [c.refereeEmail, c.oppositionEmail].filter((e) => e.trim());
    const missing = [
      !c.refereeEmail.trim() && "referee email",
      !c.oppositionEmail.trim() && "opposition email",
    ].filter(Boolean) as string[];

    const heading = `${b.teamName} v ${c.oppositionName || "TBC"} — KO ${formatMin(b.startMin)}`;
    const action = missing.length
      ? `<p style="color:#dc2626;font-size:13px;font-weight:bold;">Missing: ${missing.join(", ")} — <a href="${SITE}/matchday" style="color:#dc2626;">add them on the matchday page</a>, then send from there.</p>`
      : `<a href="${mailtoDraft(recipients, rendered.subject, rendered.body)}" style="display:inline-block; background:#f5e731; color:#002e4c; text-decoration:none; font-weight:bold; font-size:14px; padding:10px 18px; border-radius:8px;">Open email draft →</a>`;

    return `
      <div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:14px;">
        <p style="margin:0 0 8px; font-weight:bold; color:#002e4c;">${esc(heading)}</p>
        ${action}
        <details style="margin-top:10px;">
          <summary style="font-size:12px; color:#64748b; cursor:pointer;">Preview the email</summary>
          <pre style="white-space:pre-wrap; font-size:12px; background:#f8fafc; border-radius:8px; padding:10px;">${esc(rendered.body)}</pre>
        </details>
      </div>`;
  });

  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <div style="background: #002e4c; border-bottom: 4px solid #f5e731; padding: 16px 20px; border-radius: 10px 10px 0 0;">
        <span style="color: #ffffff; font-size: 17px; font-weight: bold;">⚽ Match confirmations due — 5 days to go</span>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
        <p style="font-size:14px; margin-top:0;">Home fixture${homeFixtures.length > 1 ? "s" : ""} on <strong>${new Date(targetDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</strong>. Tap a button to open the confirmation in your email app, check it, and send.</p>
        ${sections.join("")}
        <a href="${SITE}/matchday" style="font-size:13px; color:#0369a1;">Manage all match confirmations →</a>
      </div>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NUDGE_FROM ?? "UBFC Calendar <onboarding@resend.dev>",
      to: [to],
      subject: `Match confirmation${homeFixtures.length > 1 ? "s" : ""} due — ${homeFixtures
        .map((b) => b.teamName)
        .join(", ")} at home on ${new Date(targetDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })}`,
      html: emailHtml,
    }),
  });
  if (!res.ok) {
    console.error("match-confirmations: Resend error", res.status, await res.text());
    return new Response("email failed", { status: 500 });
  }
  console.log(`match-confirmations: reminder sent for ${homeFixtures.length} fixture(s) on ${targetDate}`);
  return new Response("sent", { status: 200 });
};

export const config = {
  schedule: "10 6 * * *",
};
