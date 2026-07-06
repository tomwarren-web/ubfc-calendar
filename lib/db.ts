import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";
import type { Booking, BookingWithNames, Pitch, Team } from "./types";

// Production uses Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN); local dev
// falls back to a SQLite file under data/.
function makeClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, "bookings.db").replace(/\\/g, "/");
  return createClient({ url: `file:${filePath}` });
}

const client = makeClient();

let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  initPromise ??= init();
  return initPromise;
}

async function init() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS pitches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      colour TEXT NOT NULL DEFAULT '#2563eb'
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pitch_id INTEGER REFERENCES pitches(id),
      team_id INTEGER NOT NULL REFERENCES teams(id),
      type TEXT NOT NULL CHECK (type IN ('fixture', 'training')),
      title TEXT,
      date TEXT NOT NULL,
      start_min INTEGER NOT NULL,
      end_min INTEGER NOT NULL,
      booked_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (end_min > start_min)
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_pitch_date ON bookings(pitch_id, date);
  `);

  // Seed the club's pitches and teams on first run so the app is usable immediately.
  const rs = await client.execute("SELECT COUNT(*) AS c FROM pitches");
  if (Number(rs.rows[0].c) === 0) {
    const statements = [
      ...["Main Pitch", "7v7 Pitch"].map((name) => ({
        sql: "INSERT INTO pitches (name) VALUES (?)",
        args: [name],
      })),
      ...(
        [
          ["First Team", "#dc2626"],
          ["Reserve Team", "#ea580c"],
          ["Sunday Team", "#ca8a04"],
          ["Vets", "#64748b"],
          ["U16's", "#2563eb"],
          ["U12's", "#0d9488"],
          ["U11's", "#9333ea"],
          ["Cubs", "#65a30d"],
          ["Cricket Club", "#166534"],
        ] as const
      ).map(([name, colour]) => ({
        sql: "INSERT INTO teams (name, colour) VALUES (?, ?)",
        args: [name, colour],
      })),
    ];
    await client.batch(statements, "write");
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
  const rs = await client.execute("SELECT id, name FROM pitches ORDER BY id");
  return rs.rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function addPitch(name: string): Promise<Pitch> {
  await ensureInit();
  const rs = await client.execute({
    sql: "INSERT INTO pitches (name) VALUES (?)",
    args: [name.trim()],
  });
  return { id: Number(rs.lastInsertRowid), name: name.trim() };
}

export async function deletePitch(id: number): Promise<void> {
  await ensureInit();
  await client.batch(
    [
      { sql: "DELETE FROM bookings WHERE pitch_id = ?", args: [id] },
      { sql: "DELETE FROM pitches WHERE id = ?", args: [id] },
    ],
    "write"
  );
}

export async function getTeams(): Promise<Team[]> {
  await ensureInit();
  const rs = await client.execute("SELECT id, name, colour FROM teams ORDER BY id");
  return rs.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    colour: String(r.colour),
  }));
}

export async function addTeam(name: string, colour: string): Promise<Team> {
  await ensureInit();
  const rs = await client.execute({
    sql: "INSERT INTO teams (name, colour) VALUES (?, ?)",
    args: [name.trim(), colour],
  });
  return { id: Number(rs.lastInsertRowid), name: name.trim(), colour };
}

export async function deleteTeam(id: number): Promise<void> {
  await ensureInit();
  await client.batch(
    [
      { sql: "DELETE FROM bookings WHERE team_id = ?", args: [id] },
      { sql: "DELETE FROM teams WHERE id = ?", args: [id] },
    ],
    "write"
  );
}

export async function getBookings(from: string, to: string): Promise<BookingWithNames[]> {
  await ensureInit();
  const rs = await client.execute({
    sql: `${bookingSelect} WHERE b.date >= ? AND b.date <= ? ORDER BY b.date, b.start_min`,
    args: [from, to],
  });
  return rs.rows.map(toBooking);
}

export async function getBooking(id: number): Promise<BookingWithNames | undefined> {
  await ensureInit();
  const rs = await client.execute({ sql: `${bookingSelect} WHERE b.id = ?`, args: [id] });
  return rs.rows[0] ? toBooking(rs.rows[0]) : undefined;
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
  const rs = await client.execute({
    sql: `${bookingSelect}
      WHERE b.pitch_id = ? AND b.date = ? AND b.start_min < ? AND b.end_min > ?
      AND b.id != ?`,
    args: [pitchId, date, endMin, startMin, excludeId ?? -1],
  });
  return rs.rows.map(toBooking);
}

export type BookingInput = Omit<Booking, "id" | "createdAt">;

export async function createBooking(input: BookingInput): Promise<BookingWithNames> {
  await ensureInit();
  const rs = await client.execute({
    sql: `INSERT INTO bookings (pitch_id, team_id, type, title, date, start_min, end_min, booked_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.pitchId,
      input.teamId,
      input.type,
      input.title,
      input.date,
      input.startMin,
      input.endMin,
      input.bookedBy,
    ],
  });
  return (await getBooking(Number(rs.lastInsertRowid)))!;
}

export async function updateBooking(id: number, input: BookingInput): Promise<BookingWithNames> {
  await ensureInit();
  await client.execute({
    sql: `UPDATE bookings
      SET pitch_id = ?, team_id = ?, type = ?, title = ?, date = ?, start_min = ?, end_min = ?, booked_by = ?
      WHERE id = ?`,
    args: [
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
  });
  return (await getBooking(id))!;
}

export async function deleteBooking(id: number): Promise<void> {
  await ensureInit();
  await client.execute({ sql: "DELETE FROM bookings WHERE id = ?", args: [id] });
}
