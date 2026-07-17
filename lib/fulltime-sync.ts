import {
  createBooking,
  deleteBooking,
  findClashes,
  getBookingsBySourcePrefix,
  getPitches,
  getTeams,
  updateBooking,
  type BookingInput,
} from "./db";
import { CLUB_PATTERN, FULLTIME_TEAMS, parseUpcomingFixtures } from "./fulltime";
import { formatMin, toDateStr } from "./time";

const SOURCE_PREFIX = "fulltime:";

export interface SyncReport {
  added: string[];
  updated: string[];
  removed: string[];
  clashes: string[];
  errors: string[];
  checkedTeams: number;
}

function describeFixture(date: string, startMin: number, team: string, title: string): string {
  const nice = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${team} — ${title} (${nice} ${formatMin(startMin)})`;
}

/**
 * Reconciles FA Full-Time upcoming fixtures into the calendar. Only bookings
 * this sync created (source_ref = "fulltime:<id>") are ever touched; manual
 * bookings, training and cricket blocks are invisible to it. Fixtures whose
 * pitch slot clashes with an existing booking are imported as off-site and
 * flagged, never silently dropped and never overriding the clash block.
 */
export async function runFullTimeSync(): Promise<SyncReport> {
  const report: SyncReport = {
    added: [],
    updated: [],
    removed: [],
    clashes: [],
    errors: [],
    checkedTeams: 0,
  };

  const [teams, pitches, existing] = await Promise.all([
    getTeams(),
    getPitches(),
    getBookingsBySourcePrefix(SOURCE_PREFIX),
  ]);
  const byRef = new Map(existing.map((b) => [b.sourceRef as string, b]));
  const seenRefs = new Set<string>();
  const syncedTeamIds = new Set<number>(); // teams whose page fetched OK — safe to remove their stale bookings

  for (const cfg of FULLTIME_TEAMS) {
    const appTeam = teams.find((t) => t.name === cfg.appTeam);
    if (!appTeam) {
      report.errors.push(`Config error: app team "${cfg.appTeam}" doesn't exist`);
      continue;
    }
    const homePitch = pitches.find((p) => p.name === cfg.homePitch);
    if (!homePitch) {
      report.errors.push(`Config error: pitch "${cfg.homePitch}" doesn't exist`);
      continue;
    }

    let fixtures;
    try {
      const res = await fetch(cfg.url, { headers: { "User-Agent": "UBFC-Calendar-Sync/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fixtures = parseUpcomingFixtures(await res.text());
    } catch (err) {
      report.errors.push(`${cfg.appTeam}: failed to read FA Full-Time (${String(err)})`);
      continue; // fetch failed — leave this team's existing bookings untouched
    }

    report.checkedTeams++;
    syncedTeamIds.add(appTeam.id);

    for (const fx of fixtures) {
      // Postponed/cancelled fixtures are treated as absent: skipped here, so an
      // existing booking for them is cleaned up by the removal pass below.
      if (fx.status && /postpon|cancel|abandon/i.test(fx.status)) continue;

      const ref = `${SOURCE_PREFIX}${fx.fixtureId}`;
      seenRefs.add(ref);

      const isHome = CLUB_PATTERN.test(fx.homeTeam);
      const opponent = isHome ? fx.awayTeam : fx.homeTeam;
      let title = isHome ? `vs ${opponent} (home)` : `at ${opponent} (away)`;
      if (fx.competition) title += ` — ${fx.competition}`;
      if (!isHome && fx.venue) title += `, ${fx.venue}`;

      const desired: BookingInput = {
        pitchId: isHome ? homePitch.id : null,
        teamId: appTeam.id,
        type: "fixture",
        title,
        date: fx.date,
        startMin: fx.startMin,
        endMin: fx.startMin + cfg.durationMin,
        bookedBy: "FA Full-Time sync",
        sourceRef: ref,
      };

      const current = byRef.get(ref);
      if (!current) {
        if (desired.pitchId !== null) {
          const clashes = await findClashes(
            desired.pitchId,
            desired.date,
            desired.startMin,
            desired.endMin
          );
          if (clashes.length > 0) {
            report.clashes.push(
              `${describeFixture(desired.date, desired.startMin, cfg.appTeam, title)} clashes with: ` +
                clashes.map((c) => `${c.teamName} ${formatMin(c.startMin)}–${formatMin(c.endMin)}`).join("; ")
            );
            desired.pitchId = null;
            desired.title += " ⚠ imported off-site due to pitch clash";
          }
        }
        await createBooking(desired);
        report.added.push(describeFixture(desired.date, desired.startMin, cfg.appTeam, desired.title ?? ""));
      } else {
        const changed =
          current.date !== desired.date ||
          current.startMin !== desired.startMin ||
          current.endMin !== desired.endMin ||
          current.pitchId !== desired.pitchId ||
          current.title !== desired.title ||
          current.teamId !== desired.teamId;
        if (!changed) continue;

        if (desired.pitchId !== null) {
          const clashes = await findClashes(
            desired.pitchId,
            desired.date,
            desired.startMin,
            desired.endMin,
            current.id
          );
          if (clashes.length > 0) {
            report.clashes.push(
              `${describeFixture(desired.date, desired.startMin, cfg.appTeam, title)} clashes with: ` +
                clashes.map((c) => `${c.teamName} ${formatMin(c.startMin)}–${formatMin(c.endMin)}`).join("; ")
            );
            desired.pitchId = null;
            desired.title += " ⚠ moved off-site due to pitch clash";
          }
        }
        await updateBooking(current.id, desired);
        report.updated.push(
          `${describeFixture(current.date, current.startMin, cfg.appTeam, current.title ?? "")} → ` +
            `${describeFixture(desired.date, desired.startMin, cfg.appTeam, desired.title ?? "")}`
        );
      }
    }
  }

  // Removal pass: synced future bookings that no longer appear upstream
  // (rescheduled away, postponed, or deleted). Only for teams whose page we
  // successfully read this run.
  const today = toDateStr(new Date());
  for (const b of existing) {
    if (seenRefs.has(b.sourceRef as string)) continue;
    if (b.date < today) continue; // leave history alone
    if (!syncedTeamIds.has(b.teamId)) continue;
    await deleteBooking(b.id);
    report.removed.push(describeFixture(b.date, b.startMin, b.teamName, b.title ?? ""));
  }

  return report;
}

/** Emails the sync report via Resend. Skips entirely when nothing happened. */
export async function emailSyncReport(report: SyncReport): Promise<void> {
  const hasNews =
    report.added.length ||
    report.updated.length ||
    report.removed.length ||
    report.clashes.length ||
    report.errors.length;
  if (!hasNews) return;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_NOTIFY_EMAIL ?? process.env.NUDGE_EMAIL;
  if (!apiKey || !to) return;

  const section = (heading: string, items: string[]) =>
    items.length ? `${heading}\n${items.map((i) => `• ${i}`).join("\n")}\n\n` : "";
  const text =
    section("⚠ NEEDS ATTENTION — pitch clashes:", report.clashes) +
    section("⚠ Sync problems:", report.errors) +
    section("New fixtures added:", report.added) +
    section("Fixtures changed:", report.updated) +
    section("Fixtures removed (postponed/rescheduled):", report.removed) +
    `Open calendar: https://ubfc-calendar.netlify.app`;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const htmlSection = (heading: string, items: string[], colour: string) =>
    items.length
      ? `<p style="margin:14px 0 4px;font-weight:bold;color:${colour};">${heading}</p>` +
        `<ul style="margin:0;padding-left:18px;">${items.map((i) => `<li style="margin:3px 0;font-size:14px;">${esc(i)}</li>`).join("")}</ul>`
      : "";
  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
      <div style="background: #002e4c; border-bottom: 4px solid #f5e731; padding: 16px 20px; border-radius: 10px 10px 0 0;">
        <span style="color: #ffffff; font-size: 17px; font-weight: bold;">⚽ UBFC Calendar — FA Full-Time sync</span>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
        ${htmlSection("⚠ Needs attention — pitch clashes", report.clashes, "#dc2626")}
        ${htmlSection("⚠ Sync problems", report.errors, "#dc2626")}
        ${htmlSection("New fixtures added", report.added, "#16a34a")}
        ${htmlSection("Fixtures changed", report.updated, "#0369a1")}
        ${htmlSection("Fixtures removed (postponed/rescheduled)", report.removed, "#64748b")}
        <a href="https://ubfc-calendar.netlify.app" style="display:inline-block; margin-top:18px; background:#f5e731; color:#002e4c; text-decoration:none; font-weight:bold; font-size:14px; padding:10px 18px; border-radius:8px;">
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
        subject:
          `UBFC fixtures sync: ` +
          [
            report.clashes.length && `${report.clashes.length} clash`,
            report.errors.length && `${report.errors.length} error`,
            report.added.length && `${report.added.length} added`,
            report.updated.length && `${report.updated.length} changed`,
            report.removed.length && `${report.removed.length} removed`,
          ]
            .filter(Boolean)
            .join(", "),
        html: emailHtml,
        text,
      }),
    });
    if (!res.ok) console.error("emailSyncReport: Resend error", res.status, await res.text());
  } catch (err) {
    console.error("emailSyncReport: failed", err);
  }
}
