import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Booking, BookingWithNames, Pitch, Team } from "./types";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "bookings.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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
const pitchCount = db.prepare("SELECT COUNT(*) AS c FROM pitches").get() as { c: number };
if (pitchCount.c === 0) {
  const insertPitch = db.prepare("INSERT INTO pitches (name) VALUES (?)");
  ["Main Pitch", "7v7 Pitch"].forEach((p) => insertPitch.run(p));

  const insertTeam = db.prepare("INSERT INTO teams (name, colour) VALUES (?, ?)");
  [
    ["First Team", "#dc2626"],
    ["Reserve Team", "#ea580c"],
    ["Sunday Team", "#ca8a04"],
    ["Vets", "#64748b"],
    ["U16's", "#2563eb"],
    ["U12's", "#0d9488"],
    ["U11's", "#9333ea"],
    ["Cubs", "#65a30d"],
  ].forEach(([name, colour]) => insertTeam.run(name, colour));
}

interface BookingRow {
  id: number;
  pitch_id: number | null;
  team_id: number;
  type: "fixture" | "training";
  title: string | null;
  date: string;
  start_min: number;
  end_min: number;
  booked_by: string;
  created_at: string;
  pitch_name: string | null;
  team_name: string;
  team_colour: string;
}

function toBooking(row: BookingRow): BookingWithNames {
  return {
    id: row.id,
    pitchId: row.pitch_id,
    teamId: row.team_id,
    type: row.type,
    title: row.title,
    date: row.date,
    startMin: row.start_min,
    endMin: row.end_min,
    bookedBy: row.booked_by,
    createdAt: row.created_at,
    pitchName: row.pitch_name,
    teamName: row.team_name,
    teamColour: row.team_colour,
  };
}

const bookingSelect = `
  SELECT b.*, p.name AS pitch_name, t.name AS team_name, t.colour AS team_colour
  FROM bookings b
  LEFT JOIN pitches p ON p.id = b.pitch_id
  JOIN teams t ON t.id = b.team_id
`;

export function getPitches(): Pitch[] {
  return db.prepare("SELECT id, name FROM pitches ORDER BY id").all() as Pitch[];
}

export function addPitch(name: string): Pitch {
  const result = db.prepare("INSERT INTO pitches (name) VALUES (?)").run(name.trim());
  return { id: Number(result.lastInsertRowid), name: name.trim() };
}

export function deletePitch(id: number): void {
  db.prepare("DELETE FROM pitches WHERE id = ?").run(id);
}

export function getTeams(): Team[] {
  return db.prepare("SELECT id, name, colour FROM teams ORDER BY id").all() as Team[];
}

export function addTeam(name: string, colour: string): Team {
  const result = db
    .prepare("INSERT INTO teams (name, colour) VALUES (?, ?)")
    .run(name.trim(), colour);
  return { id: Number(result.lastInsertRowid), name: name.trim(), colour };
}

export function deleteTeam(id: number): void {
  db.prepare("DELETE FROM teams WHERE id = ?").run(id);
}

export function getBookings(from: string, to: string): BookingWithNames[] {
  return (
    db
      .prepare(`${bookingSelect} WHERE b.date >= ? AND b.date <= ? ORDER BY b.date, b.start_min`)
      .all(from, to) as BookingRow[]
  ).map(toBooking);
}

export function getBooking(id: number): BookingWithNames | undefined {
  const row = db.prepare(`${bookingSelect} WHERE b.id = ?`).get(id) as BookingRow | undefined;
  return row ? toBooking(row) : undefined;
}

/** Bookings on the same pitch and date whose time range overlaps the given one. */
export function findClashes(
  pitchId: number,
  date: string,
  startMin: number,
  endMin: number,
  excludeId?: number
): BookingWithNames[] {
  const rows = db
    .prepare(
      `${bookingSelect}
       WHERE b.pitch_id = ? AND b.date = ? AND b.start_min < ? AND b.end_min > ?
       AND b.id != ?`
    )
    .all(pitchId, date, endMin, startMin, excludeId ?? -1) as BookingRow[];
  return rows.map(toBooking);
}

export type BookingInput = Omit<Booking, "id" | "createdAt">;

export function createBooking(input: BookingInput): BookingWithNames {
  const result = db
    .prepare(
      `INSERT INTO bookings (pitch_id, team_id, type, title, date, start_min, end_min, booked_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.pitchId,
      input.teamId,
      input.type,
      input.title,
      input.date,
      input.startMin,
      input.endMin,
      input.bookedBy
    );
  return getBooking(Number(result.lastInsertRowid))!;
}

export function updateBooking(id: number, input: BookingInput): BookingWithNames {
  db.prepare(
    `UPDATE bookings
     SET pitch_id = ?, team_id = ?, type = ?, title = ?, date = ?, start_min = ?, end_min = ?, booked_by = ?
     WHERE id = ?`
  ).run(
    input.pitchId,
    input.teamId,
    input.type,
    input.title,
    input.date,
    input.startMin,
    input.endMin,
    input.bookedBy,
    id
  );
  return getBooking(id)!;
}

export function deleteBooking(id: number): void {
  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
}
