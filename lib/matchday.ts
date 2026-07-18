// Match-confirmation email template and helpers. Pure functions: used by the
// /matchday admin page (live preview + mailto drafts) and the daily reminder
// function alike.

import type { BookingWithNames } from "./types";

/** Home fixtures needing confirmations — real matches, not cricket ground blocks. */
export function isConfirmableHomeFixture(b: BookingWithNames): boolean {
  return b.type === "fixture" && b.pitchId !== null && b.teamName !== "Cricket Club";
}

export const VENUE = "Upper Beeding Recreation Ground, School Road, BN44 3WL";
export const DIRECTIONS_URL = "https://www.upperbeedingfc.com/find-us";
export const COLOURS = "Yellow shirts, yellow shorts, yellow socks (goalkeeper: green)";
export const MATCHDAY_CONTACT = "Tom Warren";
export const SIGN_OFF_NAME = "Dan";
export const SIGN_OFF_ROLE = "Match Secretary, Upper Beeding FC";

export interface ConfirmationDetails {
  refereeName: string;
  oppositionName: string;
  league: string;
  notes: string;
}

/** "vs Brockham (home, 3pm KO)" → "Brockham" — best-effort; editable on the page. */
export function deriveOpposition(title: string | null): string {
  if (!title) return "";
  return title
    .replace(/^(vs|v)\s+/i, "")
    .split(/\s+\(/)[0]
    .replace(/\s*—.*$/, "")
    .trim();
}

function longDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function time12(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hr}${suffix}` : `${hr}:${String(m).padStart(2, "0")}${suffix}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Referee";
}

/**
 * Builds the confirmation email for a home fixture. `sameDayHomeGames` should
 * be the other home fixtures on the same date (used for the "please note our
 * X are also at home" line and to stagger changing-room guidance).
 */
export function renderConfirmation(
  booking: BookingWithNames,
  details: ConfirmationDetails,
  sameDayHomeGames: BookingWithNames[]
): { subject: string; body: string } {
  const opposition = details.oppositionName || deriveOpposition(booking.title) || "the opposition";
  const ref = details.refereeName.trim();
  const koTime = time12(booking.startMin);
  const changingRooms = time12(booking.startMin - 90);
  const date = longDate(booking.date);

  const others = sameDayHomeGames
    .filter((b) => b.id !== booking.id)
    .map((b) => `Please note our ${b.teamName} are also at home, kicking off at ${time12(b.startMin)}.`)
    .join(" ");

  const greeting = ref
    ? `Hello ${firstName(ref)} and our friends at ${opposition},`
    : `Hello all at ${opposition},`;

  const lines = [
    greeting,
    "",
    `MATCH CONFIRMATION — ${date.toUpperCase()}`,
    "",
    `Fixture: Upper Beeding FC ${booking.teamName} v ${opposition}`,
    ...(details.league ? [`League: ${details.league}`] : []),
    `Kick-off: ${koTime}, ${date}`,
    `Referee: ${ref || "TBC"}`,
    `Assistant referees: club assistant referees to be provided by each team`,
    "",
    `Venue: ${VENUE}`,
    `Directions and parking: ${DIRECTIONS_URL}`,
    "",
    `Changing rooms will be open from ${changingRooms}.${others ? " " + others : ""}`,
    "",
    `UBFC colours: ${COLOURS}`,
    ...(details.notes ? ["", details.notes] : []),
    "",
    `After the match you are very welcome to join us for post-match drinks at the Rising Sun, a short walk from the ground.`,
    "",
    ...(ref
      ? [
          `${firstName(ref)}, please reply with your bank details so we can transfer your match fee.`,
          "",
        ]
      : []),
    `Please confirm receipt, and reply-all with any questions — ${MATCHDAY_CONTACT} is your best contact for anything on the day.`,
    "",
    "Regards,",
    SIGN_OFF_NAME,
    SIGN_OFF_ROLE,
  ];

  return {
    subject: `Match confirmation: Upper Beeding FC ${booking.teamName} v ${opposition} — ${date}, ${koTime} KO`,
    body: lines.join("\n"),
  };
}

/** mailto: link that opens the user's mail client with the draft filled in. */
export function mailtoDraft(
  to: string[],
  subject: string,
  body: string
): string {
  const recipients = to.filter(Boolean).join(",");
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
