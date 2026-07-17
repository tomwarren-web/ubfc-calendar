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

## Live site

Production: **https://ubfc-calendar.netlify.app** — hosted on Netlify under the club's
account (`upperbeedingfc@outlook.com`), with data in Netlify DB (managed Postgres). Teams
and pitches are administered directly at `/settings` (deliberately unlinked from the UI).

## FA Full-Time fixture sync

A scheduled function (`netlify/functions/fulltime-sync.mts`, daily 04:30 UTC) reads each
configured team's public FA Full-Time page and reconciles upcoming fixtures into the
calendar: new fixtures are added (home games on the team's configured pitch, away games as
off-site), changed ones updated, and vanished/postponed ones removed. It only ever touches
bookings it created (`source_ref = "fulltime:<fixtureId>"`) — manual bookings are never
altered. If an imported home fixture clashes with an existing booking it is imported as
off-site and flagged in the summary email rather than dropped. A change-summary email goes
to the booking-notification address after any run that did something.

Teams are configured in [`lib/fulltime.ts`](lib/fulltime.ts) (`FULLTIME_TEAMS`). **The
`divisionseason` in each team's URL changes every season** — update the URLs when the new
season's fixtures are published. Manual trigger:
`POST /api/fulltime-sync?key=<SYNC_SECRET>`.

FA Full-Time has no official API, so this reads the public HTML pages; if the FA change
their markup the sync emails an error rather than failing silently.

## Running locally

```bash
npm install
netlify dev
```

`netlify dev` starts a local Postgres, applies the migrations in
`netlify/database/migrations/`, and injects `NETLIFY_DB_URL`. (Plain `npm run dev` also
works if you set `NETLIFY_DB_URL` or `DATABASE_URL` yourself.)

## Deployment

Every push to `master` on GitHub auto-deploys to production via Netlify's GitHub
integration. Pending migrations are applied automatically during the deploy; schema
changes must be added as new timestamped folders under `netlify/database/migrations/` —
applied migrations cannot be edited. (`netlify deploy --prod` still works for manual
deploys from this folder.)

Because there is no authentication beyond the name picker, keep the deployed URL private to
club members.

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
