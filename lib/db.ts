import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Booking, BookingWithNames, Pitch, Team } from "./types";

// Netlify DB (Postgres). Netlify injects NETLIFY_DB_URL in production and under
// `netlify dev`; other environments can supply DATABASE_URL instead.
function makeSql() {
  const url =
    process.env.NETLIFY_DB_URL ??
    process.env.NETLIFY_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database configured — set NETLIFY_DB_URL (or DATABASE_URL) in the environment"
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
    "CREATE INDEX IF NOT EXISTS idx_bookings_pitch_date ON bookings(pitch_id, date)"
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
      await sql.query("INSERT INTO teams (name, colour) VALUES ($1, $2)", [name, colour]);
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
  const rows = (await sql.query("SELECT id, name FROM pitches ORDER BY id")) as Row[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function addPitch(name: string): Promise<Pitch> {
  await ensureInit();
  const rows = (await sql.query("INSERT INTO pitches (name) VALUES ($1) RETURNING id", [
    name.trim(),
  ])) as Row[];
  return { id: Number(rows[0].id), name: name.trim() };
}

export async function deletePitch(id: number): Promise<void> {
  await ensureInit();
  await sql.query("DELETE FROM bookings WHERE pitch_id = $1", [id]);
  await sql.query("DELETE FROM pitches WHERE id = $1", [id]);
}

export async function getTeams(): Promise<Team[]> {
  await ensureInit();
  const rows = (await sql.query("SELECT id, name, colour FROM teams ORDER BY id")) as Row[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name), colour: String(r.colour) }));
}

export async function addTeam(name: string, colour: string): Promise<Team> {
  await ensureInit();
  const rows = (await sql.query(
    "INSERT INTO teams (name, colour) VALUES ($1, $2) RETURNING id",
    [name.trim(), colour]
  )) as Row[];
  return { id: Number(rows[0].id), name: name.trim(), colour };
}

export async function deleteTeam(id: number): Promise<void> {
  await ensureInit();
  await sql.query("DELETE FROM bookings WHERE team_id = $1", [id]);
  await sql.query("DELETE FROM teams WHERE id = $1", [id]);
}

export async function getBookings(from: string, to: string): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect} WHERE b.date >= $1 AND b.date <= $2 ORDER BY b.date, b.start_min`,
    [from, to]
  )) as Row[];
  return rows.map(toBooking);
}

export async function getBooking(id: number): Promise<BookingWithNames | undefined> {
  await ensureInit();
  const rows = (await sql.query(`${bookingSelect} WHERE b.id = $1`, [id])) as Row[];
  return rows[0] ? toBooking(rows[0]) : undefined;
}

/** Bookings on the same pitch and date whose time range overlaps the given one. */
export async function findClashes(
  pitchId: number,
  date: string,
  startMin: number,
  endMin: number,
  excludeId?: number
): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect}
     WHERE b.pitch_id = $1 AND b.date = $2 AND b.start_min < $3 AND b.end_min > $4
     AND b.id != $5`,
    [pitchId, date, endMin, startMin, excludeId ?? -1]
  )) as Row[];
  return rows.map(toBooking);
}

// sourceRef is only set by external syncs; manual bookings leave it null.
// updateBooking deliberately never touches source_ref, so a manual edit of a
// synced booking keeps its link to the external fixture.
export type BookingInput = Omit<Booking, "id" | "createdAt" | "sourceRef"> & {
  sourceRef?: string | null;
};

export async function createBooking(input: BookingInput): Promise<BookingWithNames> {
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
    ]
  )) as Row[];
  return (await getBooking(Number(rows[0].id)))!;
}

/** All bookings whose source_ref starts with the given prefix (e.g. "fulltime:"). */
export async function getBookingsBySourcePrefix(prefix: string): Promise<BookingWithNames[]> {
  await ensureInit();
  const rows = (await sql.query(
    `${bookingSelect} WHERE b.source_ref LIKE $1 ORDER BY b.date, b.start_min`,
    [`${prefix}%`]
  )) as Row[];
  return rows.map(toBooking);
}

export async function updateBooking(id: number, input: BookingInput): Promise<BookingWithNames> {
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
    ]
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

export async function getMatchContacts(bookingIds: number[]): Promise<MatchContacts[]> {
  await ensureInit();
  if (bookingIds.length === 0) return [];
  const rows = (await sql.query(
    "SELECT * FROM match_contacts WHERE booking_id = ANY($1::int[])",
    [bookingIds]
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
    ]
  );
  // Remember the opposition contact season-long so it pre-fills next time
  if (mc.oppositionName.trim() && mc.oppositionEmail.trim()) {
    await sql.query(
      `INSERT INTO opposition_directory (club_name, contact_email, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (club_name) DO UPDATE SET contact_email = $2, updated_at = now()`,
      [mc.oppositionName.trim(), mc.oppositionEmail.trim()]
    );
  }
}

export async function lookupOppositionEmail(clubName: string): Promise<string> {
  await ensureInit();
  const rows = (await sql.query(
    "SELECT contact_email FROM opposition_directory WHERE lower(club_name) = lower($1)",
    [clubName.trim()]
  )) as Row[];
  return rows[0] ? String(rows[0].contact_email) : "";
}
