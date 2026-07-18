-- Per-fixture confirmation details (referee + opposition contact), keyed to a
-- booking, plus a season-long directory of opposition contacts so each club's
-- secretary only has to be typed once.
CREATE TABLE IF NOT EXISTS match_contacts (
  booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  referee_name TEXT NOT NULL DEFAULT '',
  referee_email TEXT NOT NULL DEFAULT '',
  opposition_name TEXT NOT NULL DEFAULT '',
  opposition_email TEXT NOT NULL DEFAULT '',
  league TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opposition_directory (
  club_name TEXT PRIMARY KEY,
  contact_email TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
