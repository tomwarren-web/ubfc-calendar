import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Booking, BookingWithNames, Pitch, Team } from "./types";

export interface MatchResult {
  sourceRef: string;
  teamName: string;
  date: string;
  startMin: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string | null;
  competition: string | null;
}

export interface MatchReport {
  sourceRef: string;
  teamName: string;
  date: string;
  startMin: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  venue: string | null;
  competition: string | null;
  status: "draft" | "published";
  headline: string;
  summary: string;
  lineup: string[];
  substitutes: string[];
  goalscorers: string[];
  sourcePosts: string[];
  publishedAt: string | null;
  updatedAt: string;
}

// Netlify DB (Postgres). Netlify injects NETLIFY_DB_URL in production and under
// `netlify dev`; other environments can supply DATABASE_URL instead.
function makeSql() {
  const url =
    process.env.NETLIFY_DB_URL ??
    process.env.NETLIFY_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database configured — set NETLIFY_DB_URL (or DATABASE_URL) in the environment",
    );
  }
  return neon(url);
}

// Lazy so that `next build` (which imports route modules) doesn't need the env var.
let client: NeonQueryFunction<false, false> | null = null;
const sql = {
  query: (text: string, params?: unknown[]) => {
    client ??= makeSql();
    return client.query(text, params);
  },
};

let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  initPromise ??= init();
  return initPromise;
}

async function init() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS pitches (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name TEXT NOT NULL UNIQUE
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name TEXT NOT NULL UNIQUE,
      colour TEXT NOT NULL DEFAULT '#2563eb'
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      pitch_id INTEGER REFERENCES pitches(id),
      team_id INTEGER NOT NULL REFERENCES teams(id),
      type TEXT NOT NULL CHECK (type IN ('fixture', 'training')),
      title TEXT,
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      booked_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      source_ref TEXT,
      CHECK (end_min > start_min)
    )`);
  await sql.query(
    "CREATE INDEX IF NOT EXISTS idx_bookings_pitch_date ON bookings(pitch_id, date)",
  );
  await sql.query(`
    CREATE TABLE IF NOT EXISTS match_contacts (
      booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
      referee_name TEXT NOT NULL DEFAULT '',
      referee_email TEXT NOT NULL DEFAULT '',
      opposition_name TEXT NOT NULL DEFAULT '',
      opposition_email TEXT NOT NULL DEFAULT '',
      league TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS opposition_directory (
      club_name TEXT PRIMARY KEY,
      contact_email TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS match_results (
      source_ref TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      venue TEXT,
      competition TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS match_reports (
      source_ref TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER NOT NULL,
      away_score INTEGER NOT NULL,
      venue TEXT,
      competition TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
      headline TEXT NOT NULL,
      summary TEXT NOT NULL,
      lineup JSONB NOT NULL DEFAULT '[]'::jsonb,
      substitutes JSONB NOT NULL DEFAULT '[]'::jsonb,
      goalscorers JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_posts JSONB NOT NULL DEFAULT '[]'::jsonb,
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await sql.query("CREATE INDEX IF NOT EXISTS idx_match_reports_date ON match_reports(date)");

  // Seed the club's pitches and teams on first run so the app is usable immediately.
  const countRows = await sql.query("SELECT COUNT(*) AS c FROM pitches");
  if (Number((countRows as Row[])[0].c) === 0) {
    for (const name of ["Main Pitch", "7v7 Pitch"]) {
      await sql.query("INSERT INTO pitches (name) VALUES ($1)", [name]);
    }
    const teams: Array<[string, string]> = [
      ["First Team", "#dc2626"],
      ["Reserve Team", "#ea580c"],
      ["Sunday Team", "#ca8a04"],
      ["Vets", "#64748b"],
      ["U16's", "#2563eb"],
      ["U12's", "#0d9488"],
      ["U11's", "#9333ea"],
      ["Cubs", "#65a30d"],
      ["Cricket Club", "#166534"],
    ];
    for (const [name, colour] of teams) {
      await sql.query("INSERT INTO teams (name, colour) VALUES ($1, $2)", [
        name,
        colour,
      ]);
    }
  }
}

type Row = Record<string, unknown>;

function toBooking(row: Row): BookingWithNames {
  return {
    id: Number(row.id),
    pitchId: row.pitch_id === null ? null : Number(row.pitch_id),
    teamId: Number(row.team_id),
    type: row.type as "fixture" | "training",
    title: row.title === null ? null : String(row.title),
    date: String(row.date),
    startMin: Number(row.start_min),
    endMin: Number(row.end_min),
    bookedBy: String(row.booked_by),
    createdAt: String(row.created_at),
    sourceRef: row.source_ref == null ? null : String(row.source_ref),
    pitchName: row.pitch_name === null ? null : String(row.pitch_name),
    teamName: String(row.team_name),
    teamColour: String(row.team_colour),
  };
}

const bookingSelect = `
  SELECT b.*, p.name AS pitch_name, t.name AS team_name, t.colour AS team_colour
  FROM bookings b
  LEFT JOIN pitches p ON p.id = b.pitch_id
  JOIN teams t ON t.id = b.team_id
`;

export async function getPitches(): Promise<Pitch[]> {
  await ensureInit();
  const rows = (await sql.query(
    "SELECT id, name FROM pitches ORDER BY id",
  )) as Row[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function addPitch(name: string): Promise<Pitch> {
  await ensureInit();
  const rows = (await sql.query(
    "INSERT INTO pitches (name) VALUES ($1) RETURNING id",
    [name.trim()],
  )) as Row[];
  return { id: Number(rows[0].id), name: name.trim() };
}

export async function deletePitch(id: number): Promise<void> {
  await ensureInit();
  await sql.query("DELETE FROM bookings WHERE pitch_id = $1", [id]);
  await sql.query("DELETE FROM pitches WHERE id = $1", [id]);
}

export async function getTeams(): Promise<Team[]> {
  await ensureInit();
  const rows = (await sql.query(
    "SELECT id, name, colour FROM teams ORDER BY id",
  )) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    colour: String(r.colour),
  }));
}

export async function addTeam(name: string, colour: string): Promise<Team> {
  await ensureInit();
  const rows = (await sql.query(
    "INSERT INTO teams (name, colour) VALUES ($1, $2) RETURNING id",
    [name.trim(), colour],
  )) as Row[];
  return { id: Number(rows[0].id), name: name.trim(), colour };
}

export async function deleteTeam(id: number): Promise<void> {
  await ensureInit();
  await sql.query("DELETE FROM bookings WHERE team_id = $1", [id]);
  await sql.query("DELETE FROM teams WHERE id = $1", [id]);
}

export async function getBookings(
  from: string,
  to: string,
): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect} WHERE b.date >= $1 AND b.date <= $2 ORDER BY b.date, b.start_min`,
    [from, to],
  )) as Row[];
  return rows.map(toBooking);
}

export async function getBooking(
  id: number,
): Promise<BookingWithNames | undefined> {
  await ensureInit();
  const rows = (await sql.query(`${bookingSelect} WHERE b.id = $1`, [
    id,
  ])) as Row[];
  return rows[0] ? toBooking(rows[0]) : undefined;
}

/** Bookings on the same pitch and date whose time range overlaps the given one. */
export async function findClashes(
  pitchId: number,
  date: string,
  startMin: number,
  endMin: number,
  excludeId?: number,
): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect}
     WHERE b.pitch_id = $1 AND b.date = $2 AND b.start_min < $3 AND b.end_min > $4
     AND b.id != $5`,
    [pitchId, date, endMin, startMin, excludeId ?? -1],
  )) as Row[];
  return rows.map(toBooking);
}

// sourceRef is only set by external syncs; manual bookings leave it null.
// updateBooking deliberately never touches source_ref, so a manual edit of a
// synced booking keeps its link to the external fixture.
export type BookingInput = Omit<Booking, "id" | "createdAt" | "sourceRef"> & {
  sourceRef?: string | null;
};

export async function createBooking(
  input: BookingInput,
): Promise<BookingWithNames> {
  await ensureInit();
  const rows = (await sql.query(
    `INSERT INTO bookings (pitch_id, team_id, type, title, date, start_min, end_min, booked_by, source_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      input.pitchId,
      input.teamId,
      input.type,
      input.title,
      input.date,
      input.startMin,
      input.endMin,
      input.bookedBy,
      input.sourceRef ?? null,
    ],
  )) as Row[];
  return (await getBooking(Number(rows[0].id)))!;
}

/** All bookings whose source_ref starts with the given prefix (e.g. "fulltime:"). */
export async function getBookingsBySourcePrefix(
  prefix: string,
): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect} WHERE b.source_ref LIKE $1 ORDER BY b.date, b.start_min`,
    [`${prefix}%`],
  )) as Row[];
  return rows.map(toBooking);
}

export async function upsertMatchResult(result: MatchResult): Promise<void> {
  await ensureInit();
  await sql.query(
    `INSERT INTO match_results
      (source_ref, team_name, date, start_min, home_team, away_team, home_score, away_score, venue, competition, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (source_ref) DO UPDATE SET
       team_name = $2, date = $3, start_min = $4, home_team = $5, away_team = $6,
       home_score = $7, away_score = $8, venue = $9, competition = $10, updated_at = now()`,
    [
      result.sourceRef,
      result.teamName,
      result.date,
      result.startMin,
      result.homeTeam,
      result.awayTeam,
      result.homeScore,
      result.awayScore,
      result.venue,
      result.competition,
    ],
  );
  await upsertMatchReportFromResult(result);
}

function reportHeadline(result: MatchResult): string {
  return `${result.homeTeam} ${result.homeScore}–${result.awayScore} ${result.awayTeam}`;
}

function reportSummary(result: MatchResult): string {
  return `Full-time: ${reportHeadline(result)}. Match report details will be added after the team sheet is confirmed.`;
}

/** Creates or refreshes the score-only report without overwriting editorial details. */
export async function upsertMatchReportFromResult(result: MatchResult): Promise<void> {
  if (result.teamName !== "First Team") return;
  await ensureInit();
  await sql.query(
    `INSERT INTO match_reports
      (source_ref, team_name, date, start_min, home_team, away_team, home_score, away_score,
       venue, competition, status, headline, summary, published_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'published',$11,$12,now(),now())
     ON CONFLICT (source_ref) DO UPDATE SET
       team_name=$2, date=$3, start_min=$4, home_team=$5, away_team=$6,
       home_score=$7, away_score=$8, venue=$9, competition=$10,
       headline=$11, summary=CASE WHEN match_reports.lineup='[]'::jsonb
         AND match_reports.goalscorers='[]'::jsonb THEN $12 ELSE match_reports.summary END,
       published_at=COALESCE(match_reports.published_at, now()), updated_at=now()` ,
    [result.sourceRef, result.teamName, result.date, result.startMin, result.homeTeam,
      result.awayTeam, result.homeScore, result.awayScore, result.venue, result.competition,
      reportHeadline(result), reportSummary(result)],
  );
}

function parseJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function toMatchReport(row: Row): MatchReport {
  return {
    sourceRef: String(row.source_ref), teamName: String(row.team_name), date: String(row.date),
    startMin: Number(row.start_min), homeTeam: String(row.home_team), awayTeam: String(row.away_team),
    homeScore: Number(row.home_score), awayScore: Number(row.away_score),
    venue: row.venue == null ? null : String(row.venue),
    competition: row.competition == null ? null : String(row.competition),
    status: row.status === "draft" ? "draft" : "published", headline: String(row.headline),
    summary: String(row.summary), lineup: parseJsonArray(row.lineup),
    substitutes: parseJsonArray(row.substitutes), goalscorers: parseJsonArray(row.goalscorers),
    sourcePosts: parseJsonArray(row.source_posts), publishedAt: row.published_at == null ? null : String(row.published_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getMatchReports(from: string, to: string): Promise<MatchReport[]> {
  await ensureInit();
  const rows = (await sql.query(
    `SELECT * FROM match_reports WHERE team_name='First Team' AND status='published'
     AND date >= $1 AND date <= $2 ORDER BY date DESC, start_min DESC`, [from, to])) as Row[];
  return rows.map(toMatchReport);
}

export interface MatchReportEnrichment {
  lineup?: string[];
  substitutes?: string[];
  goalscorers?: string[];
  sourcePosts?: string[];
}

export async function enrichMatchReport(
  sourceRef: string,
  enrichment: MatchReportEnrichment,
): Promise<void> {
  await ensureInit();
  await sql.query(
    `UPDATE match_reports SET
       lineup = CASE WHEN cardinality($2::text[]) > 0 THEN to_jsonb($2::text[]) ELSE lineup END,
       substitutes = CASE WHEN cardinality($3::text[]) > 0 THEN to_jsonb($3::text[]) ELSE substitutes END,
       goalscorers = CASE WHEN cardinality($4::text[]) > 0 THEN to_jsonb($4::text[]) ELSE goalscorers END,
       source_posts = CASE WHEN cardinality($5::text[]) > 0 THEN to_jsonb($5::text[]) ELSE source_posts END,
       summary = CASE WHEN cardinality($2::text[]) > 0 THEN 'Full-time: ' || headline || '.' ELSE summary END,
       updated_at = now()
     WHERE source_ref = $1 AND team_name = 'First Team'`,
    [
      sourceRef,
      enrichment.lineup ?? [],
      enrichment.substitutes ?? [],
      enrichment.goalscorers ?? [],
      enrichment.sourcePosts ?? [],
    ],
  );
}

export async function backfillMatchReports(from: string, to: string): Promise<number> {
  await ensureInit();
  const rows = (await sql.query(
    `SELECT source_ref, team_name, date, start_min, home_team, away_team, home_score, away_score, venue, competition
     FROM match_results WHERE team_name='First Team' AND date >= $1 AND date <= $2 ORDER BY date`, [from, to])) as Row[];
  for (const row of rows) {
    await upsertMatchReportFromResult({ sourceRef: String(row.source_ref), teamName: String(row.team_name), date: String(row.date),
      startMin: Number(row.start_min), homeTeam: String(row.home_team), awayTeam: String(row.away_team),
      homeScore: Number(row.home_score), awayScore: Number(row.away_score), venue: row.venue == null ? null : String(row.venue),
      competition: row.competition == null ? null : String(row.competition) });
  }
  return rows.length;
}

export async function getMatchResults(
  from: string,
  to: string,
): Promise<MatchResult[]> {
  await ensureInit();
  const rows = (await sql.query(
    `SELECT source_ref, team_name, date, start_min, home_team, away_team,
            home_score, away_score, venue, competition
     FROM match_results WHERE date >= $1 AND date <= $2 ORDER BY date, start_min`,
    [from, to],
  )) as Row[];
  return rows.map((row) => ({
    sourceRef: String(row.source_ref),
    teamName: String(row.team_name),
    date: String(row.date),
    startMin: Number(row.start_min),
    homeTeam: String(row.home_team),
    awayTeam: String(row.away_team),
    homeScore: Number(row.home_score),
    awayScore: Number(row.away_score),
    venue: row.venue == null ? null : String(row.venue),
    competition: row.competition == null ? null : String(row.competition),
  }));
}

export async function updateBooking(
  id: number,
  input: BookingInput,
): Promise<BookingWithNames> {
  await ensureInit();
  await sql.query(
    `UPDATE bookings
     SET pitch_id = $1, team_id = $2, type = $3, title = $4, date = $5, start_min = $6, end_min = $7, booked_by = $8
     WHERE id = $9`,
    [
      input.pitchId,
      input.teamId,
      input.type,
      input.title,
      input.date,
      input.startMin,
      input.endMin,
      input.bookedBy,
      id,
    ],
  );
  return (await getBooking(id))!;
}

export async function deleteBooking(id: number): Promise<void> {
  await ensureInit();
  await sql.query("DELETE FROM bookings WHERE id = $1", [id]);
}

// ---------- Match confirmation contacts ----------

export interface MatchContacts {
  bookingId: number;
  refereeName: string;
  refereeEmail: string;
  oppositionName: string;
  oppositionEmail: string;
  league: string;
  notes: string;
}

function toMatchContacts(row: Row): MatchContacts {
  return {
    bookingId: Number(row.booking_id),
    refereeName: String(row.referee_name ?? ""),
    refereeEmail: String(row.referee_email ?? ""),
    oppositionName: String(row.opposition_name ?? ""),
    oppositionEmail: String(row.opposition_email ?? ""),
    league: String(row.league ?? ""),
    notes: String(row.notes ?? ""),
  };
}

export async function getMatchContacts(
  bookingIds: number[],
): Promise<MatchContacts[]> {
  await ensureInit();
  if (bookingIds.length === 0) return [];
  const rows = (await sql.query(
    "SELECT * FROM match_contacts WHERE booking_id = ANY($1::int[])",
    [bookingIds],
  )) as Row[];
  return rows.map(toMatchContacts);
}

export async function upsertMatchContacts(mc: MatchContacts): Promise<void> {
  await ensureInit();
  await sql.query(
    `INSERT INTO match_contacts (booking_id, referee_name, referee_email, opposition_name, opposition_email, league, notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (booking_id) DO UPDATE SET
       referee_name = $2, referee_email = $3, opposition_name = $4,
       opposition_email = $5, league = $6, notes = $7, updated_at = now()`,
    [
      mc.bookingId,
      mc.refereeName.trim(),
      mc.refereeEmail.trim(),
      mc.oppositionName.trim(),
      mc.oppositionEmail.trim(),
      mc.league.trim(),
      mc.notes.trim(),
    ],
  );
  // Remember the opposition contact season-long so it pre-fills next time
  if (mc.oppositionName.trim() && mc.oppositionEmail.trim()) {
    await sql.query(
      `INSERT INTO opposition_directory (club_name, contact_email, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (club_name) DO UPDATE SET contact_email = $2, updated_at = now()`,
      [mc.oppositionName.trim(), mc.oppositionEmail.trim()],
    );
  }
}

export async function lookupOppositionEmail(clubName: string): Promise<string> {
  await ensureInit();
  const rows = (await sql.query(
    "SELECT contact_email FROM opposition_directory WHERE lower(club_name) = lower($1)",
    [clubName.trim()],
  )) as Row[];
  return rows[0] ? String(rows[0].contact_email) : "";
}
