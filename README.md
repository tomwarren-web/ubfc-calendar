# Pitch Booking

A shared booking calendar for a football club with multiple teams and pitches. Managers and
committee members book fixtures and training slots, and the app **blocks any booking that
clashes** with an existing one on the same pitch.

## Features

- **Week-view calendar per pitch** — tabs to switch between pitches, with booking counts.
- **Click-to-book** — click an empty slot to book it, or click a booking to edit/delete it.
- **Hard clash protection** — overlap checks run on the server; a clashing booking is rejected
  with details of what it clashes with and who booked it. Back-to-back bookings (one ending as
  another starts) are allowed.
- **Fixtures vs training** — bookings are typed, with optional opposition/notes.
- **Team colours** — each team's bookings are colour-coded on the calendar.
- **Name picker sign-in** — no passwords; each user enters their name once (stored in their
  browser) and it is recorded against every booking they make.
- **Teams & pitches admin** — add or remove teams and pitches at `/settings`.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first run the database is created at `data/bookings.db` and
seeded with example pitches and teams — change them under **Teams & pitches**.

## Deployment

Data is stored in a local SQLite file, so the app needs a host with a **persistent disk**:

- **Railway / Fly.io / Render** — attach a volume and mount it so `data/` persists. Easiest option.
- **A club machine or VPS** — `npm run build && npm start`, optionally exposed via a
  Cloudflare Tunnel.
- **Vercel** — serverless functions have no persistent disk, so SQLite will not work there.
  To use Vercel, swap the storage layer in `lib/db.ts` for a hosted database
  (e.g. Turso, Neon, or Vercel Postgres). All database access is confined to that one file.

Because there is no authentication beyond the name picker, keep the deployed URL private to
club members (or put it behind your host's basic-auth / access controls).

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD` | Bookings in a date range |
| POST | `/api/bookings` | Create a booking (409 + clash details on conflict) |
| PUT | `/api/bookings/:id` | Update a booking (same clash check, excluding itself) |
| DELETE | `/api/bookings/:id` | Delete a booking |
| GET/POST | `/api/pitches`, `/api/teams` | List / add pitches and teams |
| DELETE | `/api/pitches/:id`, `/api/teams/:id` | Remove (cascades to their bookings) |

Times are stored as minutes from midnight (`startMin`/`endMin`); the calendar displays
08:00–22:00.
